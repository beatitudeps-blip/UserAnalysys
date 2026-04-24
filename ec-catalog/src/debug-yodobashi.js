/**
 * ヨドバシカメラ サイト構造調査 v6
 * npm run debug:yodobashi
 *
 * 目的: 親カテゴリページのサブカテゴリ (数字) 構造を確認
 */
const { chromium } = require('playwright');

const CATEGORY_URL = 'https://www.yodobashi.com/category/6353/'; // 家電

(async () => {
  const browser = await chromium.launch({
    headless: false,
    ignoreDefaultArgs: ['--enable-automation'],
    args: ['--disable-blink-features=AutomationControlled', '--no-sandbox'],
  });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    locale: 'ja-JP', timezoneId: 'Asia/Tokyo', ignoreHTTPSErrors: true, viewport: { width: 1280, height: 900 },
  });
  await context.addInitScript(() => { Object.defineProperty(navigator, 'webdriver', { get: () => undefined }); window.chrome = { runtime: {} }; });
  const page = await context.newPage();

  console.log(`\n====== 家電カテゴリページ: ${CATEGORY_URL} ======`);
  await page.goto(CATEGORY_URL, { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(3000);
  await page.evaluate(() => window.scrollTo(0, 600));
  await page.waitForTimeout(1500);

  const info = await page.evaluate(() => {
    // 1. "(数字)" パターンを持つ要素を広く収集（サブカテゴリ件数候補）
    const parenCountEls = Array.from(document.querySelectorAll('*'))
      .filter(el => el.children.length === 0 && /\([\d,]{2,}\)/.test(el.textContent))
      .slice(0, 20)
      .map(el => ({
        tag: el.tagName, cls: el.className.slice(0, 80), text: el.textContent.trim().slice(0, 60),
        parentTag: el.parentElement?.tagName, parentCls: el.parentElement?.className.slice(0, 60),
      }));

    // 2. カテゴリリンクの隣に "(数字)" があるパターンを探す
    //    → aタグのtextContentに (数字) が含まれるもの
    const linksWithCount = Array.from(document.querySelectorAll('a[href*="/category/"]'))
      .filter(a => /\([\d,]+\)/.test(a.textContent) && a.textContent.trim().length < 60)
      .slice(0, 15)
      .map(a => ({ href: a.href.slice(0, 80), text: a.textContent.trim().replace(/\s+/g, ' ') }));

    // 3. "全XX件" 型の総件数テキスト
    const totalCountEls = Array.from(document.querySelectorAll('*'))
      .filter(el => {
        const t = el.textContent.trim();
        return t.length < 60 && /全[\d,]+件|[\d,]+件[中ヒット]/.test(t);
      })
      .slice(0, 5)
      .map(el => ({ tag: el.tagName, cls: el.className.slice(0, 60), text: el.textContent.trim() }));

    // 4. カテゴリナビのクラスヒント
    const navClasses = [...new Set(
      Array.from(document.querySelectorAll('[class*="category"], [class*="Category"], [class*="subCat"], [class*="nav"], [class*="Nav"]'))
        .map(el => el.className).filter(c => typeof c === 'string').join(' ').split(/\s+/)
    )].filter(c => /cat|nav|sub|count|list|item/i.test(c)).slice(0, 40);

    // 5. aタグのテキストに数字が含まれるカテゴリナビ（サンプル）
    const catNavLinks = Array.from(document.querySelectorAll('[class*="subCate"] a, [class*="subCategory"] a, [class*="categoryList"] a, [class*="cateList"] a'))
      .slice(0, 10)
      .map(a => ({ cls: a.className.slice(0, 40), text: a.textContent.trim().slice(0, 50), href: a.href.slice(30, 80) }));

    // 6. 現在ページの商品タイル数（比較用）
    let tileCount = 0;
    for (const sel of ['.srcResultItem', '[class*="productList"] li', '.js_productListTile']) {
      const n = document.querySelectorAll(sel).length;
      if (n > 1) { tileCount = n; break; }
    }

    return { parenCountEls, linksWithCount, totalCountEls, navClasses, catNavLinks, tileCount };
  });

  console.log('  "(数字)" パターン要素:');
  info.parenCountEls.forEach(e => console.log(`    <${e.tag} class="${e.cls}"> "${e.text}"  (parent: <${e.parentTag} class="${e.parentCls}">)`));

  console.log('\n  カテゴリリンク内の (数字):');
  info.linksWithCount.forEach(l => console.log(`    ${l.href}  "${l.text}"`));

  console.log('\n  全XX件 型総件数:');
  info.totalCountEls.forEach(e => console.log(`    <${e.tag} class="${e.cls}"> "${e.text}"`));

  console.log('\n  カテゴリナビ クラス名:', info.navClasses.join(', '));

  console.log('\n  subCate/categoryListリンク:');
  info.catNavLinks.forEach(l => console.log(`    [${l.cls}] "${l.text}"  ...${l.href}`));

  console.log(`\n  商品タイル数 (比較): ${info.tileCount}`);

  await browser.close();
})();
