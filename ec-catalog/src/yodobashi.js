/**
 * ヨドバシカメラ カテゴリ別ブランド数・商品数スクレイパー
 *
 * 確定セレクタ (debug-yodobashi.js v7 調査済み):
 *   カテゴリ一覧: .cateNavExposedArea a[href*="/category/"] (トップ8カテゴリ)
 *   商品数      : {catUrl}?word= → h2.numOfSearch "XXX件ヒット"
 *   ブランド一覧: {catUrl}maker/ → a[href*="/m数字"] を全ページ巡回
 */

const SITE = 'yodobashi';

async function fetchCategories(page, sleep) {
  await page.goto('https://www.yodobashi.com/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(1500, 2000);

  return page.evaluate(() => {
    const seen = new Set();
    return Array.from(document.querySelectorAll('.cateNavExposedArea a[href*="/category/"]'))
      .map(a => ({
        name: a.textContent.trim().replace(/\s+/g, ' '),
        url:  a.href.split('?')[0].replace(/\/?$/, '/'),
      }))
      .filter(c => c.name.length > 0 && !seen.has(c.url) && seen.add(c.url));
  });
}

// /maker/p{N}/ を順に巡回してブランド名一覧を返す
async function fetchAllBrands(page, makerUrl, sleep) {
  const brands = [];

  for (let pno = 1; ; pno++) {
    const url = pno === 1 ? makerUrl : `${makerUrl}p${pno}/`;
    const res = await page.goto(url, { waitUntil: 'load', timeout: 30000 });
    if (!res || res.status() !== 200) break;
    await sleep(800, 1200);

    const items = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a[href*="/category/"]'))
        .filter(a => /\/m\d/.test(a.href));
      return links.map(a => ({ name: a.textContent.trim().replace(/\s+/g, ' '), productCount: null }));
    });

    if (items.length === 0) break;
    brands.push(...items);
    if (pno === 1) process.stdout.write('    ブランドページ巡回中...');
    else process.stdout.write(` p${pno}`);
  }

  if (brands.length > 0) console.log(` 計${brands.length}件`);
  return brands;
}

async function fetchCategoryStats(page, category, sleep) {
  try {
    // ── 商品数: {catUrl}?word= → h2.numOfSearch "XXX件ヒット" ──
    const listUrl = category.url.replace(/\/?$/, '/') + '?word=';
    const res = await page.goto(listUrl, { waitUntil: 'load', timeout: 30000 });
    if (!res || res.status() !== 200) return null;
    await sleep(2000, 3000);

    const productCount = await page.evaluate(() => {
      for (const sel of ['h2.numOfSearch', '.searchResultsHead', '.srcResultBoxNew_info']) {
        const el = document.querySelector(sel);
        if (!el) continue;
        const m = el.textContent.match(/([\d,]+)件[ヒ中]/);
        if (m) return parseInt(m[1].replace(/,/g, ''), 10);
      }
      return null;
    });

    // ── ブランド一覧: /maker/ を全ページ巡回 ──
    const makerUrl = category.url.replace(/\/?$/, '/') + 'maker/';
    const brands = await fetchAllBrands(page, makerUrl, sleep);
    return { productCount, brandCount: brands.length || null, brands };
  } catch (e) {
    return null;
  }
}

async function scrape(page, sleep) {
  console.log(`\n[ヨドバシ] カテゴリ一覧を取得中...`);
  const categories = await fetchCategories(page, sleep);
  console.log(`  → ${categories.length} カテゴリ検出`);

  const results = [];
  for (const cat of categories) {
    console.log(`  [ヨドバシ] ${cat.name}`);
    const stats = await fetchCategoryStats(page, cat, sleep);
    results.push({
      site: SITE,
      category: cat.name,
      url: cat.url,
      brandCount:   stats?.brandCount   ?? null,
      productCount: stats?.productCount ?? null,
      brands:       stats?.brands       ?? [],
    });
    console.log(`    ブランド数: ${stats?.brandCount ?? '-'}  商品数: ${stats?.productCount ?? '-'}`);
    await sleep(1500, 2500);
  }
  return results;
}

module.exports = { scrape };
