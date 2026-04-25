/**
 * ヨドバシカメラ サイト構造調査 v9
 * npm run debug:yodobashi
 *
 * 目的: /maker/ ページのページネーションリンクの実際のhrefを確認
 */
const { chromium } = require('playwright');

const MAKER_URL = 'https://www.yodobashi.com/category/6353/maker/';

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

  console.log(`\n====== /maker/ ページ: ${MAKER_URL} ======`);
  await page.goto(MAKER_URL, { waitUntil: 'load', timeout: 30000 });

  // .inlineRow が出るまで最大10秒待つ
  try {
    await page.waitForSelector('.inlineRow', { timeout: 10000 });
    console.log('  .inlineRow: 検出 ✓');
  } catch {
    console.log('  .inlineRow: タイムアウト ❌');
  }

  const info = await page.evaluate(() => {
    // ページネーションリンクのhrefを全て取得
    const pagerLinks = Array.from(document.querySelectorAll('.inlineRow a, .cmnBtn a, a.btnBase'))
      .map(a => ({ text: a.textContent.trim().replace(/\s+/g, ' ').slice(0, 20), href: a.href }));

    // .inlineRow のテキスト
    const inlineRowText = document.querySelector('.inlineRow')?.innerText?.replace(/\s+/g, ' ').trim() || '(なし)';

    // ブランドリンク数
    const brandLinks = Array.from(document.querySelectorAll('a[href*="/category/"]'))
      .filter(a => /\/m\d/.test(a.href));

    // 現在のURL
    const currentUrl = location.href;

    return { pagerLinks, inlineRowText, brandLinkCount: brandLinks.length, currentUrl };
  });

  console.log(`\n  現在URL: ${info.currentUrl}`);
  console.log(`  .inlineRow テキスト: "${info.inlineRowText}"`);
  console.log(`  ブランドリンク数: ${info.brandLinkCount}`);
  console.log(`\n  ページネーションリンク (href付き):`);
  info.pagerLinks.forEach(l => console.log(`    "${l.text}" → ${l.href}`));

  await browser.close();
})();
