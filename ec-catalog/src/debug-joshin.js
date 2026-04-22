/**
 * 上新電機（Joshin）サイト構造調査 v2
 * npm run debug:joshin
 */
const { chromium } = require('playwright');

// トップで確認済みのカテゴリTOPページを直接調査
const CAT_TOP_URL  = 'https://joshinweb.jp/kaden/top.html';  // 家電カテゴリ

(async () => {
  const browser = await chromium.launch({
    headless: false,
    ignoreDefaultArgs: ['--enable-automation'],
    args: ['--disable-blink-features=AutomationControlled', '--no-sandbox'],
  });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    locale: 'ja-JP', timezoneId: 'Asia/Tokyo',
    ignoreHTTPSErrors: true, viewport: { width: 1280, height: 900 },
  });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    window.chrome = { runtime: {} };
  });
  const page = await context.newPage();

  // ── Step1: 家電カテゴリTOPページのサブカテゴリ ──
  console.log(`\n[Step1] 家電カテゴリTOP: ${CAT_TOP_URL}`);
  await page.goto(CAT_TOP_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);

  const topInfo = await page.evaluate(() => {
    // 商品一覧リンクを探す（サブカテゴリ）
    const listLinks = Array.from(document.querySelectorAll('a[href]'))
      .filter(a => a.href.includes('joshinweb.jp') && /\/list\//.test(a.href))
      .map(a => ({ text: a.textContent.trim().replace(/\s+/g, ' ').slice(0, 40), href: a.href }))
      .filter((a, i, arr) => arr.findIndex(b => b.href === a.href) === i)
      .slice(0, 15);

    // カテゴリTOP内のカテゴリナビリンク
    const catLinks = Array.from(document.querySelectorAll('a[href]'))
      .filter(a => a.href.includes('joshinweb.jp') &&
                   /\/(kaden|season|av|pc|camera|mobile|kitchen|health)\//.test(a.href) &&
                   !/top\.html/.test(a.href))
      .map(a => ({ text: a.textContent.trim().replace(/\s+/g, ' ').slice(0, 40), href: a.href }))
      .filter((a, i, arr) => arr.findIndex(b => b.href === a.href) === i)
      .slice(0, 15);

    // ページ構造確認
    const bodyText = document.body.innerText.slice(0, 300).replace(/\s+/g, ' ');

    return { listLinks, catLinks, bodyText, links: document.querySelectorAll('a').length };
  });

  console.log(`  総リンク数: ${topInfo.links}`);
  console.log('  サブカテゴリ(list)リンク:');
  topInfo.listLinks.forEach(l => console.log(`    "${l.text}" => ${l.href}`));
  console.log('  カテゴリナビリンク:');
  topInfo.catLinks.forEach(l => console.log(`    "${l.text}" => ${l.href}`));
  console.log('  本文先頭:', topInfo.bodyText);

  // ── Step2: サブカテゴリ商品一覧ページの商品数・ブランド調査 ──
  const listUrl = topInfo.listLinks[0]?.href ?? topInfo.catLinks[0]?.href;
  if (!listUrl) {
    // /list/ パターンがなければ直接商品検索ページを試す
    console.log('\n  /list/ URL見つからず、直接検索ページを試します');
    const searchUrl = 'https://joshinweb.jp/kaden/?genre=top&mkr=ALL&stype=0&type=K';
    console.log(`\n[Step2] 検索ページ: ${searchUrl}`);
    await page.goto(searchUrl, { waitUntil: 'load', timeout: 30000 });
  } else {
    console.log(`\n[Step2] 商品一覧ページ: ${listUrl}`);
    await page.goto(listUrl, { waitUntil: 'load', timeout: 30000 });
  }
  await page.waitForTimeout(3000);
  await page.evaluate(() => window.scrollTo(0, 600));
  await page.waitForTimeout(1500);

  const listInfo = await page.evaluate(() => {
    // 件数含む要素
    const countEls = Array.from(document.querySelectorAll('*'))
      .filter(el => el.children.length === 0 && /[\d,]+件/.test(el.textContent))
      .slice(0, 8)
      .map(el => ({ tag: el.tagName, cls: el.className.slice(0, 80), text: el.textContent.trim() }));

    // countTab, total, result クラス
    const countClsEls = Array.from(document.querySelectorAll('.countTab, .total, .result, [class*="count"], [class*="total"], [class*="result"]'))
      .slice(0, 8)
      .map(el => ({ tag: el.tagName, cls: el.className.slice(0, 80), text: el.textContent.trim().slice(0, 60) }));

    // 商品タイル
    const tileSelectors = [
      '.itmUnit', '[class*="itemList"] li', '[class*="list"] li',
      '[class*="item"] li', '.searchResultItem',
    ];
    let tileCount = 0, tileClass = '';
    for (const sel of tileSelectors) {
      const items = document.querySelectorAll(sel);
      if (items.length > 1) { tileCount = items.length; tileClass = sel; break; }
    }

    // ブランド/メーカー
    const brandEls = Array.from(document.querySelectorAll('[class*="maker"], [class*="brand"], [class*="Brand"], [class*="Maker"], [class*="mfr"]'))
      .filter(el => el.querySelectorAll('a, li').length > 0)
      .slice(0, 5)
      .map(el => ({
        tag: el.tagName, cls: el.className.slice(0, 80),
        linkCount: el.querySelectorAll('a').length,
        sample: Array.from(el.querySelectorAll('a')).slice(0, 6).map(i => i.textContent.trim().slice(0, 20)).join(' | '),
      }));

    // ページネーション
    const pagerEls = Array.from(document.querySelectorAll('[class*="page"], [class*="pager"], [class*="navi"]'))
      .filter(el => /\d/.test(el.textContent))
      .slice(0, 3)
      .map(el => ({ tag: el.tagName, cls: el.className.slice(0, 60), text: el.textContent.trim().slice(0, 80) }));

    const url = location.href;
    return { url, countEls, countClsEls, tileCount, tileClass, brandEls, pagerEls };
  });

  console.log(`  実際のURL: ${listInfo.url}`);
  console.log('  件数含む要素:');
  listInfo.countEls.forEach(e => console.log(`    <${e.tag} class="${e.cls}"> → "${e.text}"`));
  console.log('  countTab/total/result系要素:');
  listInfo.countClsEls.forEach(e => console.log(`    <${e.tag} class="${e.cls}"> → "${e.text}"`));
  console.log(`  商品タイル数: ${listInfo.tileCount} (${listInfo.tileClass})`);
  console.log('  ブランド要素:');
  listInfo.brandEls.forEach(e =>
    console.log(`    <${e.tag} class="${e.cls}"> links=${e.linkCount}  sample: ${e.sample}`)
  );
  console.log('  ページネーション:');
  listInfo.pagerEls.forEach(e => console.log(`    <${e.tag} class="${e.cls}"> → "${e.text}"`));

  await browser.close();
})();
