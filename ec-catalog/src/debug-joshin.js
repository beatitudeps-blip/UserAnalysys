/**
 * 上新電機（Joshin）サイト構造調査 v6
 * npm run debug:joshin
 *
 * 目的: price/itemクラス要素の中身・件数取得方法の確定
 */
const { chromium } = require('playwright');

const URLS = {
  洗濯機:     'https://joshinweb.jp/kaden/354.html',
  冷蔵庫:     'https://joshinweb.jp/kaden/307.html',
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
    await page.waitForTimeout(8000);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
    await page.waitForTimeout(2000);

    const info = await page.evaluate(() => {
      const title = document.title;
      const actualUrl = location.href;

      // Access Denied チェック
      if (document.querySelectorAll('*').length < 20) {
        return { blocked: true, title, actualUrl };
      }

      // 1. 件数含む全テキスト（円なし含む）
      const countEls = Array.from(document.querySelectorAll('*'))
        .filter(el => el.children.length === 0 && /[\d,]+(件|商品|点|結果|アイテム)/.test(el.textContent))
        .slice(0, 10)
        .map(el => ({ tag: el.tagName, cls: el.className.slice(0, 80), text: el.textContent.trim().slice(0, 80) }));

      // 2. .price / .search_container_price / .item 等の中身サンプル
      const priceClsSamples = Array.from(document.querySelectorAll(
        '.price, .search_container_price, .discount_price_list, .special_price_display, [class*="price"]'
      ))
        .filter(el => el.textContent.trim().length > 0)
        .slice(0, 10)
        .map(el => ({ tag: el.tagName, cls: el.className.slice(0, 80), text: el.textContent.trim().slice(0, 60) }));

      // 3. li.item または div.item サンプル
      const itemEls = Array.from(document.querySelectorAll('li.item, div.item, [class="item"]'))
        .slice(0, 5)
        .map(el => ({ tag: el.tagName, cls: el.className, text: el.textContent.replace(/\s+/g, ' ').trim().slice(0, 100) }));

      // 4. select要素（20件/40件/100件）の親コンテキスト
      const selectEls = Array.from(document.querySelectorAll('select'))
        .map(el => ({
          cls: el.className.slice(0, 60),
          options: Array.from(el.querySelectorAll('option')).map(o => o.textContent.trim()).join(' / '),
          parentText: el.closest('[class]')?.className.slice(0, 80) || '',
        }));

      // 5. .cate_list の構造（商品orカテゴリ？）
      const cateLists = Array.from(document.querySelectorAll('.cate_list'))
        .slice(0, 3)
        .map(el => ({
          cls: el.className,
          liCount: el.querySelectorAll('li').length,
          sample: el.textContent.replace(/\s+/g, ' ').trim().slice(0, 120),
        }));

      // 6. ul[class*="list"] > li のサンプル（最初の3つ）
      const listLiSamples = Array.from(document.querySelectorAll('ul[class*="list"] > li'))
        .slice(0, 3)
        .map(el => ({ cls: el.className.slice(0, 60), text: el.textContent.replace(/\s+/g, ' ').trim().slice(0, 100) }));

      // 7. ブランド絞り込み再調査（チェックボックス・リンクリスト）
      const filterAreas = Array.from(document.querySelectorAll('[id*="maker"], [id*="brand"], [class*="maker"], [class*="brand"]'))
        .filter(el => el.querySelectorAll('input, a, label').length > 1)
        .slice(0, 5)
        .map(el => ({ tag: el.tagName, id: el.id, cls: el.className.slice(0, 60), count: el.querySelectorAll('input, a, label').length, sample: el.textContent.replace(/\s+/g, ' ').trim().slice(0, 80) }));

      // 8. ¥付き価格
      const yenPrices = Array.from(document.querySelectorAll('*'))
        .filter(el => el.children.length === 0 && /¥[\d,]+/.test(el.textContent))
        .slice(0, 5)
        .map(el => ({ tag: el.tagName, cls: el.className.slice(0, 60), text: el.textContent.trim().slice(0, 40) }));

      return { blocked: false, title, actualUrl, countEls, priceClsSamples, itemEls, selectEls, cateLists, listLiSamples, filterAreas, yenPrices };
    });

    if (info.blocked) {
      console.log(`  !! ACCESS DENIED (DOM要素6以下) !!`);
      continue;
    }

    console.log(`  title: ${info.title}`);
    console.log(`  url:   ${info.actualUrl}`);

    console.log('  件数含む要素:');
    info.countEls.forEach(e => console.log(`    <${e.tag} class="${e.cls}"> "${e.text}"`));

    console.log('  priceクラス要素サンプル:');
    info.priceClsSamples.forEach(e => console.log(`    <${e.tag} class="${e.cls}"> "${e.text}"`));

    console.log('  ¥価格要素:');
    info.yenPrices.forEach(e => console.log(`    <${e.tag} class="${e.cls}"> "${e.text}"`));

    console.log('  li.item / div.item サンプル:');
    info.itemEls.forEach(e => console.log(`    <${e.tag} class="${e.cls}"> "${e.text}"`));

    console.log('  ul[class*="list"] > li サンプル:');
    info.listLiSamples.forEach(e => console.log(`    [${e.cls}] "${e.text}"`));

    console.log('  select要素:');
    info.selectEls.forEach(e => console.log(`    [${e.cls}] ${e.options}  (parent: ${e.parentText})`));

    console.log('  .cate_list 構造:');
    info.cateLists.forEach(e => console.log(`    [${e.cls}] li数=${e.liCount}  "${e.sample}"`));

    console.log('  ブランド絞り込み:');
    info.filterAreas.forEach(e => console.log(`    <${e.tag} id="${e.id}" class="${e.cls}"> count=${e.count}  "${e.sample}"`));
  }

  await browser.close();
})();
