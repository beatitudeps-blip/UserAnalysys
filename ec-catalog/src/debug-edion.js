/**
 * エディオン サイト構造調査 v4
 * npm run debug:edion
 *
 * 目的: item_list.html（葉カテゴリ）の商品数・ブランド確認
 */
const { chromium } = require('playwright');

const URLS = {
  冷蔵庫一覧: 'https://www.edion.com/item_list.html?c_cd=001001001',
  洗濯機一覧: 'https://www.edion.com/item_list.html?c_cd=001001003',
};

(async () => {
  const browser = await chromium.launch({
    headless: false,
    ignoreDefaultArgs: ['--enable-automation'],
    args: ['--disable-blink-features=AutomationControlled', '--no-sandbox'],
  });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    locale: 'ja-JP', timezoneId: 'Asia/Tokyo', ignoreHTTPSErrors: true, viewport: { width: 1280, height: 900 },
  });
  await context.addInitScript(() => { Object.defineProperty(navigator, 'webdriver', { get: () => undefined }); window.chrome = { runtime: {} }; });
  const page = await context.newPage();

  for (const [label, url] of Object.entries(URLS)) {
    console.log(`\n====== ${label}: ${url} ======`);
    await page.goto(url, { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(4000);
    await page.evaluate(() => window.scrollTo(0, 600));
    await page.waitForTimeout(1500);

    const info = await page.evaluate(() => {
      const url   = location.href;
      const title = document.title;

      // 1. 件数含む要素（「件」「点」「商品」）
      const countEls = Array.from(document.querySelectorAll('*'))
        .filter(el => el.children.length === 0 && /[\d,]+(件|点|商品|結果)/.test(el.textContent))
        .slice(0, 10)
        .map(el => ({ tag: el.tagName, cls: el.className.slice(0, 80), text: el.textContent.trim() }));

      // 2. 価格持つliをカウント（商品タイル）
      const allLi = Array.from(document.querySelectorAll('li'));
      const liWithPrice = allLi.filter(li => /[\d,]+円/.test(li.textContent));

      // 3. 商品タイルクラス特定
      const priceTags = Array.from(document.querySelectorAll('*'))
        .filter(el => el.children.length === 0 && /[\d,]+円/.test(el.textContent));
      const tileClasses = [...new Set(
        priceTags.map(el => { let p = el.parentElement; for (let i = 0; i < 6; i++) { if (p?.tagName === 'LI') return p.className.slice(0, 60); p = p?.parentElement; } return null; }).filter(Boolean)
      )];

      // 4. ブランド/メーカー要素（より広く）
      const brandEls = Array.from(document.querySelectorAll('[class*="maker"], [class*="brand"], [class*="Brand"], [class*="mfr"], [class*="Maker"], [id*="maker"], [id*="brand"]'))
        .filter(el => el.querySelectorAll('a, li, label, input').length > 0)
        .slice(0, 5)
        .map(el => ({
          tag: el.tagName, id: (el.id || '').slice(0, 40), cls: el.className.slice(0, 80),
          childCount: el.querySelectorAll('a, li, label').length,
          sample: Array.from(el.querySelectorAll('a, li, label')).slice(0, 5).map(i => i.textContent.trim().slice(0, 20)).join(' | '),
        }));

      // 5. 絞り込みエリア
      const filterEls = Array.from(document.querySelectorAll('[class*="filter"], [class*="Filter"], [class*="narrow"], [class*="refine"], [class*="search"] ul'))
        .filter(el => el.querySelectorAll('a, li').length > 2)
        .slice(0, 3)
        .map(el => ({ tag: el.tagName, cls: el.className.slice(0, 80), count: el.querySelectorAll('a, li').length, sample: el.textContent.trim().slice(0, 100).replace(/\s+/g, ' ') }));

      // 6. ページネーション
      const pagerEls = Array.from(document.querySelectorAll('[class*="page"], [class*="pager"], [class*="navi"]'))
        .filter(el => /\d/.test(el.textContent)).slice(0, 3)
        .map(el => ({ cls: el.className.slice(0, 60), text: el.textContent.trim().slice(0, 100) }));

      // 7. 全クラス名ヒント
      const allClasses = [...new Set(
        Array.from(document.querySelectorAll('*')).map(el => el.className)
          .filter(c => typeof c === 'string').join(' ').split(/\s+/)
      )].filter(c => /maker|brand|count|total|result|filter|item|product|list|search/i.test(c)).slice(0, 40);

      return { url, title, countEls, liWithPriceCount: liWithPrice.length, tileClasses, brandEls, filterEls, pagerEls, allClasses };
    });

    console.log(`  title: ${info.title}`);
    console.log('  件数含む要素:');
    info.countEls.forEach(e => console.log(`    <${e.tag} class="${e.cls}"> → "${e.text}"`));
    console.log(`  価格ありli数: ${info.liWithPriceCount}  タイルLIクラス: ${info.tileClasses.join(', ') || '(なし)'}`);
    console.log('  ブランド/メーカー要素:');
    info.brandEls.forEach(e => console.log(`    <${e.tag} id="${e.id}" class="${e.cls}"> count=${e.childCount}  sample: ${e.sample}`));
    console.log('  フィルタ要素:');
    info.filterEls.forEach(e => console.log(`    <${e.tag} class="${e.cls}"> count=${e.count}  "${e.sample}"`));
    console.log('  ページネーション:');
    info.pagerEls.forEach(e => console.log(`    [${e.cls}] "${e.text}"`));
    console.log('  クラス名ヒント:', info.allClasses.join(', '));
  }

  await browser.close();
})();
