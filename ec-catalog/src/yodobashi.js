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
    await sleep(2500, 3500); // AJAX描画待ち（itemCountはAJAX遅延）

    // スクロールで遅延読み込みを促し、先頭に戻る
    await page.evaluate(() => window.scrollTo(0, 600));
    await sleep(1500, 2000);
    await page.evaluate(() => window.scrollTo(0, 0));
    await sleep(800, 1200);

    const productCount = await page.evaluate(() => {
      // itemCount（AJAX後に件数が入る）
      const itemCountEl = document.querySelector('.itemCount');
      if (itemCountEl) {
        const m = itemCountEl.textContent.match(/[\d,]+/);
        if (m) {
          const n = parseInt(m[0].replace(/,/g, ''), 10);
          if (n > 0) return n;
        }
      }

      // 商品タイルを直接カウント（debug v5 の確認済みセレクタ一覧）
      for (const sel of [
        '.js_productListTile',
        '.p-list_item',
        '.productItemTile',
        '.srcResultItem',
        '[class*="productList"] li',
        '[class*="ProductList"] li',
        '[class*="itemList"] li',
        '[class*="listItem"]',
      ]) {
        const items = document.querySelectorAll(sel);
        if (items.length > 0) return items.length;
      }
      return null;
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
