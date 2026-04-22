/**
 * 上新電機（Joshin）サイト構造調査 v5
 * npm run debug:joshin
 *
 * 目的: li=0の原因解明、divベースタイル検出、ブランド絞り込み確認
 */
const { chromium } = require('playwright');

const URLS = {
  縦型洗濯機: 'https://joshinweb.jp/kaden/406.html',
  洗濯機全体:  'https://joshinweb.jp/kaden/354.html',
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
    await page.waitForTimeout(8000); // JS描画待ち
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
    await page.waitForTimeout(2000);

    const info = await page.evaluate(() => {
      const title = document.title;
      const actualUrl = location.href;
      const totalEls = document.querySelectorAll('*').length;

      // 本文冒頭200文字
      const bodyText = (document.body?.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 200);

      // 件数含む要素
      const countEls = Array.from(document.querySelectorAll('*'))
        .filter(el => el.children.length === 0 && /[\d,]+(件|商品|点|結果)/.test(el.textContent))
        .slice(0, 10)
        .map(el => ({ tag: el.tagName, cls: el.className.slice(0, 80), text: el.textContent.trim().slice(0, 60) }));

      // 価格要素 (任意コンテナ)
      const priceEls = Array.from(document.querySelectorAll('*'))
        .filter(el => el.children.length === 0 && /[\d,]+円/.test(el.textContent))
        .slice(0, 8)
        .map(el => ({ tag: el.tagName, cls: el.className.slice(0, 60), text: el.textContent.trim().slice(0, 40) }));

      // div/article ベースのタイル候補
      const tileCandidates = [
        'div[class*="itmUnit"]', 'div[class*="itemUnit"]', 'div[class*="item-unit"]',
        'div[class*="goods"]',   'div[class*="product"]',  'div[class*="commodity"]',
        '.itmUnit', '.itemUnit', '.prd',
        'article',
        '.listItem', '[class*="listItem"]',
        'div[class*="list"] > div',
        'ul[class*="list"] > li',
      ].map(sel => ({ sel, count: document.querySelectorAll(sel).length }))
        .filter(r => r.count > 0);

      // li統計
      const liTotal = document.querySelectorAll('li').length;
      const liWithPrice = Array.from(document.querySelectorAll('li'))
        .filter(li => /[\d,]+円/.test(li.textContent)).length;

      // ブランド/メーカー絞り込み要素
      const brandEls = Array.from(document.querySelectorAll(
        '[class*="maker"], [class*="brand"], [class*="Brand"], [class*="Maker"], [class*="mfr"]'
      ))
        .filter(el => el.querySelectorAll('a, li, label, input').length > 0)
        .slice(0, 5)
        .map(el => ({
          tag: el.tagName, cls: el.className.slice(0, 80),
          count: el.querySelectorAll('a, li, label').length,
          sample: Array.from(el.querySelectorAll('a, li, label')).slice(0, 5)
            .map(i => i.textContent.trim().slice(0, 20)).join(' | '),
        }));

      // ページネーション
      const pagerEls = Array.from(document.querySelectorAll('[class*="page"], [class*="pager"], [class*="navi"]'))
        .filter(el => /\d/.test(el.textContent)).slice(0, 3)
        .map(el => ({ cls: el.className.slice(0, 60), text: el.textContent.trim().slice(0, 100) }));

      // クラス名ヒント
      const allClasses = [...new Set(
        Array.from(document.querySelectorAll('*'))
          .map(el => el.className)
          .filter(c => typeof c === 'string')
          .join(' ')
          .split(/\s+/)
      )].filter(c => /item|product|goods|list|price|brand|maker|count|result|cate|itm|prd/i.test(c)).slice(0, 60);

      return { title, actualUrl, totalEls, bodyText, countEls, priceEls, tileCandidates, liTotal, liWithPrice, brandEls, pagerEls, allClasses };
    });

    console.log(`  title:    ${info.title}`);
    console.log(`  url:      ${info.actualUrl}`);
    console.log(`  DOM要素数: ${info.totalEls}  li合計: ${info.liTotal}  価格ありli: ${info.liWithPrice}`);
    console.log(`  本文冒頭: "${info.bodyText}"`);
    console.log('  件数含む要素:');
    info.countEls.forEach(e => console.log(`    <${e.tag} class="${e.cls}"> "${e.text}"`));
    console.log('  価格要素:');
    info.priceEls.forEach(e => console.log(`    <${e.tag} class="${e.cls}"> "${e.text}"`));
    console.log('  商品タイル候補 (count > 0):');
    info.tileCandidates.forEach(r => console.log(`    ${r.sel}: ${r.count}`));
    console.log('  ブランド要素:');
    info.brandEls.forEach(e => console.log(`    <${e.tag} class="${e.cls}"> count=${e.count}  "${e.sample}"`));
    console.log('  ページネーション:');
    info.pagerEls.forEach(e => console.log(`    [${e.cls}] "${e.text}"`));
    console.log('  クラス名ヒント:', info.allClasses.join(', '));
  }

  await browser.close();
})();
