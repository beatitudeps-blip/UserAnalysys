/**
 * ビックカメラ サイト構造調査 v2
 * npm run debug:bic
 */
const { chromium } = require('playwright');

const TOP_URL = 'https://www.biccamera.com/bc/main/';

(async () => {
  const browser = await chromium.launch({ headless: false, args: ['--disable-blink-features=AutomationControlled'] });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    locale: 'ja-JP', ignoreHTTPSErrors: true, viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();

  console.log(`\n[Step1] トップページ全リンク調査: ${TOP_URL}`);
  await page.goto(TOP_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);

  const topInfo = await page.evaluate(() => {
    // ページ内の全リンク（先頭50件）
    const allLinks = Array.from(document.querySelectorAll('a[href]'))
      .map(a => ({ text: a.textContent.trim().replace(/\s+/g, ' ').slice(0, 40), href: a.href }))
      .filter(a => a.text.length > 0 && a.href.startsWith('http'))
      .filter((a, i, arr) => arr.findIndex(b => b.href === a.href) === i)
      .slice(0, 50);

    // URLのパス第1・第2セグメントのパターン
    const urlPatterns = [...new Set(
      Array.from(document.querySelectorAll('a[href]'))
        .map(a => {
          try {
            const u = new URL(a.href);
            const parts = u.pathname.split('/').filter(Boolean);
            return parts.length >= 2 ? `/${parts[0]}/${parts[1]}/` : `/${parts[0]}/`;
          } catch { return null; }
        })
        .filter(Boolean)
    )].slice(0, 30);

    // nav/ナビ系要素
    const navEls = Array.from(document.querySelectorAll('nav, header, [class*="nav"], [class*="Nav"], [class*="menu"], [class*="Menu"]'))
      .slice(0, 8)
      .map(el => ({
        tag: el.tagName,
        cls: el.className.slice(0, 80),
        linkCount: el.querySelectorAll('a').length,
        sampleLinks: Array.from(el.querySelectorAll('a')).slice(0, 5)
          .map(a => `"${a.textContent.trim().slice(0,20)}" ${a.href.slice(0, 80)}`),
      }));

    return { allLinks, urlPatterns, navEls };
  });

  console.log('  全リンク (先頭50件):');
  topInfo.allLinks.forEach(l => console.log(`    "${l.text}" => ${l.href}`));
  console.log('\n  URLパス パターン:');
  topInfo.urlPatterns.forEach(p => console.log(`    ${p}`));
  console.log('\n  ナビ要素:');
  topInfo.navEls.forEach(e => {
    console.log(`  <${e.tag} class="${e.cls}"> links=${e.linkCount}`);
    e.sampleLinks.forEach(s => console.log(`      ${s}`));
  });

  await browser.close();
})();
