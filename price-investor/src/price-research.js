/**
 * 価格コム 家電・電化製品 ランキング × EC価格比較
 *
 * 実行:
 *   npm start
 *
 * 出力:
 *   output/price-report-YYYY-MM-DD.md
 *   output/price-report-YYYY-MM-DD.csv
 */

const { chromium }          = require('playwright');
const { scrapeAllCategories } = require('./kakaku');
const { checkPrices }       = require('./ec-prices');
const { saveReports }       = require('./report');

const sleep = (a = 1200, b = 2500) =>
  new Promise(r => setTimeout(r, a + Math.floor(Math.random() * (b - a))));

(async () => {
  const date = new Date().toISOString().slice(0, 10);
  console.log(`=== 価格比較調査開始 ${date} ===\n`);

  const browser = await chromium.launch({
    headless: false,
    args: ['--disable-blink-features=AutomationControlled'],
  });

  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 900 },
    locale: 'ja-JP',
    ignoreHTTPSErrors: true,
  });

  const page = await context.newPage();

  // ── Phase 1: kakaku.com ランキング取得 ──
  console.log('【Phase 1】kakaku.com ランキング取得\n');
  const products = await scrapeAllCategories(page, sleep);
  console.log(`\n→ 合計 ${products.length} 商品を取得\n`);

  if (products.length === 0) {
    console.error('商品が取得できませんでした。ネットワーク接続を確認してください。');
    await browser.close();
    process.exit(1);
  }

  // ── Phase 2: EC各サイトで価格取得 ──
  console.log('【Phase 2】EC各サイト 価格調査\n');
  const results = [];
  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    console.log(`[${i + 1}/${products.length}] [${p.category}] ${p.name}`);
    const row = await checkPrices(page, p, sleep);
    results.push(row);
    await sleep(1500, 2500);
  }

  await browser.close();

  // ── Phase 3: レポート出力 ──
  console.log('\n【Phase 3】レポート生成');
  saveReports(results, date);

  console.log('\n=== 完了 ===');
})();
