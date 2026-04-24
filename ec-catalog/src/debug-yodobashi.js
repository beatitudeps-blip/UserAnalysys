/**
 * ヨドバシカメラ サイト構造調査 v8
 * npm run debug:yodobashi
 *
 * 目的: 商品一覧ページのサイドバーに「ブランド名(件数)」リストがあるか確認
 */
const { chromium } = require('playwright');

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

  console.log(`\n====== ?word= ページ: ${KADEN_WORD_URL} ======`);
  await page.goto(KADEN_WORD_URL, { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(6000);
  await page.evaluate(() => window.scrollTo(0, 600));
  await page.waitForTimeout(2000);

  const info = await page.evaluate(() => {
    // 1. 「ブランド名(数字)」パターンを含むリスト要素を探す
    const lisWithCount = Array.from(document.querySelectorAll('li, a, label, span'))
      .filter(el => /^.{1,30}\(\d+\)$/.test(el.textContent.trim()))
      .filter(el => !el.closest('script, style, noscript'))
      .slice(0, 30)
      .map(el => ({
        tag: el.tagName,
        cls: el.className?.slice(0, 60) ?? '',
        parentCls: el.parentElement?.className?.slice(0, 60) ?? '',
        grandCls:  el.parentElement?.parentElement?.className?.slice(0, 60) ?? '',
        text: el.textContent.trim(),
      }));

    // 2. (数字) パターンを多く含む親要素を探す（リスト全体）
    const containers = Array.from(document.querySelectorAll('ul, ol, div, section'))
      .filter(el => {
        const t = el.textContent;
        const matches = t.match(/\(\d+\)/g);
        return matches && matches.length >= 3 && el.children.length >= 3;
      })
      .filter(el => !el.closest('script, style'))
      .map(el => ({
        tag: el.tagName,
        id:  (el.id || '').slice(0, 40),
        cls: el.className?.slice(0, 80) ?? '',
        matchCount: (el.textContent.match(/\(\d+\)/g) || []).length,
        childCount: el.children.length,
        sample: el.innerText?.replace(/\s+/g, ' ').trim().slice(0, 200) ?? '',
      }))
      .sort((a, b) => b.matchCount - a.matchCount)
      .slice(0, 8);

    // 3. 「メーカー」「ブランド」見出し付近の要素
    const headings = Array.from(document.querySelectorAll('*'))
      .filter(el => el.children.length === 0 && /メーカー|ブランド|maker|brand/i.test(el.textContent) && el.textContent.trim().length < 20)
      .slice(0, 5)
      .map(el => {
        const section = el.closest('section, div[class], aside') || el.parentElement?.parentElement;
        return {
          headingText: el.textContent.trim(),
          sectionCls: section?.className?.slice(0, 80) ?? '',
          sectionSample: section?.innerText?.replace(/\s+/g, ' ').trim().slice(0, 200) ?? '',
        };
      });

    // 4. h2.numOfSearch確認
    const numOfSearch = document.querySelector('h2.numOfSearch');
    const totalCount = numOfSearch?.textContent.trim() ?? '(なし)';

    return { lisWithCount, containers, headings, totalCount };
  });

  console.log(`\n  総商品数: ${info.totalCount}`);

  console.log(`\n  「ブランド名(数字)」パターンのli/a要素 (${info.lisWithCount.length}件):`);
  info.lisWithCount.slice(0, 15).forEach(e =>
    console.log(`    <${e.tag} class="${e.cls}"> parent="${e.parentCls}" grand="${e.grandCls}" → "${e.text}"`)
  );

  console.log(`\n  (数字)を3個以上含む親コンテナ:`);
  info.containers.forEach(c =>
    console.log(`    <${c.tag} id="${c.id}" class="${c.cls}"> matches=${c.matchCount} children=${c.childCount}\n      sample: "${c.sample}"`)
  );

  console.log(`\n  「メーカー/ブランド」見出し周辺:`);
  info.headings.forEach(h =>
    console.log(`    "${h.headingText}" → section class="${h.sectionCls}"\n      sample: "${h.sectionSample}"`)
  );

  await browser.close();
})();
