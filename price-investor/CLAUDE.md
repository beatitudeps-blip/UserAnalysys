# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

kakaku.com の家電・電化製品カテゴリ（25カテゴリ）のランキング上位5商品を対象に、エディオン・ヨドバシ・Amazon・ビックカメラの販売価格を比較集計するPlaywrightスクリプト。

## Project Structure

```
price-investor/
  src/
    price-research.js   # メインスクリプト（3フェーズ処理）
    kakaku.js           # Phase1: kakaku.com ランキングスクレイパー
    ec-prices.js        # Phase2: EC各サイト価格取得
    report.js           # Phase3: Markdown + CSV レポート生成
    browser-test.js     # 疎通確認ツール
  output/               # 生成ファイル（gitignore済み）
    price-report-YYYY-MM-DD.md
    price-report-YYYY-MM-DD.csv
    screenshots/
  package.json
```

## Setup & Commands

```bash
npm install
npm run setup        # Chromium をダウンロード（初回のみ）
npm start            # 調査実行
npm run test:browser # 各サイト疎通確認（スクリーンショット保存）
```

## Architecture（3フェーズ）

### Phase 1 — kakaku.com スクレイピング（`src/kakaku.js`）
- 25カテゴリのランキングページを巡回
- 1カテゴリあたり上位5商品（`TOP_N = 5`）を取得
- セレクタ戦略 A→B の順にフォールバック

### Phase 2 — EC価格チェック（`src/ec-prices.js`）
- Edion / Yodobashi / Amazon / BicCamera の検索結果から最初の価格を抽出
- `firstPrice()` が複数CSSセレクタを順に試す

### Phase 3 — レポート生成（`src/report.js`）
- カテゴリ別 Markdown テーブル（最安店ハイライト付き）
- 価格差 TOP10 サマリ
- CSV（集計値: 最安値・最高値・差額・最安店）

## 対象カテゴリ（25カテゴリ）

家電・白物: テレビ / 冷蔵庫 / 洗濯機 / エアコン / 電子レンジ / 掃除機 / ロボット掃除機 / 炊飯器 / ドライヤー / 空気清浄機 / 加湿器 / 食器洗い機 / 電気ケトル / オーブントースター

AV・理美容: イヤホン・ヘッドホン / スピーカー / シェーバー / モバイルバッテリー

デジタル: ノートPC / タブレット / プリンター / スマートフォン / スマートウォッチ / デジタルカメラ / ゲーム機

## Notes

- **ネットワーク制限のないローカルPCで実行**してください（Claude Code 環境はプロキシでブロックされます）
- kakaku.com から商品が取得できない場合は即終了します（`process.exit(1)`）
- `TOP_N` を `src/kakaku.js` で変更するとランキング取得数を調整できます
