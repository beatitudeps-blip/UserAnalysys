# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

`price-investor` は株価・投資情報の収集・分析を行うプロジェクトです。Playwright を使ったWebスクレイピングを主な手段として想定しています。

## Tech Stack

- **Runtime**: Node.js (v22) / Python 3
- **Scraping**: Playwright v1.56.1
- **Language**: 未定（プロジェクト開始時に決定）

## Common Commands

```bash
# Playwright ブラウザのインストール（初回のみ）
npx playwright install

# スクリプト実行例（Node.js）
node src/index.js

# スクリプト実行例（Python）
python3 src/main.py

# Playwright テスト実行
npx playwright test

# 単一テストファイルの実行
npx playwright test tests/example.spec.ts

# テスト結果レポートの表示
npx playwright show-report
```

## Notes

- スクレイピング対象サイトの利用規約を必ず確認すること
- 取得データは `data/` ディレクトリに保存する運用を推奨
- APIキーや認証情報は `.env` で管理し、`.gitignore` に追加すること
