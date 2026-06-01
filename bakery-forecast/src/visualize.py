"""可視化ユーティリティ"""

from __future__ import annotations
from pathlib import Path

import matplotlib
matplotlib.use("Agg")  # GUI不要
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
import pandas as pd


# 日本語フォントを優先し、なければ英数字表示にフォールバック
import matplotlib.font_manager as _fm
_jp_fonts = [f.name for f in _fm.fontManager.ttflist if any(
    kw in f.name for kw in ("Noto", "IPAex", "Hiragino", "Yu Gothic", "MS Gothic", "TakaoPGothic")
)]
plt.rcParams["font.family"] = _jp_fonts[:1] + ["DejaVu Sans"] if _jp_fonts else ["DejaVu Sans"]

# 英語ラベルへの対応表 (フォントがない環境向け)
_JP_TO_EN = {
    "食パン": "Shokupan", "クロワッサン": "Croissant",
    "バゲット": "Baguette", "メロンパン": "Melon Bun", "あんぱん": "Anpan",
}


def _label(name: str) -> str:
    return name if _jp_fonts else _JP_TO_EN.get(name, name)


def plot_forecast(
    results: dict[str, pd.DataFrame],
    model_name: str,
    output_dir: Path,
) -> None:
    """商品ごとの実績 vs 予測グラフを保存"""
    output_dir.mkdir(parents=True, exist_ok=True)
    products = list(results.keys())
    fig, axes = plt.subplots(len(products), 1, figsize=(14, 4 * len(products)), sharex=False)
    if len(products) == 1:
        axes = [axes]

    for ax, (product, df) in zip(axes, results.items()):
        ax.plot(df["date"], df["actual"],    label="Actual",    color="steelblue",  linewidth=1.5)
        ax.plot(df["date"], df["predicted"], label="Predicted", color="tomato",     linewidth=1.5, linestyle="--")
        ax.set_title(f"{_label(product)} — {model_name}", fontsize=12)
        ax.set_ylabel("Sales (units)")
        ax.xaxis.set_major_formatter(mdates.DateFormatter("%m/%d"))
        ax.xaxis.set_major_locator(mdates.WeekdayLocator(byweekday=0, interval=2))
        ax.legend(fontsize=9)
        ax.grid(alpha=0.3)

    fig.suptitle(f"Bakery Demand Forecast — {model_name}", fontsize=14, y=1.01)
    plt.tight_layout()
    path = output_dir / f"forecast_{model_name.lower()}.png"
    fig.savefig(path, dpi=120, bbox_inches="tight")
    plt.close(fig)
    print(f"  saved: {path}")


def plot_metrics_comparison(metrics: pd.DataFrame, output_dir: Path) -> None:
    """モデル×商品の MAPE 棒グラフを保存"""
    output_dir.mkdir(parents=True, exist_ok=True)
    pivot = metrics.pivot(index="商品", columns="モデル", values="MAPE(%)")
    pivot.index = [_label(p) for p in pivot.index]
    ax = pivot.plot(kind="bar", figsize=(10, 5), rot=0)
    ax.set_title("MAPE (%) by Product and Model")
    ax.set_ylabel("MAPE (%)")
    ax.legend(title="Model")
    ax.grid(axis="y", alpha=0.3)
    plt.tight_layout()
    path = output_dir / "mape_comparison.png"
    plt.savefig(path, dpi=120)
    plt.close()
    print(f"  saved: {path}")


def plot_sales_heatmap(df: pd.DataFrame, output_dir: Path) -> None:
    """商品×曜日の平均販売数ヒートマップを保存"""
    output_dir.mkdir(parents=True, exist_ok=True)
    import numpy as np

    df = df.copy()
    df["dayofweek"] = df["date"].dt.dayofweek
    dow_labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    pivot = df.pivot_table(index="product", columns="dayofweek", values="sales", aggfunc="mean")
    pivot.columns = [dow_labels[c] for c in pivot.columns]

    fig, ax = plt.subplots(figsize=(10, 4))
    im = ax.imshow(pivot.values, aspect="auto", cmap="YlOrRd")
    ax.set_xticks(range(len(pivot.columns)))
    ax.set_xticklabels(pivot.columns)
    ax.set_yticks(range(len(pivot.index)))
    ax.set_yticklabels([_label(p) for p in pivot.index])
    for i in range(pivot.shape[0]):
        for j in range(pivot.shape[1]):
            ax.text(j, i, f"{pivot.values[i, j]:.0f}", ha="center", va="center", fontsize=9)
    plt.colorbar(im, ax=ax, label="Avg Sales")
    ax.set_title("Average Daily Sales by Product and Day of Week")
    plt.tight_layout()
    path = output_dir / "sales_heatmap.png"
    fig.savefig(path, dpi=120)
    plt.close(fig)
    print(f"  saved: {path}")
