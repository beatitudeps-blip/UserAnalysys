/**
 * ヨドバシカメラ サイト構造調査 v2
 * npm run debug:yodobashi
 */
const { chromium } = require('playwright');

// 家電カテゴリ（テレビ）で具体的に調査
const TEST_CATEGORY_URL = 'https://www.yodobashi.com/category/6353/';  // 家電

(async () => {
  const browser = await chromium.launch({ headless: false, args: ['--disable-blink-features=AutomationControlled'] });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    locale: 'ja-JP', ignoreHTTPSErrors: true, viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();

  // ── 1. 家電カテゴリページ ──
  console.log(`\n=== 家電カテゴリページ: ${TEST_CATEGORY_URL} ===`);
  await page.goto(TEST_CATEGORY_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);

  const catPage = await page.evaluate(() => {
    // 「件」を含む全テキストノード
    const countEls = Array.from(document.querySelectorAll('*'))
      .filter(el => el.children.length === 0 && /[\d,]+件/.test(el.textContent))
      .slice(0, 10)
      .map(el => ({ tag: el.tagName, cls: el.className.slice(0, 80), text: el.textContent.trim().slice(0, 60) }));

    // ブランド/メーカー関連要素のHTML
    const brandEls = Array.from(document.querySelectorAll('[class*="brand"], [class*="Brand"], [class*="maker"], [class*="Maker"]'))
      .slice(0, 8)
      .map(el => ({
        tag: el.tagName,
        cls: el.className.slice(0, 80),
        childCount: el.children.length,
        liCount: el.querySelectorAll('li').length,
        aCount:  el.querySelectorAll('a').length,
        innerText: el.innerText?.slice(0, 120).replace(/\n/g, ' | '),
      }));

    // サブカテゴリへのリンク
    const subCats = Array.from(document.querySelectorAll('a[href*="/category/"]'))
      .slice(0, 10)
      .map(a => ({ text: a.textContent.trim().slice(0, 30), href: a.href.slice(0, 100) }));

    // ページ内の全クラス名からブランド候補を探す
    const allClasses = [...new Set(
      Array.from(document.querySelectorAll('*'))
        .map(el => el.className)
        .filter(c => typeof c === 'string' && c.length > 0)
        .join(' ').split(/\s+/)
    )].filter(c => /brand|Brand|maker|Maker|vendor|mfr|count|result|total/i.test(c)).slice(0, 30);

    return { countEls, brandEls, subCats, allClasses };
  });

  console.log('\n--- 件数表示要素 (「件」を含む) ---');
  catPage.countEls.forEach(e => console.log(`  <${e.tag} class="${e.cls}"> → "${e.text}"`));

  console.log('\n--- ブランド/メーカー関連要素 ---');
  catPage.brandEls.forEach(e =>
    console.log(`  <${e.tag} class="${e.cls}"> children=${e.childCount} li=${e.liCount} a=${e.aCount}\n    text: ${e.innerText}`)
  );

  console.log('\n--- サブカテゴリリンク ---');
  catPage.subCats.forEach(s => console.log(`  ${s.text} => ${s.href}`));

  console.log('\n--- ブランド/件数関連クラス名一覧 ---');
  console.log(' ', catPage.allClasses.join(', '));

  // ── 2. サブカテゴリ（テレビ等）に潜って商品一覧ページを確認 ──
  const subCatUrl = catPage.subCats[0]?.href;
  if (subCatUrl) {
    console.log(`\n=== サブカテゴリページ: ${subCatUrl} ===`);
    await page.goto(subCatUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);

    const subPage = await page.evaluate(() => {
      const countEls = Array.from(document.querySelectorAll('*'))
        .filter(el => el.children.length === 0 && /[\d,]+件/.test(el.textContent))
        .slice(0, 10)
        .map(el => ({ tag: el.tagName, cls: el.className.slice(0, 80), text: el.textContent.trim().slice(0, 60) }));

      const brandEls = Array.from(document.querySelectorAll('[class*="brand"], [class*="Brand"], [class*="maker"], [class*="Maker"]'))
        .slice(0, 8)
        .map(el => ({
          tag: el.tagName,
          cls: el.className.slice(0, 80),
          liCount: el.querySelectorAll('li').length,
          aCount:  el.querySelectorAll('a').length,
          innerText: el.innerText?.slice(0, 200).replace(/\n/g, ' | '),
        }));

      return { countEls, brandEls };
    });

    console.log('\n--- 件数表示要素 ---');
    subPage.countEls.forEach(e => console.log(`  <${e.tag} class="${e.cls}"> → "${e.text}"`));
    console.log('\n--- ブランド/メーカー関連要素 ---');
    subPage.brandEls.forEach(e =>
      console.log(`  <${e.tag} class="${e.cls}"> li=${e.liCount} a=${e.aCount}\n    text: ${e.innerText}`)
    );
  }

  await browser.close();
})();
