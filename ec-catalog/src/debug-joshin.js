/**
 * 上新電機（Joshin）サイト構造調査 v7
 * npm run debug:joshin
 *
 * 目的:
 *  1. 総商品数要素の確定（全XX件 or XX件ヒット）
 *  2. ブランドcate_listの件数ロジック確認
 *  3. ホームページからのカテゴリURL取得確認
 */
const { chromium } = require('playwright');

const URLS = {
  ホームページ:    'https://joshinweb.jp/',
  AV接続ケーブル:  'https://joshinweb.jp/kaden/307.html',
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

  // ── ホームページ: カテゴリURLを取得 ──
  console.log('\n====== ホームページ: カテゴリURL一覧 ======');
  await page.goto('https://joshinweb.jp/', { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(5000);

  const homeInfo = await page.evaluate(() => {
    // kaden/数字.html パターンのリンクを全収集
    const seen = new Set();
    const links = Array.from(document.querySelectorAll('a[href*="/kaden/"]'))
      .filter(a => /\/kaden\/\d+\.html$/.test(a.href))
      .map(a => ({ text: a.textContent.trim().replace(/\s+/g, ' '), href: a.href }))
      .filter(l => l.text && l.text.length > 1 && !seen.has(l.href) && seen.add(l.href));

    // maincategory_list 内のリンクも確認
    const mainCatLinks = Array.from(document.querySelectorAll('.maincategory_list a'))
      .map(a => ({ text: a.textContent.trim(), href: a.href }))
      .filter(l => l.text);

    return { kadenLinks: links.slice(0, 30), mainCatLinks: mainCatLinks.slice(0, 20) };
  });

  console.log(`  kaden/数字.html リンク: ${homeInfo.kadenLinks.length}件`);
  homeInfo.kadenLinks.slice(0, 15).forEach(l => console.log(`    ${l.href}  "${l.text}"`));
  console.log(`  maincategory_list リンク: ${homeInfo.mainCatLinks.length}件`);
  homeInfo.mainCatLinks.forEach(l => console.log(`    ${l.href}  "${l.text}"`));

  // ── 307.html (AV接続ケーブル): セレクタ確認 ──
  console.log('\n====== AV接続ケーブル: https://joshinweb.jp/kaden/307.html ======');
  await page.goto('https://joshinweb.jp/kaden/307.html', { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(8000);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
  await page.waitForTimeout(2000);

  const info = await page.evaluate(() => {
    if (document.querySelectorAll('*').length < 20) return { blocked: true };

    // 1. 総商品数: 子要素あり含めて「全XX件」「XX件中」「XX件ヒット」を広く探す
    const countCandidates = Array.from(document.querySelectorAll('*'))
      .filter(el => {
        const t = el.textContent.trim();
        return t.length < 60 && /全[\d,]+件|[\d,]+件[中ヒット]/.test(t);
      })
      .slice(0, 10)
      .map(el => ({ tag: el.tagName, cls: el.className.slice(0, 80), text: el.textContent.trim().slice(0, 60) }));

    // 2. div.search_container_price の数（ページ上の商品タイル数）
    const visibleProducts = document.querySelectorAll('div.search_container_price').length;

    // 3. cate_list のうち (数字) 含むものの詳細
    const brandCateList = Array.from(document.querySelectorAll('.cate_list'))
      .filter(el => /\(\d+\)/.test(el.textContent))
      .map(el => {
        const lis = el.querySelectorAll('li');
        const nums = Array.from(el.textContent.matchAll(/\((\d+)\)/g)).map(m => parseInt(m[1], 10));
        const total = nums.reduce((s, n) => s + n, 0);
        const sample = Array.from(lis).slice(0, 5).map(li => li.textContent.trim().slice(0, 20)).join(' | ');
        return { liCount: lis.length, numTotal: total, sample };
      });

    // 4. ページネーション（ページ数から総件数を推定）
    const pagerText = Array.from(document.querySelectorAll('[class*="pager"], [class*="page"], [class*="navi"]'))
      .filter(el => /\d+/.test(el.textContent))
      .slice(0, 5)
      .map(el => ({ cls: el.className.slice(0, 60), text: el.textContent.replace(/\s+/g, ' ').trim().slice(0, 120) }));

    // 5. 現在のページの div.price テキストサンプル（価格フォーマット再確認）
    const priceSamples = Array.from(document.querySelectorAll('div.price'))
      .slice(0, 5)
      .map(el => el.textContent.trim().slice(0, 30));

    // 6. ナビ内のkaden数字.htmlリンク（サイドカテゴリナビ）
    const seen = new Set();
    const sideLinks = Array.from(document.querySelectorAll('a[href*="/kaden/"]'))
      .filter(a => /\/kaden\/\d+\.html$/.test(a.href))
      .map(a => ({ text: a.textContent.trim().replace(/\s+/g, ' '), href: a.href }))
      .filter(l => l.text && l.text.length > 1 && !seen.has(l.href) && seen.add(l.href))
      .slice(0, 20);

    return { blocked: false, countCandidates, visibleProducts, brandCateList, pagerText, priceSamples, sideLinks };
  });

  if (info.blocked) {
    console.log('  !! ACCESS DENIED !!');
  } else {
    console.log(`  表示商品タイル数 (div.search_container_price): ${info.visibleProducts}`);
    console.log('  総商品数候補 (全XX件 / XX件中):');
    info.countCandidates.forEach(e => console.log(`    <${e.tag} class="${e.cls}"> "${e.text}"`));
    console.log('  ブランドcate_list:');
    info.brandCateList.forEach(e => console.log(`    li数=${e.liCount}  数字合計=${e.numTotal}  sample: ${e.sample}`));
    console.log('  ページネーション:');
    info.pagerText.forEach(e => console.log(`    [${e.cls}] "${e.text}"`));
    console.log('  価格サンプル:', info.priceSamples.join(' | '));
    console.log(`  サイド kaden リンク: ${info.sideLinks.length}件`);
    info.sideLinks.forEach(l => console.log(`    ${l.href}  "${l.text}"`));
  }

  await browser.close();
})();
