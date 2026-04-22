/**
 * エディオン サイト構造調査
 * npm run debug:edion
 */
const { chromium } = require('playwright');

const TOP_URL = 'https://www.edion.com/';

(async () => {
  const browser = await chromium.launch({ headless: false, args: ['--disable-blink-features=AutomationControlled'] });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    locale: 'ja-JP', ignoreHTTPSErrors: true, viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();

  // ── Step1: トップページのカテゴリリンク ──
  console.log(`\n[Step1] トップページ: ${TOP_URL}`);
  await page.goto(TOP_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);

  const topInfo = await page.evaluate(() => {
    const allLinks = Array.from(document.querySelectorAll('a[href]'))
      .map(a => ({ text: a.textContent.trim().replace(/\s+/g, ' ').slice(0, 40), href: a.href }))
      .filter(a => a.text && a.href.includes('edion.com'));

    // URLパターンを調査
    const urlPatterns = [...new Set(
      allLinks.map(a => {
        const m = a.href.match(/edion\.com(\/[^/?#]+\/)/);
        return m ? m[1] : null;
      }).filter(Boolean)
    )].slice(0, 20);

    // カテゴリっぽいリンク
    const catLinks = allLinks
      .filter(a => /\/(list|category|cat|genre)\//i.test(a.href) ||
                   /edion\.com\/[A-Z0-9]{5,}/.test(a.href))
      .filter((a, i, arr) => arr.findIndex(b => b.href === a.href) === i)
      .slice(0, 20);

    return { urlPatterns, catLinks, totalLinks: allLinks.length };
  });

  console.log(`  総リンク数: ${topInfo.totalLinks}`);
  console.log('  URLパターン:', topInfo.urlPatterns.join(', '));
  console.log('  カテゴリっぽいリンク:');
  topInfo.catLinks.forEach(l => console.log(`    "${l.text}" => ${l.href}`));

  // ── Step2: 全リンクを確認（カテゴリURL特定のため）──
  const allCatLinks = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('a[href*="edion"]'))
      .map(a => ({ text: a.textContent.trim().replace(/\s+/g, ' ').slice(0, 30), href: a.href }))
      .filter(a => a.text.length > 0)
      .filter((a, i, arr) => arr.findIndex(b => b.href === a.href) === i)
      .slice(0, 30);
  });

  console.log('\n[Step2] 全エディオンリンク (先頭30件):');
  allCatLinks.forEach(l => console.log(`  "${l.text}" => ${l.href}`));

  // ── Step3: カテゴリページが見つかれば調査 ──
  const catUrl = topInfo.catLinks[0]?.href;
  if (catUrl) {
    console.log(`\n[Step3] カテゴリページ調査: ${catUrl}`);
    await page.goto(catUrl, { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(3000);
    await page.evaluate(() => window.scrollTo(0, 600));
    await page.waitForTimeout(1500);

    const catInfo = await page.evaluate(() => {
      const countEls = Array.from(document.querySelectorAll('*'))
        .filter(el => el.children.length === 0 && /[\d,]+件/.test(el.textContent))
        .slice(0, 8)
        .map(el => ({ tag: el.tagName, cls: el.className.slice(0, 80), text: el.textContent.trim() }));

      const tileSelectors = [
        '[class*="itemList"] li', '[class*="productList"] li',
        '[class*="listItem"]', '[class*="searchResult"] li',
        '[class*="item-list"] li', '.productItem',
      ];
      let tileCount = 0, tileClass = '';
      for (const sel of tileSelectors) {
        const items = document.querySelectorAll(sel);
        if (items.length > 0) { tileCount = items.length; tileClass = sel; break; }
      }

      const brandEls = Array.from(document.querySelectorAll('[class*="maker"], [class*="brand"], [class*="Brand"], [class*="Maker"]'))
        .filter(el => el.querySelectorAll('a, li').length > 0)
        .slice(0, 5)
        .map(el => ({
          tag: el.tagName, cls: el.className.slice(0, 80),
          linkCount: el.querySelectorAll('a').length,
          sample: Array.from(el.querySelectorAll('a')).slice(0, 5).map(i => i.textContent.trim()).join(' | '),
        }));

      const allClasses = [...new Set(
        Array.from(document.querySelectorAll('*')).map(el => el.className)
          .filter(c => typeof c === 'string').join(' ').split(/\s+/)
      )].filter(c => /maker|brand|count|total|result|filter|product|item/i.test(c)).slice(0, 30);

      return { countEls, tileCount, tileClass, brandEls, allClasses };
    });

    console.log('  件数含む要素:');
    catInfo.countEls.forEach(e => console.log(`    <${e.tag} class="${e.cls}"> → "${e.text}"`));
    console.log(`  商品タイル数: ${catInfo.tileCount} (${catInfo.tileClass})`);
    console.log('  ブランド要素:');
    catInfo.brandEls.forEach(e =>
      console.log(`    <${e.tag} class="${e.cls}"> links=${e.linkCount}  sample: ${e.sample}`)
    );
    console.log('  関連クラス名:', catInfo.allClasses.join(', '));
  }

  await browser.close();
})();
