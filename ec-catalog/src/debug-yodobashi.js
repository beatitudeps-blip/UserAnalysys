/**
 * ヨドバシカメラ サイト構造調査 v5
 * npm run debug:yodobashi
 *
 * 確認ポイント:
 *   - 商品数の取得方法（AJAX待機・スクロール・ページネーション）
 *   - ブランド数は /maker/ ページで確定済み
 */
const { chromium } = require('playwright');

// エアコン: 一覧URLと全商品URL
const AIRCON_URL       = 'https://www.yodobashi.com/category/6353/38073/?word=';
const AIRCON_MAKER_URL = 'https://www.yodobashi.com/category/6353/38073/maker/';

(async () => {
  const browser = await chromium.launch({ headless: false, args: ['--disable-blink-features=AutomationControlled'] });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    locale: 'ja-JP', ignoreHTTPSErrors: true, viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();

  // ── 1. 商品一覧ページ（?word=付き）──
  console.log(`\n[1] 商品一覧ページ: ${AIRCON_URL}`);
  await page.goto(AIRCON_URL, { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(3000);

  // スクロールで遅延読み込みを促す
  await page.evaluate(() => window.scrollTo(0, 600));
  await page.waitForTimeout(2000);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(1000);

  const listInfo = await page.evaluate(() => {
    // 商品タイル数（レンダリング済みの商品数）
    const tileSelectors = [
      '.js_productListTile',
      '.p-list_item',
      '.productItemTile',
      '[class*="productList"] li',
      '[class*="ProductList"] li',
      '[class*="itemList"] li',
      '[class*="listItem"]',
    ];
    let tileCount = 0;
    let tileClass = '';
    for (const sel of tileSelectors) {
      const items = document.querySelectorAll(sel);
      if (items.length > 0) { tileCount = items.length; tileClass = sel; break; }
    }

    // itemCount（AJAX後）
    const itemCountEl = document.querySelector('.itemCount');

    // 「件」を含む全テキスト
    const countEls = Array.from(document.querySelectorAll('*'))
      .filter(el => el.children.length === 0 && /[\d,]+件/.test(el.textContent))
      .slice(0, 8)
      .map(el => ({ tag: el.tagName, cls: el.className.slice(0, 80), text: el.textContent.trim() }));

    // ページネーション（総ページ数 or 総件数）
    const pagerEls = Array.from(document.querySelectorAll(
      '[class*="pager"], [class*="Pager"], [class*="pagination"], [class*="Pagination"], [class*="page"]'
    )).filter(el => /\d/.test(el.textContent))
      .slice(0, 5)
      .map(el => ({ tag: el.tagName, cls: el.className.slice(0, 60), text: el.textContent.trim().slice(0, 80) }));

    // XHR で取得される itemCount の値を window 変数から探す
    const windowKeys = Object.keys(window).filter(k =>
      /count|product|item|total/i.test(k) && typeof window[k] === 'number' && window[k] > 10
    ).slice(0, 10);

    // ページ全体のクラス名からヒントを探す
    const productClasses = [...new Set(
      Array.from(document.querySelectorAll('*')).map(el => el.className)
        .filter(c => typeof c === 'string').join(' ').split(/\s+/)
    )].filter(c => /product|Product|item|Item|list|List|tile|Tile/.test(c)).slice(0, 20);

    return {
      itemCountText: itemCountEl?.textContent?.trim() ?? '(なし)',
      tileCount, tileClass,
      countEls,
      pagerEls,
      windowKeys,
      productClasses,
    };
  });

  console.log(`  itemCount     : ${listInfo.itemCountText}`);
  console.log(`  商品タイル数  : ${listInfo.tileCount} (${listInfo.tileClass})`);
  console.log(`  件数含む要素  :`);
  listInfo.countEls.forEach(e => console.log(`    <${e.tag} class="${e.cls}"> → "${e.text}"`));
  console.log(`  ページネーション要素:`);
  listInfo.pagerEls.forEach(e => console.log(`    <${e.tag} class="${e.cls}"> → "${e.text}"`));
  console.log(`  window数値変数: ${listInfo.windowKeys.join(', ') || '(なし)'}`);
  console.log(`  商品関連クラス: ${listInfo.productClasses.join(', ')}`);

  // ── 2. /maker/ ページ（確認済み手法）──
  console.log(`\n[2] メーカー一覧ページ: ${AIRCON_MAKER_URL}`);
  await page.goto(AIRCON_MAKER_URL, { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(2000);

  const makerInfo = await page.evaluate(() => {
    // /maker/ ページのブランドリンク
    const makerLinks = Array.from(document.querySelectorAll('a[href*="/category/"]'))
      .filter(a => /\/m\d/.test(a.href))
      .map(a => a.textContent.trim().replace(/\s+/g, ' '))
      .filter(t => t.length > 0);

    // div.brand の中身確認
    const brandDivs = Array.from(document.querySelectorAll('div.brand'))
      .slice(0, 5)
      .map(el => ({
        text: el.textContent.trim().slice(0, 40),
        html: el.innerHTML.slice(0, 100),
      }));

    // ページ構造確認
    const makerSectionEls = Array.from(document.querySelectorAll('[class*="maker"], [class*="brand"], [class*="Brand"]'))
      .filter(el => el.querySelectorAll('a').length > 2)
      .slice(0, 3)
      .map(el => ({
        tag: el.tagName,
        cls: el.className.slice(0, 60),
        linkCount: el.querySelectorAll('a').length,
        sample: Array.from(el.querySelectorAll('a')).slice(0, 5).map(a => a.textContent.trim()).join(' | '),
      }));

    return { makerCount: makerLinks.length, makerSample: makerLinks.slice(0, 12), brandDivs, makerSectionEls };
  });

  console.log(`  ブランド数    : ${makerInfo.makerCount}`);
  console.log(`  ブランドサンプル: ${makerInfo.makerSample.join(' / ')}`);
  console.log(`  div.brand サンプル:`);
  makerInfo.brandDivs.forEach(b => console.log(`    text="${b.text}"  html="${b.html}"`));
  console.log(`  メーカーセクション:`);
  makerInfo.makerSectionEls.forEach(e =>
    console.log(`    <${e.tag} class="${e.cls}"> links=${e.linkCount}  sample: ${e.sample}`)
  );

  await browser.close();
})();
