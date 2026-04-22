/**
 * 家電カテゴリ ランキング商品 価格比較スクリプト
 *
 * 実行方法（ローカルPC推奨）:
 *   node price-research.js
 *
 * 依存:
 *   npm install playwright
 *   npx playwright install chromium
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// ──────────────────────────────────────────────
// 調査対象商品リスト（kakaku.com ランキング上位 代表モデル）
// 必要に応じて書き換えてください
// ──────────────────────────────────────────────
const PRODUCTS = [
  { category: 'テレビ',     name: 'Sony BRAVIA XRJ-55X90L' },
  { category: 'テレビ',     name: 'SHARP AQUOS 4T-C50FN1' },
  { category: '冷蔵庫',     name: 'Panasonic NR-F536HPX' },
  { category: '冷蔵庫',     name: 'SHARP SJ-SF50L' },
  { category: '洗濯機',     name: 'Panasonic NA-FA11K3' },
  { category: '洗濯機',     name: 'SHARP ES-GV12H' },
  { category: 'エアコン',   name: 'Panasonic CS-X402D2' },
  { category: 'エアコン',   name: 'Daikin AN40YRP' },
  { category: '電子レンジ', name: 'Panasonic NE-BS807' },
  { category: '電子レンジ', name: 'SHARP RE-SS10A' },
  { category: '掃除機',     name: 'Dyson V15 Detect Absolute' },
  { category: '掃除機',     name: 'iRobot Roomba j9+' },
  { category: '炊飯器',     name: 'Panasonic SR-VSX181' },
  { category: '炊飯器',     name: 'SHARP KS-CF10B' },
  { category: 'ドライヤー', name: 'Panasonic EH-NA0J' },
  { category: 'ドライヤー', name: 'Dyson Supersonic HD08' },
];

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const rand  = (a = 1200, b = 2500) => sleep(a + Math.floor(Math.random() * (b - a)));

// ──────────────────────────────────────────────
// 共通: ページから最初の価格テキストを取得
// ──────────────────────────────────────────────
async function firstPrice(page, selectors) {
  return page.evaluate((sels) => {
    for (const sel of sels) {
      const els = document.querySelectorAll(sel);
      for (const el of els) {
        const t = el.textContent.trim().replace(/\s+/g, '');
        // 数字と円記号・カンマを含む文字列だけ採用
        if (/[¥￥,\d]/.test(t) && t.length < 30) return t;
      }
    }
    return '取得不可';
  }, selectors);
}

// ──────────────────────────────────────────────
// エディオン
// ──────────────────────────────────────────────
async function getEdion(page, query) {
  try {
    await page.goto(
      `https://www.edion.com/search/?q=${encodeURIComponent(query)}`,
      { waitUntil: 'domcontentloaded', timeout: 20000 }
    );
    await rand(800, 1500);
    return await firstPrice(page, [
      '.selling_price', '.item_price .price', '.p-price__main',
      '[class*="price"]', '.Price',
    ]);
  } catch { return 'エラー'; }
}

// ──────────────────────────────────────────────
// ヨドバシ
// ──────────────────────────────────────────────
async function getYodobashi(page, query) {
  try {
    await page.goto(
      `https://www.yodobashi.com/?word=${encodeURIComponent(query)}`,
      { waitUntil: 'domcontentloaded', timeout: 20000 }
    );
    await rand(800, 1500);
    // 検索結果ページで最初の商品価格を取得
    await page.waitForSelector('.priceSingle, .price, .js-refine-submit', {
      timeout: 5000,
    }).catch(() => {});
    return await firstPrice(page, [
      '.priceSingle', '.productPrice', '.price strong',
      '[class*="price"]',
    ]);
  } catch { return 'エラー'; }
}

// ──────────────────────────────────────────────
// Amazon.co.jp
// ──────────────────────────────────────────────
async function getAmazon(page, query) {
  try {
    await page.goto(
      `https://www.amazon.co.jp/s?k=${encodeURIComponent(query)}&i=electronics`,
      { waitUntil: 'domcontentloaded', timeout: 20000 }
    );
    await rand(1000, 2000);
    return await page.evaluate(() => {
      // a-price-whole + fraction を結合
      const whole = document.querySelector(
        '.s-result-item:not([data-asin=""]) .a-price-whole'
      );
      const frac  = document.querySelector(
        '.s-result-item:not([data-asin=""]) .a-price-fraction'
      );
      if (whole) return '¥' + whole.textContent.trim().replace(/[^\d,]/g, '') +
                        (frac ? frac.textContent.trim() : '');
      const off = document.querySelector('.a-offscreen');
      return off ? off.textContent.trim() : '取得不可';
    });
  } catch { return 'エラー'; }
}

// ──────────────────────────────────────────────
// ビックカメラ
// ──────────────────────────────────────────────
async function getBic(page, query) {
  try {
    await page.goto(
      `https://www.biccamera.com/bc/category/search.jsp?q=${encodeURIComponent(query)}`,
      { waitUntil: 'domcontentloaded', timeout: 20000 }
    );
    await rand(800, 1500);
    return await firstPrice(page, [
      '.js-item-price', '.real_price', '.item-price',
      '.price_box .price', '[class*="price"]',
    ]);
  } catch { return 'エラー'; }
}

// ──────────────────────────────────────────────
// メイン
// ──────────────────────────────────────────────
(async () => {
  console.log('ブラウザを起動中...\n');

  const browser = await chromium.launch({
    headless: false,
    args: [
      '--no-sandbox',
      '--disable-blink-features=AutomationControlled',
    ],
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
  const results = [];

  for (const product of PRODUCTS) {
    console.log(`\n[${product.category}] ${product.name}`);

    const row = { ...product, edion: null, yodobashi: null, amazon: null, bic: null };

    console.log('  → Edion...');
    row.edion = await getEdion(page, product.name);
    console.log(`     ${row.edion}`);
    await rand();

    console.log('  → Yodobashi...');
    row.yodobashi = await getYodobashi(page, product.name);
    console.log(`     ${row.yodobashi}`);
    await rand();

    console.log('  → Amazon...');
    row.amazon = await getAmazon(page, product.name);
    console.log(`     ${row.amazon}`);
    await rand();

    console.log('  → Bic Camera...');
    row.bic = await getBic(page, product.name);
    console.log(`     ${row.bic}`);
    await rand();

    results.push(row);
  }

  await browser.close();

  // ── Markdown 出力 ──
  const date = new Date().toISOString().slice(0, 10);
  const categories = [...new Set(results.map(r => r.category))];

  let md = `# 家電カテゴリ 人気商品 価格比較\n\n調査日: ${date}\n\n`;

  for (const cat of categories) {
    md += `## ${cat}\n\n`;
    md += `| 商品名 | エディオン | ヨドバシ | Amazon | ビックカメラ |\n`;
    md += `|--------|----------|---------|--------|------------|\n`;
    for (const r of results.filter(r => r.category === cat)) {
      md += `| ${r.name} | ${r.edion ?? '-'} | ${r.yodobashi ?? '-'} | ${r.amazon ?? '-'} | ${r.bic ?? '-'} |\n`;
    }
    md += '\n';
  }

  const outPath = path.join(__dirname, `price-list-${date}.md`);
  fs.writeFileSync(outPath, md, 'utf-8');

  console.log(`\n✓ 結果を保存しました: ${outPath}`);
  console.log('\n' + md);
})();
