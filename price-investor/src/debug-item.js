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

  // li.p-priceList_item が出るまで待機（遅延ロード対応）
  await page.waitForSelector('li.p-priceList_item', { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(1500);

  // ── 実際のアイテム行を詳細調査 ──
  const info = await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll('li.p-priceList_item'));

    // 先頭3件のHTML
    const sampleRows = items.slice(0, 3).map(li => ({
      outerHTML: li.outerHTML.replace(/\s+/g, ' ').slice(0, 600),
    }));

    // 全ショップ名と価格を抽出
    const shops = items.map(li => {
      const shopEl    = li.querySelector('.p-priceList_shopNameSub');
      const priceEl   = li.querySelector('.p-priceList_priceMain');
      const currEl    = li.querySelector('.p-priceList_currency');
      const priceCont = li.querySelector('.p-priceList_priceCont');
      return {
        shop:      shopEl?.textContent.trim() ?? '',
        priceMain: priceEl?.textContent.trim().replace(/\s+/g, '') ?? '',
        currency:  currEl?.textContent.trim() ?? '',
        priceCont: priceCont?.textContent.trim().replace(/\s+/g, ' ') ?? '',
      };
    }).filter(r => r.shop);

    return { itemCount: items.length, sampleRows, shops };
  });

  console.log(`\nアイテム数: ${info.itemCount}`);
  console.log('\n--- サンプルHTML (先頭3件) ---');
  info.sampleRows.forEach((r, i) => console.log(`\n[${i}]\n${r.outerHTML}`));
  console.log('\n--- 全ショップ価格 ---');
  info.shops.forEach(s => console.log(`  shop="${s.shop}" currency="${s.currency}" priceMain="${s.priceMain}" priceCont="${s.priceCont}"`));

  await browser.close();
  console.log(`\nスクリーンショット: ${SHOT_DIR}/item_page.png`);
})();
