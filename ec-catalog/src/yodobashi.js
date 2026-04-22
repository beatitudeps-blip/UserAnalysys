/**
 * ヨドバシカメラ カテゴリ別ブランド数・商品数スクレイパー
 *
 * 確認済み構造:
 *   カテゴリURL : https://www.yodobashi.com/category/{id}/
 *   商品一覧    : {catUrl}?word= → [class*="productList"] li または .srcResultItem
 *   ブランド一覧: {catUrl}maker/ → a[href*="/m数字"]
 */

const SITE = 'yodobashi';

async function fetchCategories(page, sleep) {
  await page.goto('https://www.yodobashi.com/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(1500, 2000);

  return page.evaluate(() => {
    const cats = Array.from(document.querySelectorAll('a[href*="/category/"]'))
      .map(a => ({
        name: a.textContent.trim().replace(/\s+/g, ' '),
        url:  a.href.split('?')[0].replace(/\/?$/, '/'),
      }))
      .filter(c => c.name.length > 0)
      .filter((c, i, arr) => arr.findIndex(b => b.url === c.url) === i);
    return cats;
  });
}

async function fetchCategoryStats(page, category, sleep) {
  try {
    // ── 商品数: ?word= 付きURLで全商品一覧 ──
    const listUrl = category.url.replace(/\/?$/, '/') + '?word=';
    const res = await page.goto(listUrl, { waitUntil: 'load', timeout: 30000 });
    if (!res || res.status() !== 200) return null;
    await sleep(1500, 2000);

    // スクロールで遅延描画を促す
    await page.evaluate(() => window.scrollTo(0, 600));
    await sleep(800, 1200);

    const productCount = await page.evaluate(() => {
      // 確認済み: .srcResultItem または [class*="productList"] li
      const items = document.querySelectorAll('.srcResultItem');
      if (items.length > 0) return items.length;
      const listItems = document.querySelectorAll('[class*="productList"] li');
      return listItems.length || null;
    });

    // ── ブランド数: /maker/ ページ ──
    const makerUrl = category.url.replace(/\/?$/, '/') + 'maker/';
    const makerRes = await page.goto(makerUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    if (!makerRes || makerRes.status() !== 200) {
      return { productCount, brandCount: null };
    }
    await sleep(1000, 1500);

    const brandCount = await page.evaluate(() => {
      // 確認済み: /m数字 パターンのリンクがブランドリンク
      const links = Array.from(document.querySelectorAll('a[href*="/category/"]'))
        .filter(a => /\/m\d/.test(a.href));
      return links.length || null;
    });

    return { productCount, brandCount };
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
    });
    console.log(`    ブランド数: ${stats?.brandCount ?? '-'}  商品数: ${stats?.productCount ?? '-'}`);
    await sleep(1500, 2500);
  }
  return results;
}

module.exports = { scrape };
