/**
 * EC カテゴリ別 ブランド数・商品数カウンター
 *
 * 実行:
 *   npm run local          # 全サイト
 *   node src/main.js yodobashi   # 1サイトのみ
 *
 * 出力:
 *   output/ec-catalog-YYYY-MM-DD.md
 *   output/ec-catalog-YYYY-MM-DD.csv
 */

const { chromium }    = require('playwright');
const { scrape: scrapeYodobashi } = require('./yodobashi');
const { scrape: scrapeEdion }    = require('./edion');
const { scrape: scrapeJoshin }   = require('./joshin');
const { saveReports }            = require('./report');

const sleep = (a = 1200, b = 2500) =>
  new Promise(r => setTimeout(r, a + Math.floor(Math.random() * (b - a))));

// コマンドライン引数でサイトを絞れる: node src/main.js yodobashi edion joshin
const targetArg = process.argv.slice(2).map(s => s.toLowerCase());
const ALL_SCRAPERS = [
  { key: 'yodobashi', label: 'ヨドバシカメラ',  fn: scrapeYodobashi },
  { key: 'edion',     label: 'エディオン',      fn: scrapeEdion },
  { key: 'joshin',    label: '上新電機',        fn: scrapeJoshin },
];

function resolveScrapers() {
  if (targetArg.length === 0) return [
    { label: 'ヨドバシカメラ', fn: scrapeYodobashi },
    { label: 'エディオン',     fn: scrapeEdion },
    { label: '上新電機',       fn: scrapeJoshin },
  ];
  const chosen = [];
  for (const arg of targetArg) {
    const found = ALL_SCRAPERS.find(s => s.key === arg);
    if (found && !chosen.some(c => c.fn === found.fn)) chosen.push(found);
  }
  return chosen;
}

(async () => {
  const date = new Date().toISOString().slice(0, 10);
  const scrapers = resolveScrapers();
  console.log(`=== EC カテゴリ調査開始 ${date} ===`);
  console.log(`対象: ${scrapers.map(s => s.label).join(' / ')}\n`);

  const browser = await chromium.launch({
    headless: false,
    ignoreDefaultArgs: ['--enable-automation'],
    args: ['--disable-blink-features=AutomationControlled', '--no-sandbox'],
  });
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 900 },
    locale: 'ja-JP',
    timezoneId: 'Asia/Tokyo',
    ignoreHTTPSErrors: true,
  });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    window.chrome = { runtime: {} };
  });
  const page = await context.newPage();

  const allResults = [];
  for (const { fn } of scrapers) {
    const rows = await fn(page, sleep);
    allResults.push(...rows);
    await sleep(2000, 3000);
  }

  await browser.close();

  console.log('\n【レポート生成】');
  saveReports(allResults, date);
  console.log('\n=== 完了 ===');
})();
