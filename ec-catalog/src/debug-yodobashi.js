/**
 * ヨドバシカメラ サイト構造調査 v7
 * npm run debug:yodobashi
 *
 * 目的: subCateUnit/cateNavExposedAreaの中身・?word=の総件数を確認
 */
const { chromium } = require('playwright');

const KADEN_URL      = 'https://www.yodobashi.com/category/6353/';
const KADEN_WORD_URL = 'https://www.yodobashi.com/category/6353/?word=';

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

  // ── 1. カテゴリページ（?wordなし）: ナビ構造 ──
  console.log(`\n====== [1] カテゴリページ: ${KADEN_URL} ======`);
  await page.goto(KADEN_URL, { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(8000); // AJAX完全待ち
  await page.evaluate(() => window.scrollTo(0, 800));
  await page.waitForTimeout(2000);

  const navInfo = await page.evaluate(() => {
    // subCateUnit / subCateNavNew / cateListBlock の中身を確認
    const navClasses = ['subCateUnit', 'subCateNavNew', 'cateListBlock', 'cateNavExposedArea', 'subCateWrap'];
    const navSamples = navClasses.map(cls => {
      const el = document.querySelector(`.${cls}`);
      if (!el) return { cls, found: false };
      const links = Array.from(el.querySelectorAll('a')).slice(0, 8)
        .map(a => ({ text: a.textContent.trim().replace(/\s+/g, ' ').slice(0, 40), href: a.href.slice(30, 80) }));
      const innerText = el.innerText?.replace(/\s+/g, ' ').trim().slice(0, 200) || '';
      return { cls, found: true, linkCount: el.querySelectorAll('a').length, innerText, links };
    });

    // 数字を含む全テキスト要素（広め）
    const numEls = Array.from(document.querySelectorAll('*'))
      .filter(el => el.children.length === 0 && /\d{2,}/.test(el.textContent) && el.textContent.trim().length < 30)
      .filter(el => !/script|style/i.test(el.tagName))
      .filter(el => !el.closest('script, style, noscript'))
      .slice(0, 20)
      .map(el => ({ tag: el.tagName, cls: el.className.slice(0, 60), text: el.textContent.trim() }));

    // aタグのテキストにある数字（サブカテゴリ件数の候補）
    const linksWithNum = Array.from(document.querySelectorAll('a[href*="/category/"]'))
      .filter(a => /\d{2,}/.test(a.textContent) && a.textContent.trim().length < 50 && !/http/.test(a.textContent))
      .slice(0, 15)
      .map(a => ({ text: a.textContent.trim().replace(/\s+/g, ' '), href: a.href.slice(30, 80) }));

    return { navSamples, numEls, linksWithNum };
  });

  navInfo.navSamples.forEach(s => {
    if (!s.found) { console.log(`  .${s.cls}: 見つからず`); return; }
    console.log(`  .${s.cls}: links=${s.linkCount}`);
    console.log(`    innerText: "${s.innerText}"`);
    s.links.forEach(l => console.log(`      "${l.text}"  ...${l.href}`));
  });
  console.log('\n  数字含む要素:');
  navInfo.numEls.forEach(e => console.log(`    <${e.tag} class="${e.cls}"> "${e.text}"`));
  console.log('\n  カテゴリリンク（数字含む）:');
  navInfo.linksWithNum.forEach(l => console.log(`    "${l.text}"  ...${l.href}`));

  // ── 2. ?word= ページ: 総件数テキストを探す ──
  console.log(`\n====== [2] ?word= ページ: ${KADEN_WORD_URL} ======`);
  await page.goto(KADEN_WORD_URL, { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(5000);

  const wordInfo = await page.evaluate(() => {
    // 短い要素の「件」含むテキスト（children問わず）
    const countCandidates = Array.from(document.querySelectorAll('*'))
      .filter(el => {
        const t = el.textContent.trim();
        return t.length < 60 && /[\d,]+(件|個|点)/.test(t);
      })
      .filter(el => !/script|style/i.test(el.tagName))
      .slice(0, 15)
      .map(el => ({ tag: el.tagName, cls: el.className.slice(0, 80), text: el.textContent.trim().slice(0, 60) }));

    // ページ内のすべての「数字 件」パターン
    const bodyText = document.body?.innerText || '';
    const countMatches = [...bodyText.matchAll(/[\d,]+件/g)].map(m => m[0]).slice(0, 10);

    return { countCandidates, countMatches };
  });

  console.log('  件数含む要素:');
  wordInfo.countCandidates.forEach(e => console.log(`    <${e.tag} class="${e.cls}"> "${e.text}"`));
  console.log('  本文中の件数パターン:', wordInfo.countMatches.join(' / ') || '(なし)');

  await browser.close();
})();
