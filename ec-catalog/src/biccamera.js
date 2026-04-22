/**
 * ビックカメラ カテゴリ別ブランド数・商品数スクレイパー
 * https://www.biccamera.com/
 */

const SITE = 'biccamera';
const BASE_URL = 'https://www.biccamera.com/bc/main/';

async function fetchCategories(page) {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);

  return page.evaluate(() => {
    const cats = [];
    const selectors = [
      '.gnav a[href*="/bc/c/"]',
      '.globalNavi a[href*="/bc/c/"]',
      'nav a[href*="/bc/c/"]',
      'a[href*="/bc/c/"]',
    ];
    for (const sel of selectors) {
      const links = document.querySelectorAll(sel);
      if (links.length === 0) continue;
      for (const a of links) {
        const name = a.textContent.trim().replace(/\s+/g, ' ');
        const href = a.href;
        if (!name || !href) continue;
        cats.push({ name, url: href });
      }
      if (cats.length > 0) break;
    }
    const seen = new Set();
    return cats.filter(c => {
      if (seen.has(c.url)) return false;
      seen.add(c.url);
      return true;
    });
  });
}

async function fetchCategoryStats(page, category, sleep) {
  try {
    const res = await page.goto(category.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    if (!res || res.status() !== 200) return null;
    await sleep(1000, 1800);

    return page.evaluate(() => {
      // 商品数
      const countPatterns = [
        '[class*="count"]',
        '[class*="resultNum"]',
        '[class*="itemNum"]',
        '.bc-search-result__count',
      ];
      let productCount = null;
      for (const sel of countPatterns) {
        const el = document.querySelector(sel);
        if (!el) continue;
        const m = el.textContent.match(/[\d,]+/);
        if (m) { productCount = parseInt(m[0].replace(',', ''), 10); break; }
      }

      // ブランド数
      const brandPatterns = [
        '[class*="maker"] li',
        '[class*="brand"] li',
        '[class*="Brand"] li',
        '.bc-search-maker li',
        'ul[class*="maker"] li',
      ];
      let brandCount = null;
      for (const sel of brandPatterns) {
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
  console.log(`\n[ビックカメラ] カテゴリ一覧を取得中...`);
  const categories = await fetchCategories(page);
  console.log(`  → ${categories.length} カテゴリ検出`);

  const results = [];
  for (const cat of categories) {
    console.log(`  [ビックカメラ] ${cat.name}`);
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
