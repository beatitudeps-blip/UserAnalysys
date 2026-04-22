/**
 * kakaku.com ランキングスクレイパー
 * カテゴリページから ranking_{code} URLを動的に取得してスクレイピング
 */

const TOP_N = 3;

// カテゴリ名 + ベースURL（/kaden/{cat}/ から ranking リンクを自動検出）
const CATEGORIES = [
  // 家電
  { name: 'テレビ',           base: 'https://kakaku.com/kaden/lcd-tv/' },
  { name: '冷蔵庫',           base: 'https://kakaku.com/kaden/freezer/' },
  { name: '洗濯機',           base: 'https://kakaku.com/kaden/washing-machine/' },
  { name: 'エアコン',         base: 'https://kakaku.com/kaden/aircon/' },
  { name: '電子レンジ',       base: 'https://kakaku.com/kaden/microwave-oven/' },
  { name: '掃除機',           base: 'https://kakaku.com/kaden/vacuum-cleaner/' },
  { name: '炊飯器',           base: 'https://kakaku.com/kaden/rice-cooker/' },
  { name: 'ドライヤー',       base: 'https://kakaku.com/kaden/hair-dryer/' },
  { name: '空気清浄機',       base: 'https://kakaku.com/kaden/air-cleaner/' },
  { name: '加湿器',           base: 'https://kakaku.com/kaden/humidifier/' },
  { name: '食器洗い機',       base: 'https://kakaku.com/kaden/dish-washer/' },
  { name: 'イヤホン・ヘッドホン', base: 'https://kakaku.com/kaden/headphones/' },
  { name: 'スピーカー',       base: 'https://kakaku.com/kaden/speaker/' },
  { name: 'シェーバー',       base: 'https://kakaku.com/kaden/shaver/' },
  { name: 'モバイルバッテリー', base: 'https://kakaku.com/kaden/mobile-battery/' },
  // PC・デジタル
  { name: 'ノートPC',         base: 'https://kakaku.com/pc/note-pc/' },
  { name: 'タブレット',       base: 'https://kakaku.com/pc/pda/' },
  { name: 'ゲーム機',         base: 'https://kakaku.com/game/game-console/' },
];

/**
 * カテゴリのベースページからランキングURLを取得
 */
async function findRankingUrl(page, baseUrl) {
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
  return page.evaluate(() => {
    // /ranking_XXXX/ 形式のリンクを探す
    const links = Array.from(document.querySelectorAll('a[href*="/ranking_"]'));
    return links.length > 0 ? links[0].href : null;
  });
}

/**
 * ランキングページから上位 TOP_N 商品を抽出
 */
async function scrapeRankingPage(page, rankingUrl) {
  const res = await page.goto(rankingUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
  if (!res || res.status() !== 200) return [];

  return page.evaluate((topN) => {
    const results = [];

    // 戦略A: ランキングアイテムの定番クラス
    const patterns = [
      '.rnkgItem',
      'li[class*="rnk"]',
      'li[class*="rank"]',
      '.itemListBox li',
      '.rankList li',
    ];
    for (const sel of patterns) {
      const items = document.querySelectorAll(sel);
      if (items.length === 0) continue;
      for (const el of Array.from(items).slice(0, topN)) {
        const nameEl  = el.querySelector('.itmNm a, .itemName a, h2 a, h3 a, [class*="name"] a');
        const priceEl = el.querySelector('.priceTxt, [class*="price"]');
        if (nameEl && nameEl.textContent.trim()) {
          results.push({
            name:  nameEl.textContent.trim().replace(/\s+/g, ' ').replace(/^\d+位\s*/, '').replace(/\s*\d+位$/, ''),
            price: priceEl ? priceEl.textContent.trim().replace(/\s+/g, '') : '-',
            url:   nameEl.href,
          });
        }
      }
      if (results.length > 0) return results;
    }

    // 戦略B: /item/ リンクをランキング順に収集
    const seen = new Set();
    for (const a of document.querySelectorAll('a[href*="/item/"]')) {
      const name = a.textContent.trim().replace(/\s+/g, ' ').replace(/^\d+位\s*/, '').replace(/\s*\d+位$/, '');
      if (!name || seen.has(a.href)) continue;
      seen.add(a.href);
      const parent   = a.closest('li, article, tr, div[class]');
      const priceEl  = parent?.querySelector('[class*="price"]');
      results.push({
        name,
        price: priceEl ? priceEl.textContent.trim().replace(/\s+/g, '') : '-',
        url:   a.href,
      });
      if (results.length >= topN) break;
    }
    return results;
  }, TOP_N);
}

/**
 * 1カテゴリをスクレイプ
 */
async function scrapeCategory(page, category, sleep) {
  console.log(`  [kakaku] ${category.name} ...`);
  try {
    // Step1: ベースページからランキングURLを取得
    const rankingUrl = await findRankingUrl(page, category.base);
    if (!rankingUrl) {
      console.log(`    → ランキングURL見つからず`);
      return [];
    }
    console.log(`    → ${rankingUrl}`);
    await sleep(1000, 1500);

    // Step2: ランキングページをスクレイプ
    const products = await scrapeRankingPage(page, rankingUrl);
    console.log(`    → ${products.length} 件取得`);
    return products.map(p => ({ category: category.name, ...p }));
  } catch (e) {
    console.log(`    → エラー: ${e.message.split('\n')[0]}`);
    return [];
  }
}

/**
 * 全カテゴリを収集
 */
async function scrapeAllCategories(page, sleep) {
  const all = [];
  for (const cat of CATEGORIES) {
    const items = await scrapeCategory(page, cat, sleep);
    all.push(...items);
    await sleep(2000, 3500);
  }
  return all;
}

module.exports = { scrapeAllCategories, CATEGORIES };
