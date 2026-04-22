/**
 * 集計・レポート出力モジュール（Markdown + CSV）
 */

const fs   = require('fs');
const path = require('path');

const OUTPUT_DIR = path.join(__dirname, '..', 'output');

function ensureOutputDir() {
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

/**
 * 価格文字列から数値を抽出（集計用）
 */
function parsePrice(priceStr) {
  if (!priceStr) return null;
  const m = priceStr.replace(/,/g, '').match(/\d+/);
  return m ? parseInt(m[0], 10) : null;
}

/**
 * 最安値・最高値・差額の集計
 */
function summarize(row) {
  const prices = {
    エディオン:    parsePrice(row.edion),
    ヨドバシ:      parsePrice(row.yodobashi),
    Amazon:        parsePrice(row.amazon),
    ビックカメラ:  parsePrice(row.bic),
  };
  const valid = Object.entries(prices).filter(([, v]) => v !== null);
  if (valid.length === 0) return { ...prices, min: null, max: null, diff: null, cheapest: '-' };

  const minEntry = valid.reduce((a, b) => a[1] < b[1] ? a : b);
  const maxEntry = valid.reduce((a, b) => a[1] > b[1] ? a : b);
  return {
    ...prices,
    min:      minEntry[1],
    max:      maxEntry[1],
    diff:     maxEntry[1] - minEntry[1],
    cheapest: minEntry[0],
  };
}

/**
 * Markdown レポート生成
 */
function generateMarkdown(rows, date) {
  const categories = [...new Set(rows.map(r => r.category))];
  let md = `# 家電・電化製品 価格比較レポート\n\n調査日: ${date}\n\n`;
  md += `> kakaku.com 各カテゴリ ランキング上位3商品\n\n`;
  md += `---\n\n`;

  for (const cat of categories) {
    const items = rows.filter(r => r.category === cat);
    md += `## ${cat}\n\n`;
    md += `| ランク | 商品名 | kakaku最安 | エディオン | ヨドバシ | Amazon | ビックカメラ | 最安店 |\n`;
    md += `|:---:|--------|:--------:|:--------:|:------:|:------:|:----------:|:----:|\n`;

    items.forEach((r, i) => {
      const s = summarize(r);
      const fmt = (v) => v ? `¥${v.toLocaleString()}` : '-';
      md += `| ${i + 1} | ${r.name} | ${r.price || '-'} `;
      md += `| ${fmt(s.エディオン)} | ${fmt(s.ヨドバシ)} | ${fmt(s.Amazon)} | ${fmt(s.ビックカメラ)} `;
      md += `| **${s.cheapest}** |\n`;
    });
    md += '\n';
  }

  // 集計サマリ
  md += `---\n\n## 価格差が大きい商品 TOP10\n\n`;
  md += `| 商品名 | カテゴリ | 最安値 | 最高値 | 差額 | 最安店 |\n`;
  md += `|--------|---------|:-----:|:-----:|:----:|:----:|\n`;

  const withDiff = rows
    .map(r => ({ ...r, ...summarize(r) }))
    .filter(r => r.diff !== null)
    .sort((a, b) => b.diff - a.diff)
    .slice(0, 10);

  for (const r of withDiff) {
    const fmt = (v) => v ? `¥${v.toLocaleString()}` : '-';
    md += `| ${r.name} | ${r.category} | ${fmt(r.min)} | ${fmt(r.max)} | ${fmt(r.diff)} | **${r.cheapest}** |\n`;
  }

  return md;
}

/**
 * CSV 生成
 */
function generateCSV(rows) {
  const header = 'カテゴリ,商品名,kakaku最安,エディオン,ヨドバシ,Amazon,ビックカメラ,最安店,最安値,最高値,差額\n';
  const lines = rows.map(r => {
    const s = summarize(r);
    const fmt = (v) => v != null ? v : '';
    const esc = (s) => `"${String(s ?? '').replace(/"/g, '""')}"`;
    return [
      esc(r.category),
      esc(r.name),
      esc(r.price || ''),
      esc(fmt(s.エディオン)),
      esc(fmt(s.ヨドバシ)),
      esc(fmt(s.Amazon)),
      esc(fmt(s.ビックカメラ)),
      esc(s.cheapest),
      esc(fmt(s.min)),
      esc(fmt(s.max)),
      esc(fmt(s.diff)),
    ].join(',');
  });
  return header + lines.join('\n');
}

/**
 * Markdown と CSV を output/ に保存
 */
function saveReports(rows, date) {
  ensureOutputDir();

  const md  = generateMarkdown(rows, date);
  const csv = generateCSV(rows);

  const mdPath  = path.join(OUTPUT_DIR, `price-report-${date}.md`);
  const csvPath = path.join(OUTPUT_DIR, `price-report-${date}.csv`);

  fs.writeFileSync(mdPath,  md,  'utf-8');
  fs.writeFileSync(csvPath, csv, 'utf-8');

  console.log(`\n✓ Markdown : ${mdPath}`);
  console.log(`✓ CSV      : ${csvPath}`);

  return { mdPath, csvPath };
}

module.exports = { saveReports, summarize };
