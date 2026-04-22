# CLAUDE.md

## Project Overview

ヨドバシカメラ・ビックカメラ・エディオン の各ECサイトを Playwright でスクレイピングし、カテゴリ別のブランド数・商品数を集計するツール。

## Project Structure

```
ec-catalog/
  src/
    main.js             # エントリーポイント（3サイト一括実行）
    yodobashi.js        # ヨドバシカメラ スクレイパー
    biccamera.js        # ビックカメラ スクレイパー
    edion.js            # エディオン スクレイパー
    report.js           # Markdown + CSV レポート生成
    debug-yodobashi.js  # ヨドバシ HTML構造調査
    debug-bic.js        # ビックカメラ HTML構造調査
    debug-edion.js      # エディオン HTML構造調査
  output/               # 生成ファイル（gitignore済み）
    ec-catalog-YYYY-MM-DD.md
    ec-catalog-YYYY-MM-DD.csv
  package.json
```

## Setup & Commands

```bash
npm run local:setup          # 初回: npm install + Chromium インストール
npm run local                # 全サイト実行
node src/main.js yodobashi   # ヨドバシのみ
node src/main.js bic         # ビックカメラのみ
node src/main.js edion       # エディオンのみ

npm run debug:yodobashi      # HTML構造調査（セレクタ確認用）
npm run debug:bic
npm run debug:edion
```

## Architecture

### 各サイト scraper（yodobashi.js / biccamera.js / edion.js）
1. `fetchCategories(page)` — トップナビからカテゴリ URL 一覧を取得
2. `fetchCategoryStats(page, category)` — カテゴリページで商品数・ブランド数を抽出

### 取得データ
- カテゴリ名
- ブランド数（左サイドのメーカー絞り込みリストの件数）
- 商品数（ページに表示される "XX件" の数字）

## Notes

- **ネットワーク制限のないローカルPCで実行**してください
- 各サイトの HTML 構造は変わりやすいため、セレクタが外れた場合は `debug-*.js` で調査してください
- 初回実行でセレクタが当たらない場合は `debug:*` スクリプトの出力を参考に `fetchCategories` / `fetchCategoryStats` を修正してください
