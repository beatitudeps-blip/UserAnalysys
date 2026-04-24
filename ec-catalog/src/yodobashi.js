/**
 * ヨドバシカメラ カテゴリ別ブランド数・商品数スクレイパー
 *
 * 確認済み構造:
 *   カテゴリURL : https://www.yodobashi.com/category/{id}/
 *   商品一覧    : {catUrl}?word= → [class*="productList"] li または .srcResultItem
 *   ブランド一覧: {catUrl}maker/ → a[href*="/m数字"]
 */

const SITE = 'yodobashi';

/** 商品タイルセレクタ（マッチしたら件数を返す） */
function countProductTiles() {
  for (const sel of [
    '.srcResultItem',
    '[class*="productList"] li',
    '[class*="ProductList"] li',
    '.js_productListTile',
    '.p-list_item',
    '.productItemTile',
  ]) {
    const n = document.querySelectorAll(sel).length;
    if (n > 1) return n; // 1件だけのナビ等を除外
  }
  return 0;
}

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
    console.log(`      → ${listUrl}`);
    const res = await page.goto(listUrl, { waitUntil: 'load', timeout: 30000 });
    if (!res || res.status() !== 200) return null;

    await sleep(2500, 3500); // AJAX描画待ち
    await page.evaluate(() => window.scrollTo(0, 600));
    await sleep(1500, 2000);
    await page.evaluate(() => window.scrollTo(0, 0));
    await sleep(800, 1200);

    let productCount = await page.evaluate(countProductTiles);

    // ?word= でヒットしない場合はカテゴリURLをそのまま試す
    if (!productCount) {
      console.log(`      → フォールバック: ${category.url}`);
      await page.goto(category.url, { waitUntil: 'load', timeout: 30000 });
      await sleep(2500, 3500);
      await page.evaluate(() => window.scrollTo(0, 600));
      await sleep(1500, 2000);
      productCount = await page.evaluate(countProductTiles) || null;
    }

    // ── ブランド数: /maker/ ページ ──
    const makerUrl = category.url.replace(/\/?$/, '/') + 'maker/';
    const makerRes = await page.goto(makerUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    if (!makerRes || makerRes.status() !== 200) {
      return { productCount, brandCount: null };
    }
    await sleep(1000, 1500);

    const brandCount = await page.evaluate(() => {
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
    console.log(`  [ヨドバシ] ${cat.name}  (${cat.url})`);
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
