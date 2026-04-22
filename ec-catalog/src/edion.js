/**
 * エディオン カテゴリ別ブランド数・商品数スクレイパー
 * https://www.edion.com/
 *
 * 確定セレクタ (debug-edion.js v4 調査済み):
 *   商品数: p.title テキスト "検索結果：XXX件中"
 *   ブランド数: ul.maker li の個数
 *   カテゴリURL: item_list.html?c_cd=XXXXXXX
 */

const SITE = 'edion';

async function fetchCategories(page, sleep) {
  await page.goto('https://www.edion.com/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(1500, 2000);

  // トップナビから category*.html?c_cd= のハブURLを収集
  const hubUrls = await page.evaluate(() => {
    const seen = new Set();
    return Array.from(document.querySelectorAll('a[href*="c_cd="]'))
      .map(a => a.href)
      .filter(h => /category\d*\.html\?c_cd=/.test(h) && !seen.has(h) && seen.add(h))
      .slice(0, 30);
  });

  const cats = [];
  const seen = new Set();

  for (const hubUrl of hubUrls) {
    try {
      const res = await page.goto(hubUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
      if (!res || res.status() !== 200) continue;
      await sleep(800, 1200);

      const leafLinks = await page.evaluate(() => {
        const s = new Set();
        return Array.from(document.querySelectorAll('a[href*="item_list.html?c_cd="]'))
          .map(a => ({ name: a.textContent.trim().replace(/\s+/g, ' '), url: a.href }))
          .filter(l => l.name && l.name.length > 1 && !s.has(l.url) && s.add(l.url));
      });

      for (const link of leafLinks) {
        if (!seen.has(link.url)) {
          seen.add(link.url);
          cats.push(link);
        }
      }
    } catch (e) {
      // hub skip
    }
  }

  // フォールバック: ホームページに item_list リンクが直接ある場合
  if (cats.length === 0) {
    await page.goto('https://www.edion.com/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(1000, 1500);
    const direct = await page.evaluate(() => {
      const s = new Set();
      return Array.from(document.querySelectorAll('a[href*="item_list.html?c_cd="]'))
        .map(a => ({ name: a.textContent.trim().replace(/\s+/g, ' '), url: a.href }))
        .filter(l => l.name && !s.has(l.url) && s.add(l.url));
    });
    cats.push(...direct);
  }

  return cats;
}

async function fetchCategoryStats(page, category, sleep) {
  try {
    const res = await page.goto(category.url, { waitUntil: 'load', timeout: 30000 });
    if (!res || res.status() !== 200) return null;
    await sleep(1500, 2000);
    await page.evaluate(() => window.scrollTo(0, 600));
    await sleep(500, 800);

    return page.evaluate(() => {
      // 商品数: "検索結果：565件中 1-60件" → 565
      let productCount = null;
      const titleEl = document.querySelector('p.title');
      if (titleEl) {
        const m = titleEl.textContent.match(/([\d,]+)件中/);
        if (m) productCount = parseInt(m[1].replace(/,/g, ''), 10);
      }

      // ブランド数: ul.maker li (各liが1ブランド)
      let brandCount = null;
      const makerLis = document.querySelectorAll('ul.maker li');
      if (makerLis.length > 0) brandCount = makerLis.length;

      return { productCount, brandCount };
    });
  } catch (e) {
    return null;
  }
}

async function scrape(page, sleep) {
  console.log(`\n[エディオン] カテゴリ一覧を取得中...`);
  const categories = await fetchCategories(page, sleep);
  console.log(`  → ${categories.length} カテゴリ検出`);

  const results = [];
  for (const cat of categories) {
    console.log(`  [エディオン] ${cat.name}`);
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
