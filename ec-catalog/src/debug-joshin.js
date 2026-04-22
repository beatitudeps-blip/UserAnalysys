/**
 * 上新電機（Joshin）サイト構造調査 v3
 * npm run debug:joshin
 */
const { chromium } = require('playwright');

// 実際の商品一覧カテゴリを直接調査
const WASH_URL = 'https://joshinweb.jp/kaden/354.html';  // 洗濯機

(async () => {
  const browser = await chromium.launch({
    headless: false,
    ignoreDefaultArgs: ['--enable-automation'],
    args: ['--disable-blink-features=AutomationControlled', '--no-sandbox'],
  });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    locale: 'ja-JP', timezoneId: 'Asia/Tokyo',
    ignoreHTTPSErrors: true, viewport: { width: 1280, height: 900 },
  });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    window.chrome = { runtime: {} };
  });
  const page = await context.newPage();

  console.log(`\n[洗濯機カテゴリ] ${WASH_URL}`);
  await page.goto(WASH_URL, { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(3000);
  await page.evaluate(() => window.scrollTo(0, 600));
  await page.waitForTimeout(1500);

  const info = await page.evaluate(() => {
    // 1. 件数含む全テキスト（「件」「点」「商品」）
    const countEls = Array.from(document.querySelectorAll('*'))
      .filter(el => el.children.length === 0 && /[\d,]+(件|点|商品)/.test(el.textContent))
      .slice(0, 10)
      .map(el => ({ tag: el.tagName, cls: el.className.slice(0, 80), text: el.textContent.trim() }));

    // 2. 商品タイル数（複数セレクタで確認）
    const tileTests = [
      '.itmUnit', '.itemUnit', '.productItem',
      '[class*="itemList"] > li', '[class*="productList"] > li',
      '[class*="list"] > li', 'ul.list > li',
      '[class="list"] li', '.searchResultItem',
      '.itmInfo',
    ].map(sel => ({ sel, count: document.querySelectorAll(sel).length }))
     .filter(t => t.count > 0);

    // 3. ページネーション（総ページ数から件数推定）
    const pagerEls = Array.from(document.querySelectorAll('[class*="page"], [class*="pager"], [class*="navi"], [class*="Pager"]'))
      .filter(el => /\d/.test(el.textContent))
      .slice(0, 5)
      .map(el => ({ tag: el.tagName, cls: el.className.slice(0, 60), text: el.textContent.trim().slice(0, 100) }));

    // 4. メーカー/ブランド絞り込み（広めに探す）
    const brandEls = Array.from(document.querySelectorAll(
      '[class*="maker"], [class*="brand"], [class*="Brand"], [class*="Maker"], [class*="mfr"], [class*="vendor"]'
    )).filter(el => el.querySelectorAll('a, li, label').length > 0)
      .slice(0, 5)
      .map(el => ({
        tag: el.tagName, cls: el.className.slice(0, 80),
        childCount: el.querySelectorAll('a, li').length,
        sample: Array.from(el.querySelectorAll('a, li')).slice(0, 6).map(i => i.textContent.trim().slice(0, 20)).join(' | '),
      }));

    // 5. フィルタ・絞り込みエリア全体
    const filterArea = document.querySelector('[class*="filter"], [class*="Filter"], [class*="narrow"], [class*="refine"], aside, .sidebar, [class*="side"]');
    const filterHTML = filterArea?.innerHTML.slice(0, 800).replace(/\s+/g, ' ') ?? '(なし)';

    // 6. ページ全体クラス名ヒント
    const allClasses = [...new Set(
      Array.from(document.querySelectorAll('*')).map(el => el.className)
        .filter(c => typeof c === 'string').join(' ').split(/\s+/)
    )].filter(c => /maker|brand|count|total|result|filter|item|product|list|page/i.test(c)).slice(0, 40);

    return { countEls, tileTests, pagerEls, brandEls, filterHTML, allClasses };
  });

  console.log('\n--- 件数含む要素 ---');
  info.countEls.forEach(e => console.log(`  <${e.tag} class="${e.cls}"> → "${e.text}"`));

  console.log('\n--- 商品タイルセレクタ別カウント ---');
  info.tileTests.forEach(t => console.log(`  ${t.sel}: ${t.count}`));

  console.log('\n--- ページネーション ---');
  info.pagerEls.forEach(e => console.log(`  <${e.tag} class="${e.cls}"> → "${e.text}"`));

  console.log('\n--- ブランド/メーカー要素 ---');
  info.brandEls.forEach(e =>
    console.log(`  <${e.tag} class="${e.cls}"> count=${e.childCount}  sample: ${e.sample}`)
  );

  console.log('\n--- フィルタエリア HTML ---');
  console.log(info.filterHTML);

  console.log('\n--- 関連クラス名 ---');
  console.log(info.allClasses.join(', '));

  await browser.close();
})();
