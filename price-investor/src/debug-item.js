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

  // ── p-priceList_ クラスの構造を詳細調査 ──
  const info = await page.evaluate(() => {
    // priceList 配下のアイテムを取得
    const listItems = document.querySelectorAll('[class*="p-priceList_item"], [class*="p-priceList"] li');
    console.log('listItems count:', listItems.length);

    const rows = [];
    for (const li of Array.from(listItems).slice(0, 5)) {
      rows.push({
        outerHTML: li.outerHTML.replace(/\s+/g, ' ').slice(0, 500),
      });
    }

    // p-priceList_ で始まるクラスを全収集
    const priceClasses = new Set();
    document.querySelectorAll('[class*="p-priceList_"]').forEach(el => {
      el.className.split(' ').filter(c => c.startsWith('p-priceList_')).forEach(c => priceClasses.add(c));
    });

    // 価格らしい要素 (¥ を含む) の情報
    const priceEls = Array.from(document.querySelectorAll('[class*="p-priceList_"]'))
      .filter(el => /[¥￥]/.test(el.textContent))
      .slice(0, 5)
      .map(el => ({ class: el.className, text: el.textContent.trim().replace(/\s+/g, ' ').slice(0, 50) }));

    return {
      listItemCount: listItems.length,
      sampleRows: rows,
      priceListClasses: [...priceClasses].sort(),
      priceElements: priceEls,
    };
  });

  console.log('\n=== p-priceList_ 構造調査 ===');
  console.log(`リストアイテム数: ${info.listItemCount}`);
  console.log('\n--- p-priceList_ クラス一覧 ---');
  info.priceListClasses.forEach(c => console.log('  ' + c));
  console.log('\n--- 価格要素 (¥含む) ---');
  info.priceElements.forEach(e => console.log(`  class="${e.class}"\n    text="${e.text}"`));
  console.log('\n--- サンプルHTML (先頭5件) ---');
  info.sampleRows.forEach((r, i) => console.log(`\n[${i}] ${r.outerHTML}`));

  await browser.close();
  console.log(`\nスクリーンショット: ${SHOT_DIR}/item_page.png`);
})();
