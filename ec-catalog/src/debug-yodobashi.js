/**
 * ヨドバシカメラ サイト構造調査 v3
 * npm run debug:yodobashi
 *
 * 目的: 商品一覧ページの「商品数」「ブランド絞り込み」のセレクタ特定
 */
const { chromium } = require('playwright');

// 家電 > テレビの商品一覧ページ（直接指定）
const TEST_URL = 'https://www.yodobashi.com/category/6353/';

(async () => {
  const browser = await chromium.launch({ headless: false, args: ['--disable-blink-features=AutomationControlled'] });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    locale: 'ja-JP', ignoreHTTPSErrors: true, viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();

  // ── Step1: 家電カテゴリから実際の商品一覧（サブカテゴリ）URLを探す ──
  console.log(`\n[Step1] 家電カテゴリ内サブカテゴリ探索: ${TEST_URL}`);
  await page.goto(TEST_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);

  const subCatInfo = await page.evaluate(() => {
    // メインコンテンツ内のカテゴリリンクのみ（ナビ除外）
    const main = document.querySelector('main, #main, .mainArea, .contentsBody, [class*="content"]');
    const searchArea = main || document;
    const catLinks = Array.from(searchArea.querySelectorAll('a[href*="/category/"]'))
      .map(a => ({ text: a.textContent.trim().replace(/\s+/g, ' ').slice(0, 40), href: a.href }))
      .filter(a => a.text.length > 0)
      .filter((a, i, arr) => arr.findIndex(b => b.href === a.href) === i)
      .slice(0, 20);

    // itemCount 要素の現在値
    const itemCount = document.querySelector('.itemCount');

    return { catLinks, itemCountText: itemCount?.textContent?.trim() ?? null };
  });

  console.log('  itemCount:', subCatInfo.itemCountText ?? '(未描画)');
  console.log('  サブカテゴリリンク:');
  subCatInfo.catLinks.forEach(l => console.log(`    ${l.text} => ${l.href}`));

  // ── Step2: 商品一覧ページで件数・ブランドフィルタ調査 ──
  // サブカテゴリが見つかればそこへ、なければ家電トップで続行
  const listUrl = subCatInfo.catLinks.find(l => l.href !== TEST_URL)?.href ?? TEST_URL;
  console.log(`\n[Step2] 商品一覧ページ調査: ${listUrl}`);
  await page.goto(listUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

  // itemCount が描画されるまで待機（最大10秒）
  await page.waitForSelector('.itemCount', { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(2000);

  const listInfo = await page.evaluate(() => {
    // 1. 商品数: itemCount クラスと「件」含む全要素
    const itemCountEl = document.querySelector('.itemCount');
    const countEls = Array.from(document.querySelectorAll('*'))
      .filter(el => el.children.length === 0 && /[\d,]+件/.test(el.textContent))
      .slice(0, 10)
      .map(el => ({ tag: el.tagName, cls: el.className.slice(0, 80), text: el.textContent.trim().slice(0, 60) }));

    // 2. 左サイドバー / 絞り込みエリアの HTML
    const sidebar = document.querySelector(
      '.filterArea, .searchFilter, .refineSearch, [class*="filter"], [class*="Filter"], [class*="narrow"], aside'
    );
    const sidebarHTML = sidebar?.innerHTML.replace(/\s+/g, ' ').slice(0, 1000) ?? '(なし)';

    // 3. メーカー/ブランド絞り込みリスト
    const makerEls = Array.from(document.querySelectorAll(
      '[class*="maker"], [class*="brand"], [class*="Brand"], [class*="Maker"], [class*="mfr"]'
    )).filter(el => el.querySelectorAll('a, li, label').length > 1)
      .slice(0, 5)
      .map(el => ({
        tag: el.tagName,
        cls: el.className.slice(0, 80),
        childTags: [...new Set(Array.from(el.children).map(c => c.tagName))].join(','),
        items: Array.from(el.querySelectorAll('a, li, label')).slice(0, 8)
          .map(i => i.textContent.trim().slice(0, 20)).join(' | '),
      }));

    // 4. ページ内全クラス名からフィルタ関連を抽出
    const allClasses = [...new Set(
      Array.from(document.querySelectorAll('*'))
        .map(el => el.className).filter(c => typeof c === 'string')
        .join(' ').split(/\s+/)
    )].filter(c => /filter|Filter|refine|narrow|Narrow|facet|Facet|count|Count|total|Total|brand|Brand|maker|Maker/i.test(c))
      .slice(0, 40);

    return {
      itemCountDirect: itemCountEl?.textContent?.trim() ?? null,
      countEls,
      sidebarHTML,
      makerEls,
      allClasses,
    };
  });

  console.log('\n--- itemCount直取得 ---');
  console.log(' ', listInfo.itemCountDirect ?? '(見つからず)');

  console.log('\n--- 「件」含む要素 ---');
  listInfo.countEls.forEach(e => console.log(`  <${e.tag} class="${e.cls}"> → "${e.text}"`));

  console.log('\n--- サイドバーHTML (先頭1000文字) ---');
  console.log(listInfo.sidebarHTML);

  console.log('\n--- メーカー/ブランド絞り込み要素 ---');
  listInfo.makerEls.forEach(e =>
    console.log(`  <${e.tag} class="${e.cls}"> children=[${e.childTags}]\n    items: ${e.items}`)
  );

  console.log('\n--- フィルタ/件数関連クラス名 ---');
  console.log(' ', listInfo.allClasses.join(', '));

  await browser.close();
})();
