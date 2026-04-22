/**
 * kakaku.com 商品ページ詳細構造調査 v3
 * ショップ特定の手がかりをリンクURLから探す
 */
const { chromium } = require('playwright');
const fs   = require('fs');
const path = require('path');

const ITEM_URL = 'https://kakaku.com/item/K0001695178/';
const SHOT_DIR = path.join(__dirname, '..', 'output', 'screenshots');
if (!fs.existsSync(SHOT_DIR)) fs.mkdirSync(SHOT_DIR, { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless: false, args: ['--disable-blink-features=AutomationControlled'] });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    locale: 'ja-JP', ignoreHTTPSErrors: true, viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();

  await page.goto(ITEM_URL, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForSelector('li.p-priceList_item', { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(2000);

  const info = await page.evaluate(() => {
    // ── 1. 各 li のショップセル内のリンクURLを確認 ──
    const itemLinks = Array.from(document.querySelectorAll('li.p-priceList_item')).slice(0, 20).map((li, i) => {
      const links = Array.from(li.querySelectorAll('a[href]')).map(a => a.href.slice(0, 120));
      const shopDirect  = li.querySelector('.p-priceList_shopNameSub')?.textContent.trim();
      const shopTooltip = li.querySelector('.p-tooltip_txt')?.textContent.trim();
      const priceEl     = li.querySelector('.p-priceList_price');
      const price       = priceEl?.textContent.trim().replace(/\s+/g, '');
      const shopCell    = li.querySelector('.p-priceList_data-shop');
      const shopCellHTML = shopCell?.innerHTML.replace(/\s+/g, ' ').slice(0, 300) ?? '';
      return { i, shopDirect, shopTooltip, price, links, shopCellHTML };
    });

    // ── 2. ページ内の全リンクでヨドバシ・Amazon含むものを探す ──
    const targetLinks = Array.from(document.querySelectorAll('a[href]'))
      .filter(a => /yodobashi|amazon\.co\.jp|biccamera/i.test(decodeURIComponent(a.href)))
      .slice(0, 10)
      .map(a => ({
        text: a.textContent.trim().slice(0, 40),
        href: a.href.slice(0, 120),
        parentClass: a.parentElement?.className,
        grandpaClass: a.parentElement?.parentElement?.className,
      }));

    // ── 3. 広告セクション（p-adMurauchi, p-priceCompare）の内容 ──
    const adSection = document.querySelector('.p-adMurauchi, .p-priceCompare_sub');
    const adHTML = adSection?.innerHTML.replace(/\s+/g, ' ').slice(0, 600) ?? 'なし';

    return { itemLinks, targetLinks, adHTML };
  });

  console.log('\n=== 各 li のリンクURL (先頭20件) ===');
  info.itemLinks.forEach(r => {
    console.log(`\n[li ${r.i}] shopDirect="${r.shopDirect}" shopTooltip="${r.shopTooltip}" price="${r.price}"`);
    console.log(`  shopCellHTML: ${r.shopCellHTML}`);
    r.links.forEach(l => console.log(`  link: ${l}`));
  });

  console.log('\n=== ヨドバシ・Amazon・Bicのリンク ===');
  info.targetLinks.forEach(l => console.log(`  text="${l.text}" parent="${l.parentClass}" grandpa="${l.grandpaClass}"\n  href=${l.href}`));

  console.log('\n=== 広告セクション ===');
  console.log(info.adHTML);

  await browser.close();
})();
