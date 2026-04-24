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

// /maker/ を全ページ巡回してブランド名一覧を返す
async function fetchAllBrands(page, makerUrl, sleep, catName) {
  const brands = [];
  let currentUrl = makerUrl;
  let pageNum = 0;

  while (currentUrl) {
    pageNum++;
    const res = await page.goto(currentUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    if (!res || res.status() !== 200) break;
    await sleep(800, 1200);

    const { items, nextHref, totalPages } = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a[href*="/category/"]'))
        .filter(a => /\/m\d/.test(a.href));
      const items = links.map(a => ({
        name: a.textContent.trim().replace(/\s+/g, ' '),
        productCount: null,
      }));
      const nextEl = Array.from(document.querySelectorAll('a')).find(a => /次の\d+件/.test(a.textContent));
      const bodyText = document.body?.innerText || '';
      const pm = bodyText.match(/\d+\s*\/\s*(\d+)/);
      return { items, nextHref: nextEl?.href ?? null, totalPages: pm ? parseInt(pm[1], 10) : 1 };
    });

    brands.push(...items);
    if (pageNum === 1) console.log(`    ブランドページ巡回中 (全${totalPages}ページ)...`);
    currentUrl = nextHref;
  }

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
    const makerRes = await page.goto(makerUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    if (!makerRes || makerRes.status() !== 200) {
      return { productCount, brandCount: null, brands: [] };
    }

    const brands = await fetchAllBrands(page, makerUrl, sleep, category.name);
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
