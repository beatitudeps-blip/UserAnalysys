/**
 * kakaku.com URL構造調査スクリプト v2
 * 実行: node src/debug-kakaku.js
 */
const { chromium } = require('playwright');
const fs   = require('fs');
const path = require('path');

const SHOT_DIR = path.join(__dirname, '..', 'output', 'screenshots');
if (!fs.existsSync(SHOT_DIR)) fs.mkdirSync(SHOT_DIR, { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless: false, args: ['--disable-blink-features=AutomationControlled'] });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    locale: 'ja-JP', ignoreHTTPSErrors: true, viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();

  // ── /ranking/ ページのカテゴリリンクを調査 ──
  console.log('\n=== /ranking/ ページ調査 ===');
  await page.goto('https://kakaku.com/ranking/', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(SHOT_DIR, 'ranking_top.png') });

  const rankingLinks = await page.evaluate(() =>
    Array.from(document.querySelectorAll('a[href*="ranking"]'))
      .map(a => ({ text: a.textContent.trim().replace(/\s+/g, ' ').slice(0, 50), href: a.href }))
      .filter(a => a.text && a.href.includes('kakaku.com'))
      .slice(0, 30)
  );
  console.log('ランキングリンク一覧:');
  rankingLinks.forEach(l => console.log(`  ${l.text} → ${l.href}`));

  // ── /kaden/ ページのサブカテゴリリンクを調査 ──
  console.log('\n=== /kaden/ ページ調査 ===');
  await page.goto('https://kakaku.com/kaden/', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(SHOT_DIR, 'kaden_top.png') });

  const kadenLinks = await page.evaluate(() =>
    Array.from(document.querySelectorAll('a'))
      .map(a => ({ text: a.textContent.trim().replace(/\s+/g, ' ').slice(0, 50), href: a.href }))
      .filter(a => a.text && /kakaku\.com\/(kaden|item|cat)/.test(a.href) && a.href !== 'https://kakaku.com/kaden/')
      .slice(0, 40)
  );
  console.log('/kaden/ サブカテゴリリンク:');
  kadenLinks.forEach(l => console.log(`  ${l.text} → ${l.href}`));

  // ── /ranking/ ページで家電カテゴリを直接クリックして遷移確認 ──
  console.log('\n=== ランキングページで家電カテゴリ選択 ===');
  await page.goto('https://kakaku.com/ranking/', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(2000);
  const kadenRankLink = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a'));
    const found = links.find(a => /家電|冷蔵庫|テレビ|洗濯/.test(a.textContent));
    return found ? { text: found.textContent.trim(), href: found.href } : null;
  });
  console.log('家電関連リンク:', kadenRankLink);

  await browser.close();
  console.log(`\nスクリーンショット保存先: ${SHOT_DIR}`);
})();
