/**
 * ヨドバシカメラ サイト構造調査 v4
 * npm run debug:yodobashi
 *
 * 確認ポイント:
 *   - itemCount の AJAX 待機方法
 *   - js_facetMakerRow / js_facetMakerLink でブランド数取得
 *   - /maker/ ページでのメーカー一覧取得
 */
const { chromium } = require('playwright');

const AIRCON_LIST_URL  = 'https://www.yodobashi.com/category/6353/38073/';       // エアコン一覧
const AIRCON_MAKER_URL = 'https://www.yodobashi.com/category/6353/38073/maker/'; // エアコン メーカー一覧

(async () => {
  const browser = await chromium.launch({ headless: false, args: ['--disable-blink-features=AutomationControlled'] });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    locale: 'ja-JP', ignoreHTTPSErrors: true, viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();

  // ── 1. 商品一覧ページ: itemCount と js_facetMakerRow ──
  console.log(`\n[1] 商品一覧ページ: ${AIRCON_LIST_URL}`);
  await page.goto(AIRCON_LIST_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });

  // itemCount が 0 以外になるまで待機（最大15秒）
  await page.waitForFunction(() => {
    const el = document.querySelector('.itemCount');
    return el && el.textContent.trim() !== '' && el.textContent.trim() !== '0';
  }, { timeout: 15000 }).catch(() => console.log('  ⚠ itemCount タイムアウト'));

  // js_facetMakerRow が出るまで待機
  await page.waitForSelector('.js_facetMakerRow, .js_facetMakerLink', { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(1000);

  const listInfo = await page.evaluate(() => {
    const itemCountEl  = document.querySelector('.itemCount');
    const facetMakerRows  = document.querySelectorAll('.js_facetMakerRow');
    const facetMakerLinks = document.querySelectorAll('.js_facetMakerLink');

    // ブランド名サンプル
    const makerNames = Array.from(facetMakerLinks).slice(0, 10)
      .map(el => el.textContent.trim().replace(/\s+/g, ' '));

    // 「もっと見る」ボタン（非表示ブランドがある場合）
    const foldBtn = document.querySelector('.js_facetFold');

    // 商品数の別の取得元も確認
    const countEls = Array.from(document.querySelectorAll('*'))
      .filter(el => el.children.length === 0 && /[\d,]+件/.test(el.textContent))
      .slice(0, 5)
      .map(el => ({ tag: el.tagName, cls: el.className.slice(0, 60), text: el.textContent.trim() }));

    return {
      itemCount: itemCountEl?.textContent?.trim() ?? '(なし)',
      facetMakerRowCount: facetMakerRows.length,
      facetMakerLinkCount: facetMakerLinks.length,
      makerNames,
      hasFoldBtn: !!foldBtn,
      foldBtnText: foldBtn?.textContent?.trim() ?? null,
      countEls,
    };
  });

  console.log(`  itemCount          : ${listInfo.itemCount}`);
  console.log(`  js_facetMakerRow数 : ${listInfo.facetMakerRowCount}`);
  console.log(`  js_facetMakerLink数: ${listInfo.facetMakerLinkCount}`);
  console.log(`  「もっと見る」ボタン: ${listInfo.hasFoldBtn} (${listInfo.foldBtnText})`);
  console.log(`  ブランドサンプル   : ${listInfo.makerNames.join(' / ')}`);
  console.log(`  件数含む要素:`, listInfo.countEls);

  // ── 2. /maker/ ページ: 全メーカー一覧 ──
  console.log(`\n[2] メーカー一覧ページ: ${AIRCON_MAKER_URL}`);
  await page.goto(AIRCON_MAKER_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);

  const makerPageInfo = await page.evaluate(() => {
    // メーカー名リンク一覧
    const makerLinks = Array.from(document.querySelectorAll('a[href*="/m"]'))
      .filter(a => a.href.includes('/category/'))
      .map(a => a.textContent.trim().replace(/\s+/g, ' '))
      .filter(t => t.length > 0);

    // ページ全体の件数系テキスト
    const countEls = Array.from(document.querySelectorAll('*'))
      .filter(el => el.children.length === 0 && /[\d,]+件/.test(el.textContent))
      .slice(0, 5)
      .map(el => ({ tag: el.tagName, cls: el.className.slice(0, 60), text: el.textContent.trim() }));

    // メーカー一覧要素のクラス名
    const makerListEls = Array.from(document.querySelectorAll('[class*="maker"], [class*="Maker"], [class*="brand"]'))
      .slice(0, 5)
      .map(el => ({ tag: el.tagName, cls: el.className.slice(0, 80), count: el.querySelectorAll('a, li').length }));

    return { makerCount: makerLinks.length, makerSample: makerLinks.slice(0, 10), countEls, makerListEls };
  });

  console.log(`  メーカー数    : ${makerPageInfo.makerCount}`);
  console.log(`  サンプル      : ${makerPageInfo.makerSample.join(' / ')}`);
  console.log(`  件数含む要素  :`, makerPageInfo.countEls);
  console.log(`  メーカー一覧要素:`);
  makerPageInfo.makerListEls.forEach(e =>
    console.log(`    <${e.tag} class="${e.cls}"> count=${e.count}`)
  );

  await browser.close();
})();
