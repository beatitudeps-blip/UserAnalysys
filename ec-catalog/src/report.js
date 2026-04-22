/**
 * レポート生成 — Markdown + CSV
 */

const fs   = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, '..', 'output');

function saveReports(results, date) {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  // ── Markdown ──
  const mdPath = path.join(OUT_DIR, `ec-catalog-${date}.md`);
  const lines = [
    `# EC カテゴリ別 ブランド数・商品数レポート`,
    ``,
    `生成日: ${date}`,
    ``,
  ];

  const sites = [...new Set(results.map(r => r.site))];
  for (const site of sites) {
    const siteLabel = { yodobashi: 'ヨドバシカメラ', edion: 'エディオン', joshin: '上新電機' }[site] ?? site;
    lines.push(`## ${siteLabel}`, ``);
    lines.push(`| カテゴリ | ブランド数 | 商品数 |`);
    lines.push(`|---|---:|---:|`);
    for (const r of results.filter(r => r.site === site)) {
      lines.push(`| ${r.category} | ${r.brandCount ?? '-'} | ${r.productCount ?? '-'} |`);
    }
    lines.push(``);
  }

  // サマリ: サイト別合計
  lines.push(`## サイト別サマリ`, ``);
  lines.push(`| サイト | カテゴリ数 | ブランド数合計 | 商品数合計 |`);
  lines.push(`|---|---:|---:|---:|`);
  for (const site of sites) {
    const siteLabel = { yodobashi: 'ヨドバシカメラ', edion: 'エディオン', joshin: '上新電機' }[site] ?? site;
    const rows = results.filter(r => r.site === site);
    const brands   = rows.reduce((s, r) => s + (r.brandCount   ?? 0), 0);
    const products = rows.reduce((s, r) => s + (r.productCount ?? 0), 0);
    lines.push(`| ${siteLabel} | ${rows.length} | ${brands.toLocaleString()} | ${products.toLocaleString()} |`);
  }

  fs.writeFileSync(mdPath, lines.join('\n'), 'utf8');
  console.log(`  MD  → ${mdPath}`);

  // ── CSV ──
  const csvPath = path.join(OUT_DIR, `ec-catalog-${date}.csv`);
  const csvLines = ['サイト,カテゴリ,ブランド数,商品数,URL'];
  for (const r of results) {
    const siteLabel = { yodobashi: 'ヨドバシカメラ', biccamera: 'ビックカメラ', edion: 'エディオン' }[r.site] ?? r.site;
    csvLines.push(`${siteLabel},"${r.category}",${r.brandCount ?? ''},${r.productCount ?? ''},"${r.url}"`);
  }
  fs.writeFileSync(csvPath, '﻿' + csvLines.join('\n'), 'utf8');
  console.log(`  CSV → ${csvPath}`);
}

module.exports = { saveReports };
