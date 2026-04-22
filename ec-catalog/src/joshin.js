/**
 * 上新電機（Joshin）カテゴリ別ブランド数・商品数スクレイパー
 * https://joshinweb.jp/
 *
 * 確定セレクタ (debug-joshin.js v7 調査済み):
 *   カテゴリURL : ホームページの a[href*="/kaden/数字.html"]
 *   ブランド数  : .cate_list (内部に「ブランド名(数字)」パターンを持つもの) の li 数
 *   商品数      : 同 cate_list 内の (数字) を全合計（総商品数表示なし→合計で代用）
 *   Blocked 判定: DOM要素数 < 20
 */

const SITE = 'joshin';

async function fetchCategories(page, sleep) {
  await page.goto('https://joshinweb.jp/', { waitUntil: 'load', timeout: 30000 });
  await sleep(2000, 3000);

  return page.evaluate(() => {
    const seen = new Set();
    return Array.from(document.querySelectorAll('a[href*="/kaden/"]'))
      .filter(a => /\/kaden\/\d+\.html$/.test(a.href))
      .map(a => ({
        name: a.textContent.trim().replace(/\s+/g, ' '),
        url: a.href,
      }))
      .filter(c => c.name && c.name.length > 1 && !seen.has(c.url) && seen.add(c.url));
  });
}

async function fetchCategoryStats(page, category, sleep) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await page.goto(category.url, { waitUntil: 'load', timeout: 30000 });
      if (!res || res.status() !== 200) return null;
      await sleep(2000, 3000);

      // Access Denied チェック
      const totalEls = await page.evaluate(() => document.querySelectorAll('*').length);
      if (totalEls < 20) {
        console.log(`    (Access Denied, ${attempt + 1}回目)`);
        if (attempt === 0) await sleep(6000, 9000);
        continue;
      }

      await page.evaluate(() => window.scrollTo(0, 600));
      await sleep(500, 800);

      return page.evaluate(() => {
        let brandCount = null;
        let productCount = null;

        // ブランド名(数字) パターンを持つ .cate_list を探す
        const cateLists = Array.from(document.querySelectorAll('.cate_list'));
        for (const cl of cateLists) {
          if (!/\(\d+\)/.test(cl.textContent)) continue;

          const lis = cl.querySelectorAll('li');
          if (lis.length === 0) continue;

          brandCount = lis.length;

          // 各ブランドの商品数を合計 → カテゴリ総商品数
          const nums = [...cl.textContent.matchAll(/\((\d+)\)/g)]
            .map(m => parseInt(m[1], 10));
          if (nums.length > 0) productCount = nums.reduce((s, n) => s + n, 0);

          break;
        }

        return { brandCount, productCount };
      });
    } catch (e) {
      if (attempt === 0) await sleep(3000, 5000);
    }
  }
  return null;
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
    await sleep(2000, 3500);
  }
  return results;
}

module.exports = { scrape };
