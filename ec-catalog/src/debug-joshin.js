/**
 * 上新電機（Joshin）サイト構造調査
 * npm run debug:joshin
 *
 * 調査ポイント:
 *   1. カテゴリURLパターン
 *   2. 商品数の取得方法
 *   3. ブランド/メーカー絞り込みの取得方法
 */
const { chromium } = require('playwright');

const TOP_URL = 'https://joshinweb.jp/';

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
    extraHTTPHeaders: { 'Accept-Language': 'ja-JP,ja;q=0.9' },
  });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    Object.defineProperty(navigator, 'languages', { get: () => ['ja-JP', 'ja'] });
    window.chrome = { runtime: {} };
  });
  const page = await context.newPage();

  // ── Step1: トップページ基本情報とカテゴリリンク ──
  console.log(`\n[Step1] トップページ: ${TOP_URL}`);
  await page.goto(TOP_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);

  const topInfo = await page.evaluate(() => {
    const allLinks = Array.from(document.querySelectorAll('a[href]'))
      .map(a => ({ text: a.textContent.trim().replace(/\s+/g, ' ').slice(0, 40), href: a.href }))
      .filter(a => a.text && a.href.includes('joshin'));

    // URLパスパターン
    const patterns = [...new Set(
      allLinks.map(a => { try { const u = new URL(a.href); const p = u.pathname.split('/').filter(Boolean); return p.length ? `/${p[0]}/` : '/'; } catch { return null; } }).filter(Boolean)
    )];

    // カテゴリっぽいリンク（第1階層）
    const catLinks = allLinks
      .filter((a, i, arr) => arr.findIndex(b => b.href === a.href) === i)
      .filter(a => !/joshinweb\.jp\/(cart|login|mypage|help|company|static|common|img)/i.test(a.href))
      .slice(0, 30);

    return {
      title: document.title,
      bodyLen: document.body.innerHTML.length,
      links: document.querySelectorAll('a[href]').length,
      patterns,
      catLinks,
    };
  });

  console.log(`  タイトル: ${topInfo.title}`);
  console.log(`  body長: ${topInfo.bodyLen}  リンク数: ${topInfo.links}`);
  console.log(`  URLパスパターン: ${topInfo.patterns.join(', ')}`);
  console.log('  カテゴリリンク候補:');
  topInfo.catLinks.forEach(l => console.log(`    "${l.text}" => ${l.href}`));

  if (topInfo.links === 0) {
    console.log('\n  ⚠ リンクなし。ブロックされている可能性があります。');
    await browser.close();
    return;
  }

  // ── Step2: カテゴリページの商品数・ブランド構造 ──
  const catUrl = topInfo.catLinks.find(l => !/^https:\/\/joshinweb\.jp\/?$/.test(l.href))?.href;
  if (!catUrl) { console.log('\n  カテゴリURL特定できず'); await browser.close(); return; }

  console.log(`\n[Step2] カテゴリページ: ${catUrl}`);
  await page.goto(catUrl, { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(3000);
  await page.evaluate(() => window.scrollTo(0, 600));
  await page.waitForTimeout(1500);

  const catInfo = await page.evaluate(() => {
    // 「件」含む要素
    const countEls = Array.from(document.querySelectorAll('*'))
      .filter(el => el.children.length === 0 && /[\d,]+件/.test(el.textContent))
      .slice(0, 8)
      .map(el => ({ tag: el.tagName, cls: el.className.slice(0, 80), text: el.textContent.trim() }));

    // 商品タイル数
    const tileSelectors = [
      '[class*="itemList"] li', '[class*="productList"] li',
      '[class*="list"] li', '.itmUnit', '[class*="item"] li',
    ];
    let tileCount = 0, tileClass = '';
    for (const sel of tileSelectors) {
      const items = document.querySelectorAll(sel);
      if (items.length > 1) { tileCount = items.length; tileClass = sel; break; }
    }

    // ブランド/メーカー要素
    const brandEls = Array.from(document.querySelectorAll('[class*="maker"], [class*="brand"], [class*="Brand"], [class*="Maker"], [class*="mfr"]'))
      .filter(el => el.querySelectorAll('a, li, label').length > 0)
      .slice(0, 5)
      .map(el => ({
        tag: el.tagName, cls: el.className.slice(0, 80),
        linkCount: el.querySelectorAll('a').length,
        liCount: el.querySelectorAll('li').length,
        sample: Array.from(el.querySelectorAll('a, li')).slice(0, 6).map(i => i.textContent.trim().slice(0, 20)).join(' | '),
      }));

    // クラス名ヒント
    const allClasses = [...new Set(
      Array.from(document.querySelectorAll('*')).map(el => el.className)
        .filter(c => typeof c === 'string').join(' ').split(/\s+/)
    )].filter(c => /maker|brand|count|total|result|filter|product|item/i.test(c)).slice(0, 30);

    // ページネーション
    const pagerEls = Array.from(document.querySelectorAll('[class*="page"], [class*="Page"], [class*="pager"]'))
      .filter(el => /\d/.test(el.textContent))
      .slice(0, 3)
      .map(el => ({ tag: el.tagName, cls: el.className.slice(0, 60), text: el.textContent.trim().slice(0, 80) }));

    return { countEls, tileCount, tileClass, brandEls, allClasses, pagerEls };
  });

  console.log('  件数含む要素:');
  catInfo.countEls.forEach(e => console.log(`    <${e.tag} class="${e.cls}"> → "${e.text}"`));
  console.log(`  商品タイル数: ${catInfo.tileCount} (${catInfo.tileClass})`);
  console.log('  ブランド/メーカー要素:');
  catInfo.brandEls.forEach(e =>
    console.log(`    <${e.tag} class="${e.cls}"> links=${e.linkCount} li=${e.liCount}\n      sample: ${e.sample}`)
  );
  console.log('  ページネーション:');
  catInfo.pagerEls.forEach(e => console.log(`    <${e.tag} class="${e.cls}"> → "${e.text}"`));
  console.log('  関連クラス名:', catInfo.allClasses.join(', '));

  await browser.close();
})();
