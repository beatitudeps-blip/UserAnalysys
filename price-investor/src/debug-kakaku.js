/**
 * kakaku.com URL構造調査スクリプト
 * 実行: node src/debug-kakaku.js
 * → output/screenshots/ にスクリーンショットを保存
 */
const { chromium } = require('playwright');
const fs   = require('fs');
const path = require('path');

const SHOT_DIR = path.join(__dirname, '..', 'output', 'screenshots');
if (!fs.existsSync(SHOT_DIR)) fs.mkdirSync(SHOT_DIR, { recursive: true });

const URLS = [
  'https://kakaku.com/',
  'https://kakaku.com/kaden/tv/',
  'https://kakaku.com/kaden/tv/ranking/',
  'https://kakaku.com/ranking/',
  'https://kakaku.com/ranking_category/104/',
  'https://kakaku.com/kaden/',
];

(async () => {
  const browser = await chromium.launch({ headless: false, args: ['--disable-blink-features=AutomationControlled'] });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    locale: 'ja-JP', ignoreHTTPSErrors: true, viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();

  for (const url of URLS) {
    const label = url.replace(/[^a-z0-9]/gi, '_').slice(0, 40);
    process.stdout.write(`${url} → `);
    try {
      const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForTimeout(2000);
      const status = res.status();
      const finalUrl = page.url();
      const title = await page.title();
      const shot = path.join(SHOT_DIR, `${label}.png`);
      await page.screenshot({ path: shot });
      console.log(`${status} | ${title} | 最終URL: ${finalUrl}`);
    } catch (e) {
      console.log(`ERROR: ${e.message.split('\n')[0]}`);
    }
  }

  // テレビカテゴリページでランキングリンクを探す
  console.log('\n--- テレビページのランキング関連リンクを調査 ---');
  await page.goto('https://kakaku.com/kaden/tv/', { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2000);
  const rankLinks = await page.evaluate(() =>
    Array.from(document.querySelectorAll('a'))
      .filter(a => /ランキング|ranking|rank/i.test(a.textContent + a.href))
      .slice(0, 10)
      .map(a => ({ text: a.textContent.trim().slice(0, 40), href: a.href }))
  );
  console.log('ランキング関連リンク:', JSON.stringify(rankLinks, null, 2));

  await browser.close();
  console.log(`\nスクリーンショット: ${SHOT_DIR}`);
})();
