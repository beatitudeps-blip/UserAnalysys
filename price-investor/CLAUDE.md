# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

`price-investor` は家電ECサイト（エディオン・ヨドバシ・Amazon・ビックカメラ）の価格を比較するPlaywrightスクリプト群です。kakaku.com の家電カテゴリランキング上位商品を対象に価格一覧を生成します。

## Tech Stack

- **Runtime**: Node.js v22
- **Scraping**: Playwright (`playwright` npm package)
- **Chromium**: `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`（環境内インストール済み）

## Scripts

| ファイル | 用途 |
|---------|------|
| `price-research.js` | メイン: 全商品×全ECサイトの価格収集 → `price-list-YYYY-MM-DD.md` 出力 |
| `browser-test.js`   | 疎通確認: 各サイトにアクセスしてスクリーンショットを `screenshots/` に保存 |

## Common Commands

```bash
# 依存インストール（初回）
npm install

# メイン実行（xvfb必須: X サーバーがない環境）
xvfb-run -a node price-research.js

# 疎通テスト
xvfb-run -a node browser-test.js

# ローカルPC（X サーバーあり）では xvfb-run 不要
node price-research.js
```

## Architecture

`price-research.js` の構成:

1. **PRODUCTS 配列** — 調査対象商品リスト（カテゴリ・商品名）。kakaku.com で確認したランキング1位の商品名をここに書く。
2. **getEdion / getYodobashi / getAmazon / getBic** — 各ECサイトの検索ページを開き、最初の価格テキストを抽出。
3. **firstPrice()** — 複数のCSSセレクタを順に試して最初にヒットした価格文字列を返す共通ユーティリティ。
4. **出力** — カテゴリ別Markdownテーブルを `price-list-YYYY-MM-DD.md` に保存。

## Network Constraint

このClaude Code環境はネットワークプロキシにより**外部サイトへのアクセスが全てブロック**されています（"Host not in allowlist"）。`price-research.js` はネットワーク制限のないローカルPCで実行してください。`executablePath` はローカルPC実行時は削除またはコメントアウトし、`npx playwright install chromium` でブラウザをインストールしてください。

## Adjusting Target Products

`price-research.js` の `PRODUCTS` 配列を編集するだけで調査対象を変更できます。

```js
const PRODUCTS = [
  { category: 'テレビ', name: 'Sony BRAVIA XRJ-55X90L' },
  // ...
];
```
