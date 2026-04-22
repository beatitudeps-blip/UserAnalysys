/**
 * ビックカメラ サイト構造調査 v5 — 最大ステルス
 * npm run debug:bic
 */
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({
    headless: false,
    // --enable-automation フラグを除去（最重要）
    ignoreDefaultArgs: ['--enable-automation'],
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-infobars',
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--no-first-run',
      '--disable-background-networking',
      '--start-maximized',
    ],
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    locale: 'ja-JP',
    timezoneId: 'Asia/Tokyo',
    ignoreHTTPSErrors: true,
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    colorScheme: 'light',
    extraHTTPHeaders: {
      'Accept-Language': 'ja-JP,ja;q=0.9,en-US;q=0.8,en;q=0.7',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'sec-ch-ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"macOS"',
    },
  });

  // 強化ステルス: automation 検出を全面的に無効化
  await context.addInitScript(() => {
    // webdriver 隠蔽
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });

    // plugins を本物らしく
    const pluginData = [
      { name: 'PDF Viewer', description: 'Portable Document Format', filename: 'internal-pdf-viewer' },
      { name: 'Chrome PDF Viewer', description: '', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai' },
      { name: 'Chromium PDF Viewer', description: '', filename: 'internal-pdf-viewer' },
      { name: 'Microsoft Edge PDF Viewer', description: '', filename: 'msedgepdf' },
      { name: 'WebKit built-in PDF', description: '', filename: 'webkit-pdf' },
    ];
    Object.defineProperty(navigator, 'plugins', {
      get: () => Object.assign(pluginData, { item: i => pluginData[i], namedItem: n => pluginData.find(p => p.name === n), refresh: () => {} }),
    });

    // languages
    Object.defineProperty(navigator, 'languages', { get: () => ['ja-JP', 'ja', 'en-US', 'en'] });
    Object.defineProperty(navigator, 'platform',  { get: () => 'MacIntel' });
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
    Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });

    // permissions
    const origQuery = window.navigator.permissions.query;
    window.navigator.permissions.query = p =>
      p.name === 'notifications'
        ? Promise.resolve({ state: Notification.permission })
        : origQuery(p);

    // chrome runtime
    window.chrome = {
      runtime: {
        id: 'nmmhkkegccagdldgiimedpiccmgmieda',
        connect: () => ({}),
        sendMessage: () => {},
        onMessage: { addListener: () => {} },
      },
      loadTimes: () => ({}),
      csi: () => ({}),
    };

    // screen
    Object.defineProperty(screen, 'width',       { get: () => 1440 });
    Object.defineProperty(screen, 'height',      { get: () => 900  });
    Object.defineProperty(screen, 'availWidth',  { get: () => 1440 });
    Object.defineProperty(screen, 'availHeight', { get: () => 877  });
    Object.defineProperty(screen, 'colorDepth',  { get: () => 24   });
  });

  const page = await context.newPage();

  // リアルな動作をエミュレート: マウス移動
  await page.mouse.move(200, 300);

  console.log('\n[Step1] アクセス: https://www.biccamera.com/');
  await page.goto('https://www.biccamera.com/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);
  await page.mouse.move(400, 400);
  await page.waitForTimeout(2000);

  const state = await page.evaluate(() => ({
    url:      location.href,
    title:    document.title,
    bodyLen:  document.body.innerHTML.length,
    links:    document.querySelectorAll('a[href]').length,
    bodyText: document.body.innerText.slice(0, 300).replace(/\s+/g, ' '),
  }));
  console.log('  URL    :', state.url);
  console.log('  タイトル:', state.title);
  console.log('  body長 :', state.bodyLen, ' リンク数:', state.links);
  console.log('  本文   :', state.bodyText);

  if (state.links > 0) {
    const links = await page.evaluate(() =>
      Array.from(document.querySelectorAll('a[href]'))
        .map(a => ({ text: a.textContent.trim().replace(/\s+/g, ' ').slice(0, 40), href: a.href }))
        .filter(a => a.text && a.href.startsWith('http'))
        .filter((a, i, arr) => arr.findIndex(b => b.href === a.href) === i)
        .slice(0, 30)
    );
    console.log('\n[Step2] リンク:');
    links.forEach(l => console.log(`  "${l.text}" => ${l.href}`));
  }

  await browser.close();
})();
