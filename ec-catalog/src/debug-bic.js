/**
 * ビックカメラ サイト構造調査
 * npm run debug:bic
 *
 * 調査ポイント:
 *   1. カテゴリURLパターン
 *   2. 商品数の取得方法（件数表示要素 or 商品タイル数）
 *   3. ブランド/メーカー絞り込みの取得方法
 */
const { chromium } = require('playwright');

const TOP_URL = 'https://www.biccamera.com/bc/main/';

(async () => {
  const browser = await chromium.launch({ headless: false, args: ['--disable-blink-features=AutomationControlled'] });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    locale: 'ja-JP', ignoreHTTPSErrors: true, viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();

  // ── Step1: トップページのカテゴリリンク ──
  console.log(`\n[Step1] トップページ: ${TOP_URL}`);
  await page.goto(TOP_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);

  const topInfo = await page.evaluate(() => {
    // カテゴリリンクを全収集
    const allLinks = Array.from(document.querySelectorAll('a[href]'))
      .map(a => ({ text: a.textContent.trim().replace(/\s+/g, ' ').slice(0, 40), href: a.href }))
      .filter(a => a.text && a.href.includes('biccamera.com'));

    // /bc/c/ パターン（カテゴリ）
    const catLinks = allLinks.filter(a => /\/bc\/c\//.test(a.href))
      .filter((a, i, arr) => arr.findIndex(b => b.href === a.href) === i)
      .slice(0, 20);

    // /bc/item/ パターン（商品）
    const itemLinks = allLinks.filter(a => /\/bc\/item\//.test(a.href)).slice(0, 3);

    // URLパターン一覧（ユニーク）
    const urlPatterns = [...new Set(
      allLinks.map(a => {
        const m = a.href.match(/biccamera\.com(\/bc\/[^/?]+\/)/);
        return m ? m[1] : null;
      }).filter(Boolean)
    )].slice(0, 15);

    return { catLinks, itemLinks, urlPatterns };
  });

  console.log('  カテゴリリンク (/bc/c/):');
  topInfo.catLinks.forEach(l => console.log(`    "${l.text}" => ${l.href}`));
  console.log('  商品リンクサンプル:');
  topInfo.itemLinks.forEach(l => console.log(`    "${l.text}" => ${l.href}`));
  console.log('  URLパターン一覧:', topInfo.urlPatterns.join(', '));

  // ── Step2: カテゴリページの商品数・ブランド数 ──
  const catUrl = topInfo.catLinks[0]?.href;
  if (!catUrl) { console.log('  カテゴリURLが見つかりませんでした'); await browser.close(); return; }

  console.log(`\n[Step2] カテゴリページ: ${catUrl}`);
  await page.goto(catUrl, { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(3000);
  await page.evaluate(() => window.scrollTo(0, 600));
  await page.waitForTimeout(1500);

  const catInfo = await page.evaluate(() => {
    // 件数を含む全テキスト
    const countEls = Array.from(document.querySelectorAll('*'))
      .filter(el => el.children.length === 0 && /[\d,]+件/.test(el.textContent))
      .slice(0, 10)
      .map(el => ({ tag: el.tagName, cls: el.className.slice(0, 80), text: el.textContent.trim().slice(0, 60) }));

    // 商品タイル数
    const tileSelectors = [
      '.bc-search-result__item',
      '[class*="searchResult"] li',
      '[class*="itemList"] li',
      '[class*="productList"] li',
      '[class*="listItem"]',
      '.bc-item-list__item',
    ];
    let tileCount = 0, tileClass = '';
    for (const sel of tileSelectors) {
      const items = document.querySelectorAll(sel);
      if (items.length > 0) { tileCount = items.length; tileClass = sel; break; }
    }

    // ブランド/メーカー要素
    const brandEls = Array.from(document.querySelectorAll('[class*="maker"], [class*="brand"], [class*="Brand"], [class*="Maker"]'))
      .filter(el => el.querySelectorAll('a, li, label').length > 0)
      .slice(0, 5)
      .map(el => ({
        tag: el.tagName, cls: el.className.slice(0, 80),
        linkCount: el.querySelectorAll('a').length,
        liCount: el.querySelectorAll('li').length,
        sample: Array.from(el.querySelectorAll('a, li')).slice(0, 5).map(i => i.textContent.trim().slice(0, 20)).join(' | '),
      }));

    // ページ内のクラス名からヒント
    const allClasses = [...new Set(
      Array.from(document.querySelectorAll('*')).map(el => el.className)
        .filter(c => typeof c === 'string').join(' ').split(/\s+/)
    )].filter(c => /maker|brand|Brand|Maker|count|Count|total|result|Result|filter|Filter/i.test(c)).slice(0, 30);

    return { countEls, tileCount, tileClass, brandEls, allClasses };
  });

  console.log('  件数含む要素:');
  catInfo.countEls.forEach(e => console.log(`    <${e.tag} class="${e.cls}"> → "${e.text}"`));
  console.log(`  商品タイル数: ${catInfo.tileCount} (${catInfo.tileClass})`);
  console.log('  ブランド/メーカー要素:');
  catInfo.brandEls.forEach(e =>
    console.log(`    <${e.tag} class="${e.cls}"> links=${e.linkCount} li=${e.liCount}\n      sample: ${e.sample}`)
  );
  console.log('  関連クラス名:', catInfo.allClasses.join(', '));

  // ── Step3: 2つ目のカテゴリも確認 ──
  const catUrl2 = topInfo.catLinks[2]?.href;
  if (catUrl2 && catUrl2 !== catUrl) {
    console.log(`\n[Step3] 2つ目カテゴリ: ${catUrl2}`);
    await page.goto(catUrl2, { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(3000);
    const countEls2 = await page.evaluate(() =>
      Array.from(document.querySelectorAll('*'))
        .filter(el => el.children.length === 0 && /[\d,]+件/.test(el.textContent))
        .slice(0, 5)
        .map(el => ({ tag: el.tagName, cls: el.className.slice(0, 80), text: el.textContent.trim() }))
    );
    console.log('  件数含む要素:');
    countEls2.forEach(e => console.log(`    <${e.tag} class="${e.cls}"> → "${e.text}"`));
  }

  await browser.close();
})();
