# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

`price-investor` は家電ECサイト（エディオン・ヨドバシ・Amazon・ビックカメラ）の価格を比較するPlaywrightスクリプトです。kakaku.com の家電カテゴリランキング上位商品を対象に価格一覧を生成します。

## Tech Stack

- **Runtime**: Node.js v18+
- **Scraping**: Playwright (`playwright` npm package)

## Project Structure

```
price-investor/
  src/
    price-research.js   # メイン: 全商品×全ECサイトの価格収集
    browser-test.js     # 疎通確認: 各サイトのスクリーンショット取得
  output/               # 出力先（gitignore済み）
    price-list-YYYY-MM-DD.md
    screenshots/
  package.json
```

## Setup & Commands

```bash
# 初回セットアップ
npm install
npm run setup           # Chromium をダウンロード

# 価格収集実行
npm start               # node src/price-research.js

# 疎通テスト（各サイトにアクセスしてスクリーンショット保存）
npm run test:browser    # node src/browser-test.js
```

出力ファイルは `output/price-list-YYYY-MM-DD.md` に保存されます。

## Architecture

`src/price-research.js` の構成:

1. **PRODUCTS 配列** — 調査対象商品リスト（カテゴリ・商品名）。kakaku.com で確認した商品名をここに書く。
2. **getEdion / getYodobashi / getAmazon / getBic** — 各ECサイトの検索ページを開き、最初の価格テキストを抽出。
3. **firstPrice()** — 複数のCSSセレクタを順に試して最初にヒットした価格文字列を返す共通ユーティリティ。
4. **出力** — カテゴリ別Markdownテーブルを `output/price-list-YYYY-MM-DD.md` に保存。

## Adjusting Target Products

`src/price-research.js` の `PRODUCTS` 配列を編集して調査対象を変更できます。

```js
const PRODUCTS = [
  { category: 'テレビ', name: 'Sony BRAVIA XRJ-55X90L' },
  // ...
];
```

## Notes

- このスクリプトはローカルPC（ネットワーク制限のない環境）で実行してください。
- `headless: false` のため実行中はブラウザウィンドウが表示されます。
- `--no-sandbox` フラグは Linux サーバー環境でのみ必要です。ローカルPCでは不要のため削除済みです。
