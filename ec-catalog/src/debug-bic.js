/**
 * ビックカメラ サイト構造調査 v4 — ステルス対策強化
 * npm run debug:bic
 */
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({
    headless: false,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
      '--disable-dev-shm-usage',
    ],
  });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    locale: 'ja-JP',
    timezoneId: 'Asia/Tokyo',
    ignoreHTTPSErrors: true,
    viewport: { width: 1280, height: 900 },
    extraHTTPHeaders: {
      'Accept-Language': 'ja-JP,ja;q=0.9,en-US;q=0.8,en;q=0.7',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    },
  });

  // navigator.webdriver を隠す
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3] });
    Object.defineProperty(navigator, 'languages', { get: () => ['ja-JP', 'ja', 'en-US'] });
    window.chrome = { runtime: {} };
  });

  const page = await context.newPage();

  console.log('\n[Step1] ビックカメラ トップ');
  await page.goto('https://www.biccamera.com/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(4000);

  // ページ状態確認
  const state = await page.evaluate(() => ({
    url:       location.href,
    title:     document.title,
    bodyLen:   document.body.innerHTML.length,
    links:     document.querySelectorAll('a[href]').length,
    bodyText:  document.body.innerText.slice(0, 200).replace(/\s+/g, ' '),
  }));
  console.log('  URL    :', state.url);
  console.log('  タイトル:', state.title);
  console.log('  body長 :', state.bodyLen, '  リンク数:', state.links);
  console.log('  本文   :', state.bodyText);

  if (state.links === 0) {
    console.log('\n  → リンクなし。ブロックされている可能性あり。');
    await browser.close();
    return;
  }

  // リンク収集
  console.log('\n[Step2] リンク (先頭30件)');
  const links = await page.evaluate(() =>
    Array.from(document.querySelectorAll('a[href]'))
      .map(a => ({ text: a.textContent.trim().replace(/\s+/g, ' ').slice(0, 40), href: a.href }))
      .filter(a => a.text && a.href.startsWith('http'))
      .filter((a, i, arr) => arr.findIndex(b => b.href === a.href) === i)
      .slice(0, 30)
  );
  links.forEach(l => console.log(`  "${l.text}" => ${l.href}`));

  // URLパターン
  const patterns = await page.evaluate(() =>
    [...new Set(
      Array.from(document.querySelectorAll('a[href]'))
        .map(a => { try { const u = new URL(a.href); const p = u.pathname.split('/').filter(Boolean); return p.length ? `/${p[0]}/` : '/'; } catch { return null; } })
        .filter(Boolean)
    )]
  );
  console.log('\n[Step3] URLパスパターン:', patterns.join(', '));

  await browser.close();
})();
