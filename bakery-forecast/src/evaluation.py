"""評価指標とレポート出力"""

from __future__ import annotations

import numpy as np
import pandas as pd


def rmse(actual: np.ndarray, predicted: np.ndarray) -> float:
    return float(np.sqrt(np.mean((actual - predicted) ** 2)))


def mae(actual: np.ndarray, predicted: np.ndarray) -> float:
    return float(np.mean(np.abs(actual - predicted)))


def mape(actual: np.ndarray, predicted: np.ndarray) -> float:
    mask = actual > 0
    return float(np.mean(np.abs((actual[mask] - predicted[mask]) / actual[mask])) * 100)


def evaluate_results(results_by_model: dict[str, dict[str, pd.DataFrame]]) -> pd.DataFrame:
    """モデル×商品の評価指標 DataFrame を返す"""
    rows = []
    for model_name, product_results in results_by_model.items():
        for product, df in product_results.items():
            a = df["actual"].values.astype(float)
            p = df["predicted"].values.astype(float)
            rows.append({
                "モデル":   model_name,
                "商品":     product,
                "RMSE":    round(rmse(a, p), 2),
                "MAE":     round(mae(a, p), 2),
                "MAPE(%)": round(mape(a, p), 2),
                "テスト日数": len(df),
            })
    return pd.DataFrame(rows)


def print_report(metrics: pd.DataFrame) -> None:
    print("\n" + "=" * 65)
    print("  需要予測モデル評価レポート")
    print("=" * 65)
    for model in metrics["モデル"].unique():
        sub = metrics[metrics["モデル"] == model]
        print(f"\n【{model}】")
        print(sub[["商品", "RMSE", "MAE", "MAPE(%)"]].to_string(index=False))
    print("\n【モデル別平均 MAPE (%)】")
    avg = metrics.groupby("モデル")["MAPE(%)"].mean().round(2).sort_values()
    print(avg.to_string())
    print("=" * 65)
