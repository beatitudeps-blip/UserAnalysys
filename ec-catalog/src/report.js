/**
 * レポート生成 — Markdown + CSV
 */

const fs   = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, '..', 'output');

function loadExistingCsv(csvPath) {
  if (!fs.existsSync(csvPath)) return [];
  const siteKeyMap = { 'ヨドバシカメラ': 'yodobashi', 'エディオン': 'edion', '上新電機': 'joshin', 'ビックカメラ': 'biccamera' };
  return fs.readFileSync(csvPath, 'utf8')
    .split('\n').slice(1)
    .filter(l => l.trim())
    .map(l => {
      const cols = l.match(/(".*?"|[^,]+)(?=,|$)/g) || [];
      const unquote = s => s?.replace(/^"|"$/g, '') ?? '';
      const [siteLabel, category, brandCount, productCount, url] = cols.map(unquote);
      return {
        site: siteKeyMap[siteLabel] ?? siteLabel,
        category,
        url,
        brandCount:   brandCount   ? parseInt(brandCount,   10) : null,
        productCount: productCount ? parseInt(productCount, 10) : null,
      };
    });
}

function saveReports(results, date) {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  const csvPath = path.join(OUT_DIR, `ec-catalog-${date}.csv`);

  // 今回対象外のサイトは既存CSVから引き継ぐ
  const newSites = new Set(results.map(r => r.site));
  const kept = loadExistingCsv(csvPath).filter(r => !newSites.has(r.site));
  const merged = [...kept, ...results];

  // ── Markdown ──
  const mdPath = path.join(OUT_DIR, `ec-catalog-${date}.md`);
  const lines = [
    `# EC カテゴリ別 ブランド数・商品数レポート`,
    ``,
    `生成日: ${date}`,
    ``,
  ];

  const siteLabel = s => ({ yodobashi: 'ヨドバシカメラ', edion: 'エディオン', joshin: '上新電機', biccamera: 'ビックカメラ' }[s] ?? s);
  const sites = [...new Set(merged.map(r => r.site))];
  for (const site of sites) {
    lines.push(`## ${siteLabel(site)}`, ``);
    lines.push(`| カテゴリ | ブランド数 | 商品数 |`);
    lines.push(`|---|---:|---:|`);
    for (const r of merged.filter(r => r.site === site)) {
      lines.push(`| ${r.category} | ${r.brandCount ?? '-'} | ${r.productCount ?? '-'} |`);
    }
    lines.push(``);
  }

  // サマリ: サイト別合計
  lines.push(`## サイト別サマリ`, ``);
  lines.push(`| サイト | カテゴリ数 | ブランド数合計 | 商品数合計 |`);
  lines.push(`|---|---:|---:|---:|`);
  for (const site of sites) {
    const rows = merged.filter(r => r.site === site);
    const brands   = rows.reduce((s, r) => s + (r.brandCount   ?? 0), 0);
    const products = rows.reduce((s, r) => s + (r.productCount ?? 0), 0);
    lines.push(`| ${siteLabel(site)} | ${rows.length} | ${brands.toLocaleString()} | ${products.toLocaleString()} |`);
  }

  fs.writeFileSync(mdPath, lines.join('\n'), 'utf8');
  console.log(`  MD  → ${mdPath}`);

  // ── CSV ──
  const csvLines = ['サイト,カテゴリ,ブランド数,商品数,URL'];
  for (const r of merged) {
    csvLines.push(`${siteLabel(r.site)},"${r.category}",${r.brandCount ?? ''},${r.productCount ?? ''},"${r.url}"`);
  }
  fs.writeFileSync(csvPath, '﻿' + csvLines.join('\n'), 'utf8');
  console.log(`  CSV → ${csvPath}`);
}

module.exports = { saveReports };
