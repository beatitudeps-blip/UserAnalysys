/**
 * 上新電機（Joshin）サイト構造調査 v4
 * npm run debug:joshin
 *
 * 目的: 商品一覧ページのタイル・ブランド・件数の確定
 */
const { chromium } = require('playwright');

const URLS = {
  縦型洗濯機: 'https://joshinweb.jp/kaden/406.html',   // 葉カテゴリ
  洗濯機全体: 'https://joshinweb.jp/kaden/354.html',
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
    await page.waitForTimeout(3000);
    await page.evaluate(() => window.scrollTo(0, 800));
    await page.waitForTimeout(1500);

    const info = await page.evaluate(() => {
      // 1. 価格を持つ要素（これが商品タイル）を探す
      const priceEls = Array.from(document.querySelectorAll('*'))
        .filter(el => el.children.length === 0 && /[\d,]+円/.test(el.textContent))
        .slice(0, 3)
        .map(el => ({ tag: el.tagName, cls: el.className.slice(0, 60), text: el.textContent.trim().slice(0, 30) }));

      // 2. 価格要素の親を辿って商品タイルのクラスを特定
      const priceTags = Array.from(document.querySelectorAll('*'))
        .filter(el => el.children.length === 0 && /[\d,]+円/.test(el.textContent));
      const tileClasses = [...new Set(
        priceTags.map(el => {
          let p = el.parentElement;
          for (let i = 0; i < 5; i++) {
            if (p && p.tagName === 'LI') return p.className.slice(0, 60);
            p = p?.parentElement;
          }
          return null;
        }).filter(Boolean)
      )];

      // 3. 全 li 要素を価格あり / なし に分けてカウント
      const allLi = document.querySelectorAll('li');
      const liWithPrice = Array.from(allLi).filter(li => /[\d,]+円/.test(li.textContent));
      const liWithLink  = Array.from(allLi).filter(li => li.querySelector('a[href*="/kaden/"]'));

      // 4. ブランド名を商品から抽出（製品名の冒頭ブランドを推測）
      // まず商品名要素を探す
      const nameEls = Array.from(document.querySelectorAll('[class*="name"], [class*="Name"], [class*="itmNm"], [class*="title"]'))
        .filter(el => el.children.length === 0 && el.textContent.trim().length > 5)
        .slice(0, 10)
        .map(el => ({ cls: el.className.slice(0, 60), text: el.textContent.trim().slice(0, 40) }));

      // 5. ページネーション情報
      const pagination = Array.from(document.querySelectorAll('[class*="page"], [class*="pager"]'))
        .filter(el => /\d/.test(el.textContent))
        .slice(0, 3)
        .map(el => ({ cls: el.className.slice(0, 60), text: el.textContent.replace(/\s+/g, ' ').trim().slice(0, 100) }));

      // 6. サイドバーのリンク数（カテゴリナビ）
      const sideNavLinks = document.querySelectorAll('.cate_list a, [class*="cate"] a, [class*="nav"] a').length;

      return { priceEls, tileClasses, liTotal: allLi.length, liWithPrice: liWithPrice.length, liWithLink: liWithLink.length, nameEls, pagination, sideNavLinks };
    });

    console.log('  価格要素サンプル:');
    info.priceEls.forEach(e => console.log(`    <${e.tag} class="${e.cls}"> "${e.text}"`));
    console.log(`  li総数: ${info.liTotal}  価格ありli: ${info.liWithPrice}  kadenリンクli: ${info.liWithLink}`);
    console.log('  商品タイルLIクラス:', info.tileClasses.join(', ') || '(なし)');
    console.log('  商品名要素サンプル:');
    info.nameEls.forEach(e => console.log(`    [${e.cls}] "${e.text}"`));
    console.log('  ページネーション:');
    info.pagination.forEach(e => console.log(`    [${e.cls}] "${e.text}"`));
    console.log(`  サイドナビリンク数: ${info.sideNavLinks}`);
  }

  await browser.close();
})();
