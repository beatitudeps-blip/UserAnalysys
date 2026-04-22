/**
 * エディオン サイト構造調査 v3
 * npm run debug:edion
 *
 * 前回判明: カテゴリURL = category001.html?c_cd=001XXX
 * 今回: category001ページの商品数・ブランド構造を調査
 */
const { chromium } = require('playwright');

// 確認済みカテゴリURL
const CAT_URL  = 'https://www.edion.com/category001.html?c_cd=001001'; // 冷蔵庫・洗濯機
const CAT_LIST = 'https://www.edion.com/category_list.html';           // カテゴリ一覧

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

  // ── Step1: カテゴリ一覧ページ ──
  console.log(`\n[Step1] カテゴリ一覧: ${CAT_LIST}`);
  await page.goto(CAT_LIST, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);

  const listInfo = await page.evaluate(() => {
    const title = document.title;
    const links = Array.from(document.querySelectorAll('a[href*="c_cd="]'))
      .map(a => ({ text: a.textContent.trim().replace(/\s+/g, ' ').slice(0, 50), href: a.href }))
      .filter((a, i, arr) => arr.findIndex(b => b.href === a.href) === i)
      .slice(0, 30);
    return { title, links, bodyLen: document.body.innerHTML.length };
  });
  console.log(`  title: ${listInfo.title}  body長: ${listInfo.bodyLen}`);
  console.log('  c_cd リンク:');
  listInfo.links.forEach(l => console.log(`    "${l.text}" => ${l.href}`));

  // ── Step2: 冷蔵庫・洗濯機カテゴリページ ──
  console.log(`\n[Step2] カテゴリページ: ${CAT_URL}`);
  await page.goto(CAT_URL, { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(4000);
  await page.evaluate(() => window.scrollTo(0, 600));
  await page.waitForTimeout(1500);

  const catInfo = await page.evaluate(() => {
    const url   = location.href;
    const title = document.title;
    const bodyLen = document.body.innerHTML.length;

    // 件数含む要素
    const countEls = Array.from(document.querySelectorAll('*'))
      .filter(el => el.children.length === 0 && /[\d,]+(件|点)/.test(el.textContent))
      .slice(0, 10)
      .map(el => ({ tag: el.tagName, cls: el.className.slice(0, 80), text: el.textContent.trim() }));

    // 商品タイルセレクタ
    const tileTests = [
      '[class*="itemList"] li', '[class*="productList"] li',
      '[class*="list"] li', '[class*="item"] li',
      '.productItem', '.searchItem', '.resultItem',
    ].map(sel => ({ sel, count: document.querySelectorAll(sel).length }))
     .filter(t => t.count > 0);

    // ブランド/メーカー
    const brandEls = Array.from(document.querySelectorAll(
      '[class*="maker"], [class*="brand"], [class*="Brand"], [class*="Maker"], [class*="mfr"]'
    )).filter(el => el.querySelectorAll('a, li').length > 0)
      .slice(0, 5)
      .map(el => ({
        tag: el.tagName, cls: el.className.slice(0, 80),
        count: el.querySelectorAll('a, li').length,
        sample: Array.from(el.querySelectorAll('a, li')).slice(0, 5).map(i => i.textContent.trim().slice(0, 20)).join(' | '),
      }));

    // サブカテゴリ（c_cd 付きリンク）
    const subCats = Array.from(document.querySelectorAll('a[href*="c_cd="]'))
      .map(a => ({ text: a.textContent.trim().replace(/\s+/g, ' ').slice(0, 40), href: a.href }))
      .filter((a, i, arr) => arr.findIndex(b => b.href === a.href) === i)
      .slice(0, 20);

    // item_list.html リンク
    const itemListLinks = Array.from(document.querySelectorAll('a[href*="item_list"]'))
      .map(a => ({ text: a.textContent.trim().slice(0, 40), href: a.href }))
      .slice(0, 10);

    // クラス名ヒント
    const allClasses = [...new Set(
      Array.from(document.querySelectorAll('*')).map(el => el.className)
        .filter(c => typeof c === 'string').join(' ').split(/\s+/)
    )].filter(c => /maker|brand|count|total|result|filter|item|product|list/i.test(c)).slice(0, 40);

    return { url, title, bodyLen, countEls, tileTests, brandEls, subCats, itemListLinks, allClasses };
  });

  console.log(`  title: ${catInfo.title}  body長: ${catInfo.bodyLen}`);
  console.log('  件数含む要素:');
  catInfo.countEls.forEach(e => console.log(`    <${e.tag} class="${e.cls}"> → "${e.text}"`));
  console.log('  タイルセレクタ:');
  catInfo.tileTests.forEach(t => console.log(`    ${t.sel}: ${t.count}`));
  console.log('  ブランド要素:');
  catInfo.brandEls.forEach(e =>
    console.log(`    <${e.tag} class="${e.cls}"> count=${e.count}  sample: ${e.sample}`)
  );
  console.log('  サブカテゴリ (c_cd):');
  catInfo.subCats.forEach(l => console.log(`    "${l.text}" => ${l.href}`));
  console.log('  item_list リンク:');
  catInfo.itemListLinks.forEach(l => console.log(`    "${l.text}" => ${l.href}`));
  console.log('  クラス名ヒント:', catInfo.allClasses.join(', '));

  await browser.close();
})();
