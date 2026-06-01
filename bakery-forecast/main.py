"""パン屋需要予測 — メインスクリプト"""

from pathlib import Path

from src.data_generator import generate_sales_data
from src.feature_engineering import build_features
from src.model import train_all_models
from src.evaluation import evaluate_results, print_report
from src.visualize import plot_forecast, plot_metrics_comparison, plot_sales_heatmap

OUTPUT_DIR = Path("output")


def main():
    print("1. データ生成中...")
    df = generate_sales_data(start="2023-01-01", end="2024-12-31")
    print(f"   {len(df)} 行, 商品: {df['product'].unique().tolist()}")

    print("2. 特徴量エンジニアリング...")
    df_feat = build_features(df)
    print(f"   特徴量数: {df_feat.shape[1]} 列")

    print("3. 全モデルで学習・予測 (テスト期間: 直近 90 日)...")
    all_results = train_all_models(df_feat, test_days=90)

    print("4. 評価...")
    metrics = evaluate_results(all_results)
    print_report(metrics)

    print("\n5. グラフ保存...")
    best_model = metrics.groupby("モデル")["MAPE(%)"].mean().idxmin()
    print(f"   最良モデル: {best_model}")
    plot_forecast(all_results[best_model], best_model, OUTPUT_DIR)
    plot_metrics_comparison(metrics, OUTPUT_DIR)
    plot_sales_heatmap(df, OUTPUT_DIR)

    metrics.to_csv(OUTPUT_DIR / "metrics.csv", index=False)
    print(f"\n完了。出力先: {OUTPUT_DIR.resolve()}/")


if __name__ == "__main__":
    main()
