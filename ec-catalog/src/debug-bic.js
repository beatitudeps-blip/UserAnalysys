/**
 * ビックカメラ サイト構造調査 v3
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

  // ── Step1: ページ基本情報 ──
  console.log('\n[Step1] ページ基本情報');
  await page.goto('https://www.biccamera.com/', { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(5000); // JS描画を十分に待つ

  const basicInfo = await page.evaluate(() => ({
    url:        location.href,
    title:      document.title,
    bodyLen:    document.body.innerHTML.length,
    linkCount:  document.querySelectorAll('a[href]').length,
  }));
  console.log('  URL    :', basicInfo.url);
  console.log('  タイトル:', basicInfo.title);
  console.log('  body長 :', basicInfo.bodyLen);
  console.log('  リンク数:', basicInfo.linkCount);

  // ── Step2: 全リンク収集 ──
  console.log('\n[Step2] 全リンク (先頭40件)');
  const links = await page.evaluate(() =>
    Array.from(document.querySelectorAll('a[href]'))
      .map(a => ({ text: a.textContent.trim().replace(/\s+/g, ' ').slice(0, 40), href: a.href }))
      .filter(a => a.text && a.href.startsWith('http'))
      .filter((a, i, arr) => arr.findIndex(b => b.href === a.href) === i)
      .slice(0, 40)
  );
  links.forEach(l => console.log(`  "${l.text}" => ${l.href}`));

  // ── Step3: URLパスパターン ──
  const patterns = await page.evaluate(() =>
    [...new Set(
      Array.from(document.querySelectorAll('a[href]'))
        .map(a => { try { const u = new URL(a.href); const p = u.pathname.split('/').filter(Boolean); return p.length ? `/${p[0]}/` : '/'; } catch { return null; } })
        .filter(Boolean)
    )]
  );
  console.log('\n[Step3] URLパスパターン:', patterns.join(', '));

  // ── Step4: ナビ/ヘッダー要素 ──
  console.log('\n[Step4] ナビ/ヘッダー要素');
  const navInfo = await page.evaluate(() =>
    Array.from(document.querySelectorAll('nav, header, [class*="nav" i], [class*="menu" i], [class*="gnav" i], [class*="header" i]'))
      .slice(0, 6)
      .map(el => ({
        tag: el.tagName,
        cls: el.className?.toString().slice(0, 80) ?? '',
        links: el.querySelectorAll('a').length,
        sample: Array.from(el.querySelectorAll('a')).slice(0, 4)
          .map(a => `"${a.textContent.trim().slice(0,20)}" ${a.href.slice(0,80)}`),
      }))
  );
  navInfo.forEach(e => {
    console.log(`  <${e.tag} class="${e.cls}"> links=${e.links}`);
    e.sample.forEach(s => console.log(`    ${s}`));
  });

  // ── Step5: スクロール後に再確認 ──
  console.log('\n[Step5] スクロール後のリンク数');
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
  await page.waitForTimeout(2000);
  const linkCountAfterScroll = await page.evaluate(() => document.querySelectorAll('a[href]').length);
  console.log('  リンク数:', linkCountAfterScroll);

  // ── Step6: ページHTML先頭500文字を確認 ──
  const bodySnippet = await page.evaluate(() => document.body.innerHTML.slice(0, 500).replace(/\s+/g, ' '));
  console.log('\n[Step6] body HTML先頭500文字:');
  console.log(bodySnippet);

  await browser.close();
})();
