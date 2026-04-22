/**
 * kakaku.com 商品ページから各ECの価格を一括取得
 * 例: https://kakaku.com/item/K0001695178/
 */

// 対象ショップ名（kakaku.com 上の表記に合わせる）
const TARGET_SHOPS = [
  { key: 'edion',     patterns: ['エディオン', 'EDION', 'edion'] },
  { key: 'yodobashi', patterns: ['ヨドバシ', 'Yodobashi', 'yodobashi'] },
  { key: 'amazon',    patterns: ['Amazon', 'アマゾン', 'amazon'] },
  { key: 'bic',       patterns: ['ビックカメラ', 'BicCamera', 'ビック'] },
];

/**
 * kakaku.com 商品ページの価格比較テーブルを解析
 * → { edion, yodobashi, amazon, bic, allShops } を返す
 */
async function scrapePricesFromKakaku(page, itemUrl, sleep) {
  try {
    const res = await page.goto(itemUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
    if (!res || res.status() !== 200) return null;
    await sleep(1500, 2500);

    // 「もっと見る」ボタンがあれば押して全ショップ展開
    const moreBtn = page.locator('text=もっと見る, text=全店舗, [class*="more"]').first();
    if (await moreBtn.isVisible().catch(() => false)) {
      await moreBtn.click().catch(() => {});
      await sleep(500, 1000);
    }

    const shopPrices = await page.evaluate(() => {
      const results = [];

      // --- パターン A: テーブル形式 ---
      const rows = document.querySelectorAll(
        '.priceTable tr, .shopList tr, [class*="shopList"] tr, ' +
        '.ckitanker tr, table.tblPrice tr, .tbPrice tr'
      );
      for (const row of rows) {
        const cells = row.querySelectorAll('td, th');
        if (cells.length < 2) continue;
        const shopName = cells[0].textContent.trim().replace(/\s+/g, ' ');
        const priceRaw = cells[1].textContent.trim().replace(/\s+/g, '');
        if (shopName && /[¥￥\d,，]/.test(priceRaw)) {
          results.push({ shop: shopName, price: priceRaw });
        }
      }
      if (results.length > 0) return results;

      // --- パターン B: リスト形式 ---
      const items = document.querySelectorAll(
        '.shopItem, .priceItem, [class*="shopItem"], [class*="priceItem"], ' +
        '.cShopItemList li, .shopListItem'
      );
      for (const el of items) {
        const shopEl  = el.querySelector('[class*="shop"], [class*="Shop"], .nm, .name');
        const priceEl = el.querySelector('[class*="price"], [class*="Price"], .price');
        if (shopEl && priceEl) {
          results.push({
            shop:  shopEl.textContent.trim().replace(/\s+/g, ' '),
            price: priceEl.textContent.trim().replace(/\s+/g, ''),
          });
        }
      }
      if (results.length > 0) return results;

      // --- パターン C: 全テキストから価格行を抽出 ---
      const allLinks = document.querySelectorAll('a[href*="kakaku.com/jump"], a[onclick*="jump"]');
      for (const a of allLinks) {
        const parent   = a.closest('li, tr, div[class]');
        const priceEl  = parent?.querySelector('[class*="price"]');
        if (priceEl) {
          results.push({
            shop:  a.textContent.trim().replace(/\s+/g, ' '),
            price: priceEl.textContent.trim().replace(/\s+/g, ''),
          });
        }
      }
      return results;
    });

    // TARGET_SHOPS にマッチするものを抽出
    const result = { edion: null, yodobashi: null, amazon: null, bic: null, allShops: shopPrices };
    for (const { key, patterns } of TARGET_SHOPS) {
      const found = shopPrices.find(s =>
        patterns.some(p => s.shop.toLowerCase().includes(p.toLowerCase()))
      );
      if (found) result[key] = found.price;
    }

    return result;
  } catch (e) {
    console.log(`    エラー: ${e.message.split('\n')[0]}`);
    return null;
  }
}

/**
 * 1商品の価格情報を取得
 */
async function checkPrices(page, product, sleep) {
  console.log(`  価格ページ取得中...`);
  if (!product.url) return { ...product, edion: null, yodobashi: null, amazon: null, bic: null };

  const prices = await scrapePricesFromKakaku(page, product.url, sleep);
  return {
    ...product,
    edion:     prices?.edion     ?? null,
    yodobashi: prices?.yodobashi ?? null,
    amazon:    prices?.amazon    ?? null,
    bic:       prices?.bic       ?? null,
    allShops:  prices?.allShops  ?? [],
  };
}

module.exports = { checkPrices };
