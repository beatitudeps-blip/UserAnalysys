/**
 * レポート生成 — Markdown + CSV + ブランド一覧CSV
 */

const fs   = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, '..', 'output');

const SITE_LABEL = s =>
  ({ yodobashi: 'ヨドバシカメラ', edion: 'エディオン', joshin: '上新電機', biccamera: 'ビックカメラ' }[s] ?? s);

const SITE_KEY = label =>
  ({ 'ヨドバシカメラ': 'yodobashi', 'エディオン': 'edion', '上新電機': 'joshin', 'ビックカメラ': 'biccamera' }[label] ?? label);

// 既存の集計CSVを読み込んで結果行の配列に変換（brands は含まない）
function loadExistingCsv(csvPath) {
  if (!fs.existsSync(csvPath)) return [];
  return fs.readFileSync(csvPath, 'utf8')
    .split('\n').slice(1)
    .filter(l => l.trim())
    .map(l => {
      const cols = l.match(/(".*?"|[^,]+)(?=,|$)/g) || [];
      const unquote = s => s?.replace(/^"|"$/g, '') ?? '';
      const [siteLabel, category, brandCount, productCount, url] = cols.map(unquote);
      return {
        site: SITE_KEY(siteLabel),
        category,
        url,
        brandCount:   brandCount   ? parseInt(brandCount,   10) : null,
        productCount: productCount ? parseInt(productCount, 10) : null,
        brands: [],
      };
    });
}

// 既存のブランドCSVを読み込む
function loadExistingBrandsCsv(brandsPath) {
  if (!fs.existsSync(brandsPath)) return [];
  return fs.readFileSync(brandsPath, 'utf8')
    .split('\n').slice(1)
    .filter(l => l.trim())
    .map(l => {
      const cols = l.match(/(".*?"|[^,]+)(?=,|$)/g) || [];
      const unquote = s => s?.replace(/^"|"$/g, '') ?? '';
      const [siteLabel, category, name, productCount] = cols.map(unquote);
      return {
        site: SITE_KEY(siteLabel),
        category,
        name,
        productCount: productCount ? parseInt(productCount, 10) : null,
      };
    });
}

function saveReports(results, date) {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  const csvPath    = path.join(OUT_DIR, `ec-catalog-${date}.csv`);
  const brandsPath = path.join(OUT_DIR, `ec-catalog-brands-${date}.csv`);

  // 今回対象外のサイトは既存ファイルから引き継ぐ
  const newSites = new Set(results.map(r => r.site));
  const keptRows   = loadExistingCsv(csvPath).filter(r => !newSites.has(r.site));
  const keptBrands = loadExistingBrandsCsv(brandsPath).filter(r => !newSites.has(r.site));
  const merged = [...keptRows, ...results];

  // ── 集計 Markdown ──
  const mdPath = path.join(OUT_DIR, `ec-catalog-${date}.md`);
  const lines = [
    `# EC カテゴリ別 ブランド数・商品数レポート`,
    ``,
    `生成日: ${date}`,
    ``,
  ];

  const sites = [...new Set(merged.map(r => r.site))];
  for (const site of sites) {
    lines.push(`## ${SITE_LABEL(site)}`, ``);
    lines.push(`| カテゴリ | ブランド数 | 商品数 |`);
    lines.push(`|---|---:|---:|`);
    for (const r of merged.filter(r => r.site === site)) {
      lines.push(`| ${r.category} | ${r.brandCount ?? '-'} | ${r.productCount ?? '-'} |`);
    }
    lines.push(``);
  }

  lines.push(`## サイト別サマリ`, ``);
  lines.push(`| サイト | カテゴリ数 | ブランド数合計 | 商品数合計 |`);
  lines.push(`|---|---:|---:|---:|`);
  for (const site of sites) {
    const rows = merged.filter(r => r.site === site);
    const brands   = rows.reduce((s, r) => s + (r.brandCount   ?? 0), 0);
    const products = rows.reduce((s, r) => s + (r.productCount ?? 0), 0);
    lines.push(`| ${SITE_LABEL(site)} | ${rows.length} | ${brands.toLocaleString()} | ${products.toLocaleString()} |`);
  }

  fs.writeFileSync(mdPath, lines.join('\n'), 'utf8');
  console.log(`  MD  → ${mdPath}`);

  // ── 集計 CSV ──
  const csvLines = ['サイト,カテゴリ,ブランド数,商品数,URL'];
  for (const r of merged) {
    csvLines.push(`${SITE_LABEL(r.site)},"${r.category}",${r.brandCount ?? ''},${r.productCount ?? ''},"${r.url}"`);
  }
  fs.writeFileSync(csvPath, '﻿' + csvLines.join('\n'), 'utf8');
  console.log(`  CSV → ${csvPath}`);

  // ── ブランド一覧 CSV ──
  const newBrandRows = [];
  for (const r of results) {
    for (const b of r.brands ?? []) {
      newBrandRows.push({ site: r.site, category: r.category, name: b.name, productCount: b.productCount });
    }
  }
  const allBrandRows = [...keptBrands, ...newBrandRows];

  const brandLines = ['サイト,カテゴリ,ブランド名,商品数'];
  for (const b of allBrandRows) {
    brandLines.push(`${SITE_LABEL(b.site)},"${b.category}","${b.name}",${b.productCount ?? ''}`);
  }
  fs.writeFileSync(brandsPath, '﻿' + brandLines.join('\n'), 'utf8');
  console.log(`  brands CSV → ${brandsPath}`);

  // ── ブランド数 検証 ──
  console.log('\n【ブランド数検証】');
  let allOk = true;
  for (const r of results) {
    const listCount = (r.brands ?? []).length;
    const reported  = r.brandCount ?? 0;
    const ok = listCount === reported;
    if (!ok) allOk = false;
    const mark = ok ? '✓' : '❌';
    console.log(`  ${mark} ${SITE_LABEL(r.site)} > ${r.category}: 集計=${reported}  リスト=${listCount}`);
  }
  if (allOk) console.log('  → 全カテゴリ一致');
}

module.exports = { saveReports };
