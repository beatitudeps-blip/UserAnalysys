/**
 * エディオン サイト構造調査 v2
 * npm run debug:edion
 *
 * 前回: URLパターン /member/ /guide/ /order/ /e_store/ のみ検出 → 商品カテゴリなし
 * 今回: JS描画後・ナビ操作・直接カテゴリURL試行
 */
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({
    headless: false,
    ignoreDefaultArgs: ['--enable-automation'],
    args: ['--disable-blink-features=AutomationControlled', '--no-sandbox'],
  });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    locale: 'ja-JP', timezoneId: 'Asia/Tokyo',
    ignoreHTTPSErrors: true, viewport: { width: 1280, height: 900 },
  });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    window.chrome = { runtime: {} };
  });
  const page = await context.newPage();

  // ── Step1: トップページをJS描画完了まで待機 ──
  console.log('\n[Step1] エディオン トップ (JS待機5秒)');
  await page.goto('https://www.edion.com/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(5000);

  // ナビゲーションをクリックして展開を試みる
  const navBtn = page.locator('[class*="hamburger"], [class*="menu-btn"], [class*="navBtn"], [class*="gnavBtn"]').first();
  if (await navBtn.isVisible().catch(() => false)) {
    console.log('  ハンバーガーメニューをクリック');
    await navBtn.click().catch(() => {});
    await page.waitForTimeout(2000);
  }

  const topInfo = await page.evaluate(() => {
    const allLinks = Array.from(document.querySelectorAll('a[href]'))
      .map(a => ({ text: a.textContent.trim().replace(/\s+/g, ' ').slice(0, 40), href: a.href }))
      .filter(a => a.text && a.href.startsWith('http'));

    // edion.com 内リンクのURLパスパターン
    const edionLinks = allLinks.filter(a => a.href.includes('edion.com'));
    const patterns = [...new Set(
      edionLinks.map(a => { try { const u = new URL(a.href); const p = u.pathname.split('/').filter(Boolean); return p.length ? `/${p[0]}/` : '/'; } catch { return null; } }).filter(Boolean)
    )];

    // 商品・カテゴリっぽいリンク
    const catLinks = edionLinks
      .filter(a => /\/(product|item|list|category|genre|search|kaden|tv|pc|camera)/i.test(a.href))
      .filter((a, i, arr) => arr.findIndex(b => b.href === a.href) === i)
      .slice(0, 20);

    // edion.com の全リンク先頭40件
    const allEdionLinks = edionLinks
      .filter((a, i, arr) => arr.findIndex(b => b.href === a.href) === i)
      .slice(0, 40);

    return { patterns, catLinks, allEdionLinks, totalLinks: allLinks.length };
  });

  console.log(`  総リンク数: ${topInfo.totalLinks}`);
  console.log('  URLパターン:', topInfo.patterns.join(', '));
  console.log('  商品カテゴリ候補:', topInfo.catLinks.length > 0 ? '' : '(なし)');
  topInfo.catLinks.forEach(l => console.log(`    "${l.text}" => ${l.href}`));
  console.log('\n  全edionリンク (先頭40件):');
  topInfo.allEdionLinks.forEach(l => console.log(`    "${l.text}" => ${l.href}`));

  // ── Step2: 直接URLでカテゴリページを試す ──
  const trialUrls = [
    'https://www.edion.com/search/result/?category=01',
    'https://www.edion.com/list/',
    'https://www.edion.com/item/',
    'https://www.edion.com/kaden/',
    'https://www.edion.com/category/',
  ];

  console.log('\n[Step2] 直接URLでカテゴリページを試行');
  for (const url of trialUrls) {
    try {
      const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 });
      const status = res?.status();
      const title = await page.title();
      const linkCount = await page.evaluate(() => document.querySelectorAll('a[href]').length);
      console.log(`  ${url}`);
      console.log(`    status=${status}  title="${title}"  links=${linkCount}`);
      if (status === 200 && linkCount > 10) {
        // このURLが有効そう → 詳細調査
        await page.waitForTimeout(2000);
        const info = await page.evaluate(() => {
          const countEls = Array.from(document.querySelectorAll('*'))
            .filter(el => el.children.length === 0 && /[\d,]+件/.test(el.textContent))
            .slice(0, 3).map(el => el.textContent.trim());
          const sample = Array.from(document.querySelectorAll('a[href]'))
            .slice(0, 5).map(a => `"${a.textContent.trim().slice(0,20)}" ${a.href}`);
          return { countEls, sample };
        });
        if (info.countEls.length > 0) console.log('    件数:', info.countEls.join(', '));
        info.sample.forEach(s => console.log('    ', s));
      }
    } catch (e) {
      console.log(`  ${url} → エラー: ${e.message.split('\n')[0]}`);
    }
  }

  await browser.close();
})();
