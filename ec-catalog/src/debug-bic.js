/**
 * ビックカメラ サイト構造調査
 * npm run debug:bic
 */
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false, args: ['--disable-blink-features=AutomationControlled'] });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    locale: 'ja-JP', ignoreHTTPSErrors: true, viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();

  console.log('=== ビックカメラ トップページ ナビ構造 ===');
  await page.goto('https://www.biccamera.com/bc/main/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);

  const info = await page.evaluate(() => {
    const navLinks = Array.from(document.querySelectorAll('a[href]'))
      .filter(a => /biccamera\.com\/bc\/c\//.test(a.href))
      .slice(0, 20)
      .map(a => ({ text: a.textContent.trim().slice(0, 30), href: a.href.slice(0, 100), cls: a.className.slice(0, 50) }));

    const navEls = Array.from(document.querySelectorAll('nav, [class*="nav"], [class*="Nav"]'))
      .slice(0, 5)
      .map(el => ({ tag: el.tagName, cls: el.className.slice(0, 80) }));

    return { navLinks, navEls };
  });

  console.log('\n--- カテゴリリンク (先頭20件) ---');
  info.navLinks.forEach(l => console.log(`  [${l.cls}] ${l.text} => ${l.href}`));
  console.log('\n--- nav要素サンプル ---');
  info.navEls.forEach(e => console.log(`  <${e.tag} class="${e.cls}">`));

  if (info.navLinks.length > 0) {
    console.log(`\n=== カテゴリページ構造調査: ${info.navLinks[0].href} ===`);
    await page.goto(info.navLinks[0].href, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);

    const catInfo = await page.evaluate(() => {
      const countEls = Array.from(document.querySelectorAll('*'))
        .filter(el => el.children.length === 0 && /\d+件/.test(el.textContent))
        .slice(0, 5)
        .map(el => ({ tag: el.tagName, cls: el.className.slice(0, 60), text: el.textContent.trim().slice(0, 40) }));

      const brandEls = Array.from(document.querySelectorAll('[class*="maker"], [class*="brand"], [class*="Brand"], [class*="Maker"]'))
        .slice(0, 5)
        .map(el => ({ tag: el.tagName, cls: el.className.slice(0, 60), liCount: el.querySelectorAll('li').length }));

      return { countEls, brandEls };
    });

    console.log('\n--- 件数表示要素 ---');
    catInfo.countEls.forEach(e => console.log(`  <${e.tag} class="${e.cls}"> ${e.text}`));
    console.log('\n--- ブランド絞り込み要素 ---');
    catInfo.brandEls.forEach(e => console.log(`  <${e.tag} class="${e.cls}"> li=${e.liCount}`));
  }

  await browser.close();
})();
