/**
 * 各ECサイトの価格取得モジュール
 */

async function firstPrice(page, selectors) {
  return page.evaluate((sels) => {
    for (const sel of sels) {
      for (const el of document.querySelectorAll(sel)) {
        const t = el.textContent.trim().replace(/\s+/g, '');
        if (/[¥￥,\d]{3,}/.test(t) && t.length < 30) return t;
      }
    }
    return null;
  }, selectors);
}

async function getEdion(page, query, sleep) {
  try {
    await page.goto(
      `https://www.edion.com/search/?q=${encodeURIComponent(query)}`,
      { waitUntil: 'domcontentloaded', timeout: 20000 }
    );
    await sleep(800, 1500);
    return await firstPrice(page, [
      '.selling_price', '.item_price .price', '.p-price__main',
      '.price', '[class*="price"]',
    ]);
  } catch { return null; }
}

async function getYodobashi(page, query, sleep) {
  try {
    await page.goto(
      `https://www.yodobashi.com/?word=${encodeURIComponent(query)}`,
      { waitUntil: 'domcontentloaded', timeout: 20000 }
    );
    await sleep(800, 1500);
    await page.waitForSelector('.priceSingle, .productPrice', { timeout: 5000 }).catch(() => {});
    return await firstPrice(page, [
      '.priceSingle', '.productPrice', '.price strong', '[class*="price"]',
    ]);
  } catch { return null; }
}

async function getAmazon(page, query, sleep) {
  try {
    await page.goto(
      `https://www.amazon.co.jp/s?k=${encodeURIComponent(query)}&i=electronics`,
      { waitUntil: 'domcontentloaded', timeout: 20000 }
    );
    await sleep(1000, 2000);
    return await page.evaluate(() => {
      const whole = document.querySelector(
        '.s-result-item:not([data-asin=""]) .a-price-whole'
      );
      const frac = document.querySelector(
        '.s-result-item:not([data-asin=""]) .a-price-fraction'
      );
      if (whole) {
        return '¥' + whole.textContent.replace(/[^\d,]/g, '') + (frac?.textContent.trim() ?? '');
      }
      const off = document.querySelector('.a-offscreen');
      return off ? off.textContent.trim() : null;
    });
  } catch { return null; }
}

async function getBic(page, query, sleep) {
  try {
    await page.goto(
      `https://www.biccamera.com/bc/category/search.jsp?q=${encodeURIComponent(query)}`,
      { waitUntil: 'domcontentloaded', timeout: 20000 }
    );
    await sleep(800, 1500);
    return await firstPrice(page, [
      '.js-item-price', '.real_price', '.item-price',
      '.price_box .price', '[class*="price"]',
    ]);
  } catch { return null; }
}

/**
 * 1商品を全ECサイトで価格チェック
 */
async function checkPrices(page, product, sleep) {
  const query = product.name.slice(0, 60);
  console.log(`    Edion...`);
  const edion = await getEdion(page, query, sleep);
  await sleep(1000, 1800);

  console.log(`    Yodobashi...`);
  const yodobashi = await getYodobashi(page, query, sleep);
  await sleep(1000, 1800);

  console.log(`    Amazon...`);
  const amazon = await getAmazon(page, query, sleep);
  await sleep(1000, 1800);

  console.log(`    BicCamera...`);
  const bic = await getBic(page, query, sleep);
  await sleep(1000, 1800);

  return { ...product, edion, yodobashi, amazon, bic };
}

module.exports = { checkPrices };
