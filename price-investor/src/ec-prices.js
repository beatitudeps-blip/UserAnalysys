/**
 * kakaku.com 商品ページから各ECの価格を一括取得
 *
 * 構造（調査済み）:
 *   li.p-priceList_item          各ショップ行
 *   .p-priceList_price           価格テキスト "162,800 円"
 *   .p-priceList_shopNameSub     ショップ名（エディオン等、直接表示）
 *   .p-tooltip_txt               ショップ名（ヨドバシ・Amazon・ビック等、tooltip表示）
 */

const TARGET_SHOPS = [
  { key: 'edion',     patterns: ['エディオン', 'EDION'] },
  { key: 'yodobashi', patterns: ['ヨドバシ', 'Yodobashi'] },
  { key: 'amazon',    patterns: ['Amazon', 'アマゾン'] },
  { key: 'bic',       patterns: ['ビックカメラ', 'ビック', 'BicCamera'] },
];

async function scrapePricesFromKakaku(page, itemUrl, sleep) {
  try {
    const res = await page.goto(itemUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
    if (!res || res.status() !== 200) return null;

    // 価格リストが描画されるまで待機
    await page.waitForSelector('li.p-priceList_item', { timeout: 10000 }).catch(() => {});
    await sleep(1000, 1500);

    // 「もっと見る」ボタンがあれば押して全ショップ展開
    const moreBtn = page.locator('.p-priceList_moreBtnTxt, .p-priceList_moreBtn').first();
    if (await moreBtn.isVisible().catch(() => false)) {
      await moreBtn.click().catch(() => {});
      await sleep(800, 1200);
    }

    const shopPrices = await page.evaluate(() => {
      const results = [];
      for (const item of document.querySelectorAll('li.p-priceList_item')) {
        // ショップ名: 専用要素 → li全体テキスト検索（Yodobashi/Amazon名称マッチ）
        let shop = item.querySelector('.p-priceList_shopNameSub')?.textContent.trim() || '';

        if (!shop) {
          const text = item.textContent || '';
          if (/ヨドバシ|yodobashi/i.test(text))           shop = 'ヨドバシ';
          else if (/Amazon|アマゾン/i.test(text))         shop = 'Amazon';
          else if (/ビックカメラ|biccamera/i.test(text))  shop = 'ビックカメラ';
          else if (/エディオン|EDION/i.test(text))        shop = 'エディオン';
        }

        if (!shop) continue;

        // 価格: "162,800 円" → "162,800円"
        const priceEl = item.querySelector('.p-priceList_price');
        const price   = priceEl?.textContent.trim().replace(/\s+/g, '') ?? null;

        results.push({ shop, price });
      }
      return results;
    });

    // 対象4ショップをマッチング（最初に見つかった行を採用）
    const result = { edion: null, yodobashi: null, amazon: null, bic: null, allShops: shopPrices };
    for (const { key, patterns } of TARGET_SHOPS) {
      const found = shopPrices.find(s =>
        patterns.some(p => s.shop.includes(p))
      );
      if (found) result[key] = found.price;
    }
    return result;
  } catch (e) {
    console.log(`    エラー: ${e.message.split('\n')[0]}`);
    return null;
  }
}

async function checkPrices(page, product, sleep) {
  if (!product.url) return { ...product, edion: null, yodobashi: null, amazon: null, bic: null };

  const prices = await scrapePricesFromKakaku(page, product.url, sleep);
  console.log(`    エディオン: ${prices?.edion ?? '-'}`);
  console.log(`    ヨドバシ  : ${prices?.yodobashi ?? '-'}`);
  console.log(`    Amazon   : ${prices?.amazon ?? '-'}`);
  console.log(`    ビック    : ${prices?.bic ?? '-'}`);

  return {
    ...product,
    edion:     prices?.edion     ?? null,
    yodobashi: prices?.yodobashi ?? null,
    amazon:    prices?.amazon    ?? null,
    bic:       prices?.bic       ?? null,
  };
}

module.exports = { checkPrices };
