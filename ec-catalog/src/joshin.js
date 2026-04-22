/**
 * 上新電機（Joshin）カテゴリ別ブランド数・商品数スクレイパー
 * https://joshinweb.jp/
 *
 * ※ セレクタは debug-joshin.js の調査結果で確定後に更新
 */

const SITE = 'joshin';

async function fetchCategories(page, sleep) {
  await page.goto('https://joshinweb.jp/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(1500, 2000);

  return page.evaluate(() => {
    const cats = Array.from(document.querySelectorAll('a[href]'))
      .filter(a => a.href.includes('joshinweb.jp') &&
                   !/\/(cart|login|mypage|help|company|static|common|img)/i.test(a.href))
      .map(a => ({
        name: a.textContent.trim().replace(/\s+/g, ' '),
        url:  a.href.split('?')[0].replace(/\/?$/, '/'),
      }))
      .filter(c => c.name.length > 0 && c.url !== 'https://joshinweb.jp/')
      .filter((c, i, arr) => arr.findIndex(b => b.url === c.url) === i);
    return cats;
  });
}

async function fetchCategoryStats(page, category, sleep) {
  try {
    const res = await page.goto(category.url, { waitUntil: 'load', timeout: 30000 });
    if (!res || res.status() !== 200) return null;
    await sleep(1500, 2000);
    await page.evaluate(() => window.scrollTo(0, 600));
    await sleep(800, 1200);

    return page.evaluate(() => {
      // 商品数: 「件」含む要素（debug調査後に確定）
      let productCount = null;
      const countEls = Array.from(document.querySelectorAll('*'))
        .filter(el => el.children.length === 0 && /[\d,]+件/.test(el.textContent));
      if (countEls.length > 0) {
        const m = countEls[0].textContent.match(/[\d,]+/);
        if (m) productCount = parseInt(m[0].replace(',', ''), 10);
      }

      // ブランド数: debug調査後に確定
      let brandCount = null;
      const brandSelectors = [
        '[class*="maker"] a', '[class*="brand"] a',
        '[class*="Maker"] a', '[class*="Brand"] a',
      ];
      for (const sel of brandSelectors) {
        const items = document.querySelectorAll(sel);
        if (items.length > 0) { brandCount = items.length; break; }
      }

      return { productCount, brandCount };
    });
  } catch (e) {
    return null;
  }
}

async function scrape(page, sleep) {
  console.log(`\n[上新電機] カテゴリ一覧を取得中...`);
  const categories = await fetchCategories(page, sleep);
  console.log(`  → ${categories.length} カテゴリ検出`);

  const results = [];
  for (const cat of categories) {
    console.log(`  [上新] ${cat.name}`);
    const stats = await fetchCategoryStats(page, cat, sleep);
    results.push({
      site: SITE,
      category: cat.name,
      url: cat.url,
      brandCount:   stats?.brandCount   ?? null,
      productCount: stats?.productCount ?? null,
    });
    console.log(`    ブランド数: ${stats?.brandCount ?? '-'}  商品数: ${stats?.productCount ?? '-'}`);
    await sleep(1500, 2500);
  }
  return results;
}

module.exports = { scrape };
