/**
 * エディオン サイト構造調査 v5
 * npm run debug:edion
 *
 * 目的: ul.maker li のテキスト形式確認 + ブランド名(件数)リストの構造調査
 */
const { chromium } = require('playwright');

const URLS = {
  冷蔵庫一覧: 'https://www.edion.com/item_list.html?c_cd=001001001',
  洗濯機一覧: 'https://www.edion.com/item_list.html?c_cd=001001003',
};

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

  for (const [label, url] of Object.entries(URLS)) {
    console.log(`\n====== ${label}: ${url} ======`);
    await page.goto(url, { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(4000);
    await page.evaluate(() => window.scrollTo(0, 600));
    await page.waitForTimeout(1500);

    const info = await page.evaluate(() => {
      // 1. ul.maker li の全テキスト（件数が入っているか確認）
      const makerLis = Array.from(document.querySelectorAll('ul.maker li'));
      const makerSamples = makerLis.slice(0, 20).map(li => ({
        text: li.textContent.trim().replace(/\s+/g, ' '),
        aText: li.querySelector('a')?.textContent.trim() ?? '',
        spanTexts: Array.from(li.querySelectorAll('span')).map(s => s.textContent.trim()),
      }));

      // 2. 「ブランド名(数字)」パターンを含む要素
      const lisWithCount = Array.from(document.querySelectorAll('li, a, label'))
        .filter(el => /^.{1,30}\(\d+\)$/.test(el.textContent.trim()))
        .filter(el => !el.closest('script, style'))
        .slice(0, 20)
        .map(el => ({
          tag: el.tagName,
          cls: el.className?.slice(0, 60) ?? '',
          parentCls: el.parentElement?.className?.slice(0, 60) ?? '',
          text: el.textContent.trim(),
        }));

      // 3. (数字)を3個以上含む親コンテナ
      const containers = Array.from(document.querySelectorAll('ul, ol, div'))
        .filter(el => {
          const matches = el.textContent.match(/\(\d+\)/g);
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
        .slice(0, 6);

      // 4. 商品数
      const titleEl = document.querySelector('p.title');
      const totalCount = titleEl?.textContent.trim() ?? '(なし)';

      return { makerSamples, makerLiCount: makerLis.length, lisWithCount, containers, totalCount };
    });

    console.log(`  総商品数テキスト: "${info.totalCount}"`);
    console.log(`\n  ul.maker li 数: ${info.makerLiCount}`);
    console.log('  ul.maker li サンプル（最大20件）:');
    info.makerSamples.forEach(s =>
      console.log(`    text="${s.text}"  a="${s.aText}"  spans=[${s.spanTexts.join(', ')}]`)
    );

    console.log(`\n  「ブランド名(数字)」パターン要素 (${info.lisWithCount.length}件):`);
    info.lisWithCount.slice(0, 10).forEach(e =>
      console.log(`    <${e.tag} class="${e.cls}"> parent="${e.parentCls}" → "${e.text}"`)
    );

    console.log(`\n  (数字)を3個以上含む親コンテナ:`);
    info.containers.forEach(c =>
      console.log(`    <${c.tag} id="${c.id}" class="${c.cls}"> matches=${c.matchCount} children=${c.childCount}\n      sample: "${c.sample}"`)
    );
  }

  await browser.close();
})();
