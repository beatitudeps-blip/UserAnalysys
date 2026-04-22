# price-investor

家電カテゴリのランキング商品を、エディオン・ヨドバシ・Amazon・ビックカメラで価格比較するPlaywrightスクリプト。

## セットアップ

```bash
npm install playwright
npx playwright install chromium
```

## 実行

```bash
node price-research.js
```

ブラウザが起動し、各ECサイトを巡回して価格を収集します。完了すると `price-list-YYYY-MM-DD.md` が生成されます。

## 調査対象商品の変更

`price-research.js` の `PRODUCTS` 配列を編集してください。

```js
const PRODUCTS = [
  { category: 'テレビ', name: 'Sony BRAVIA XRJ-55X90L' },
  // ...
];
```

## 注意事項

- このスクリプトは**ローカルPCから実行**してください（サーバー環境はIPブロックされます）
- 実行間隔にランダムな待機時間を挿入してサーバー負荷を抑えています
- APIキーは不要です

## 出力例

```
price-list-2026-04-22.md
```

| 商品名 | エディオン | ヨドバシ | Amazon | ビックカメラ |
|--------|----------|---------|--------|------------|
| Sony BRAVIA XRJ-55X90L | ¥198,000 | ¥195,800 | ¥192,500 | ¥197,000 |
