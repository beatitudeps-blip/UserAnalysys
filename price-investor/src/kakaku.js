/**
 * kakaku.com ランキングスクレイパー
 * 各カテゴリの上位 TOP_N 商品（名前・kakaku最安値・URL）を返す
 */

const TOP_N = 3;

const CATEGORIES = [
  // 家電
  { name: 'テレビ',       url: 'https://kakaku.com/kaden/tv/ranking/' },
  { name: '冷蔵庫',       url: 'https://kakaku.com/kaden/refrigerator/ranking/' },
  { name: '洗濯機',       url: 'https://kakaku.com/kaden/washer/ranking/' },
  { name: 'エアコン',     url: 'https://kakaku.com/kaden/aircon/ranking/' },
  { name: '電子レンジ',   url: 'https://kakaku.com/kaden/microwave/ranking/' },
  { name: '掃除機',       url: 'https://kakaku.com/kaden/vacuum_cleaner/ranking/' },
  { name: '炊飯器',       url: 'https://kakaku.com/kaden/rice_cooker/ranking/' },
  { name: 'ドライヤー',   url: 'https://kakaku.com/kaden/dryer/ranking/' },
  { name: '空気清浄機',   url: 'https://kakaku.com/kaden/air_purifier/ranking/' },
  { name: '食器洗い機',   url: 'https://kakaku.com/kaden/dishwasher/ranking/' },
  { name: '電気ケトル',   url: 'https://kakaku.com/kaden/electric-kettle/ranking/' },
  { name: 'IHクッキング', url: 'https://kakaku.com/kaden/ih_cooker/ranking/' },
  // PC・スマホ・デジタル
  { name: 'ノートPC',       url: 'https://kakaku.com/pc/notebook-pc/ranking/' },
  { name: 'スマートフォン', url: 'https://kakaku.com/keitai/smartphone/ranking/' },
  { name: 'タブレット',     url: 'https://kakaku.com/pc/tablet/ranking/' },
  { name: 'デジカメ',       url: 'https://kakaku.com/camera/digital-camera/ranking/' },
  { name: 'ヘッドホン',     url: 'https://kakaku.com/av/headphone/ranking/' },
  { name: 'イヤホン',       url: 'https://kakaku.com/av/earphone/ranking/' },
  { name: 'ゲーム機',       url: 'https://kakaku.com/game/game-console/ranking/' },
];

/**
 * カテゴリランキングページから上位 TOP_N 商品を抽出
 */
async function scrapeCategory(page, category, sleep) {
  console.log(`  [kakaku] ${category.name} ...`);
  try {
    const res = await page.goto(category.url, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    if (res.status() !== 200) {
      console.log(`    → HTTP ${res.status()} スキップ`);
      return [];
    }
    await sleep(1500, 2500);

    const products = await page.evaluate((topN) => {
      const results = [];

      // --- セレクタ戦略 A: .rnkgItem（定番ランキングUI） ---
      const itemsA = document.querySelectorAll('.rnkgItem');
      if (itemsA.length > 0) {
        for (const el of Array.from(itemsA).slice(0, topN)) {
          const nameEl  = el.querySelector('.itmNm a, .itemName a, h3 a, h2 a');
          const priceEl = el.querySelector('.priceTxt, [class*="price"]');
          if (nameEl) results.push({
            name:  nameEl.textContent.trim().replace(/\s+/g, ' '),
            price: priceEl ? priceEl.textContent.trim().replace(/\s+/g, '') : '-',
            url:   nameEl.href,
          });
        }
        if (results.length > 0) return results;
      }

      // --- セレクタ戦略 B: li[class*="rnk"] or li[class*="rank"] ---
      const itemsB = document.querySelectorAll('li[class*="rnk"], li[class*="rank"]');
      if (itemsB.length > 0) {
        for (const el of Array.from(itemsB).slice(0, topN)) {
          const nameEl  = el.querySelector('a[class*="name"], a[class*="item"], h3 a, h2 a, a');
          const priceEl = el.querySelector('[class*="price"]');
          if (nameEl) results.push({
            name:  nameEl.textContent.trim().replace(/\s+/g, ' '),
            price: priceEl ? priceEl.textContent.trim().replace(/\s+/g, '') : '-',
            url:   nameEl.href,
          });
        }
        if (results.length > 0) return results;
      }

      // --- セレクタ戦略 C: /item/ リンク群から推定 ---
      const links = Array.from(document.querySelectorAll('a[href*="/item/"]'));
      const seen  = new Set();
      for (const a of links) {
        const name = a.textContent.trim().replace(/\s+/g, ' ');
        if (!name || seen.has(a.href)) continue;
        seen.add(a.href);
        const parent   = a.closest('li, article, div[class]');
        const priceEl  = parent ? parent.querySelector('[class*="price"]') : null;
        results.push({
          name,
          price: priceEl ? priceEl.textContent.trim().replace(/\s+/g, '') : '-',
          url:   a.href,
        });
        if (results.length >= topN) break;
      }
      return results;
    }, TOP_N);

    console.log(`    → ${products.length} 件取得`);
    return products.map(p => ({ category: category.name, ...p }));
  } catch (e) {
    console.log(`    → エラー: ${e.message.split('\n')[0]}`);
    return [];
  }
}

/**
 * 全カテゴリのランキング上位商品を収集
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
