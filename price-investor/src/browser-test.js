const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SITES = [
  { name: 'kakaku_tv',  url: 'https://kakaku.com/kaden/tv/ranking/' },
  { name: 'edion',      url: 'https://www.edion.com/' },
  { name: 'yodobashi',  url: 'https://www.yodobashi.com/' },
  { name: 'amazon',     url: 'https://www.amazon.co.jp/' },
  { name: 'biccamera',  url: 'https://www.biccamera.com/bc/main/' },
];

const outDir = path.join(__dirname, '..', 'output', 'screenshots');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

(async () => {
  console.log('ブラウザ起動中...\n');
  const browser = await chromium.launch({
    headless: false,
    args: ['--disable-blink-features=AutomationControlled'],
  });
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 900 },
    locale: 'ja-JP',
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();

  for (const site of SITES) {
    console.log(`アクセス中: ${site.url}`);
    try {
      const res = await page.goto(site.url, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForTimeout(2500);
      const shot = path.join(outDir, `${site.name}.png`);
      await page.screenshot({ path: shot, fullPage: false });
      console.log(`  ステータス : ${res?.status()}`);
      console.log(`  タイトル   : ${await page.title()}`);
      console.log(`  スクリーンショット: ${shot}\n`);
    } catch (e) {
      console.log(`  エラー: ${e.message.split('\n')[0]}\n`);
    }
  }

  await browser.close();
  console.log(`完了。output/screenshots/ を確認してください。`);
})();
