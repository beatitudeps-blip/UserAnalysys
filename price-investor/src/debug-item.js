/**
 * kakaku.com 商品ページ構造調査
 * 実行: node src/debug-item.js
 */
const { chromium } = require('playwright');
const fs   = require('fs');
const path = require('path');

const ITEM_URL = 'https://kakaku.com/item/K0001695178/';  // テスト商品
const SHOT_DIR = path.join(__dirname, '..', 'output', 'screenshots');
if (!fs.existsSync(SHOT_DIR)) fs.mkdirSync(SHOT_DIR, { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless: false, args: ['--disable-blink-features=AutomationControlled'] });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    locale: 'ja-JP', ignoreHTTPSErrors: true, viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();

  console.log(`アクセス: ${ITEM_URL}`);
  await page.goto(ITEM_URL, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(SHOT_DIR, 'item_page.png'), fullPage: true });

  // ── 価格テーブル周辺のHTML構造を調査 ──
  const info = await page.evaluate(() => {
    const result = {};

    // 試すセレクタ一覧
    const selectors = [
      '.priceTable', '#Prices', '.shopInfo', '.shopItemList',
      '.ckitanker', '.cShopPrice', '.tabContents',
      'table[class*="shop"]', 'table[class*="price"]',
      '[class*="shopList"]', '[class*="ShopList"]',
      '[class*="priceList"]', '[class*="PriceList"]',
      '[id*="price"]', '[id*="shop"]',
    ];

    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) {
        result[sel] = el.innerHTML.slice(0, 300).replace(/\s+/g, ' ');
      }
    }

    // すべてのテーブルのclass/id
    result['_tables'] = Array.from(document.querySelectorAll('table'))
      .map(t => ({ class: t.className, id: t.id, rows: t.rows.length }));

    // 「ヨドバシ」「エディオン」「Amazon」「ビック」を含む要素
    const keywords = ['ヨドバシ', 'エディオン', 'Amazon', 'ビックカメラ'];
    result['_shopElements'] = {};
    for (const kw of keywords) {
      const found = Array.from(document.querySelectorAll('*'))
        .find(el => el.children.length === 0 && el.textContent.trim().includes(kw));
      if (found) {
        result['_shopElements'][kw] = {
          tag:       found.tagName,
          class:     found.className,
          parent:    found.parentElement?.className,
          grandpa:   found.parentElement?.parentElement?.className,
        };
      }
    }

    return result;
  });

  console.log('\n=== セレクタ調査結果 ===');
  for (const [sel, val] of Object.entries(info)) {
    if (sel === '_tables') {
      console.log('\n--- テーブル一覧 ---');
      val.forEach(t => console.log(`  class="${t.class}" id="${t.id}" rows=${t.rows}`));
    } else if (sel === '_shopElements') {
      console.log('\n--- ショップ要素 ---');
      for (const [kw, el] of Object.entries(val)) {
        console.log(`  ${kw}: <${el.tag} class="${el.class}"> 親="${el.parent}" 祖父="${el.grandpa}"`);
      }
    } else {
      console.log(`\n[${sel}]\n  ${val}`);
    }
  }

  await browser.close();
  console.log(`\nスクリーンショット: ${SHOT_DIR}/item_page.png`);
})();
