"""需要予測モデル: 商品ごとに学習・予測"""

from __future__ import annotations

import pandas as pd
from sklearn.ensemble import GradientBoostingRegressor, RandomForestRegressor
from sklearn.linear_model import Ridge
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline

from .feature_engineering import FEATURE_COLS, TARGET_COL


MODELS = {
    "Ridge":            Pipeline([("scaler", StandardScaler()), ("model", Ridge(alpha=10))]),
    "RandomForest":     RandomForestRegressor(n_estimators=200, max_depth=8, random_state=42, n_jobs=-1),
    "GradientBoosting": GradientBoostingRegressor(n_estimators=200, max_depth=4, learning_rate=0.05, random_state=42),
}


def _split(df: pd.DataFrame, test_days: int = 90):
    cutoff = df["date"].max() - pd.Timedelta(days=test_days)
    train = df[df["date"] <= cutoff].copy()
    test  = df[df["date"] >  cutoff].copy()
    return train, test


def train_and_predict(
    df_features: pd.DataFrame,
    test_days: int = 90,
    model_name: str = "GradientBoosting",
) -> dict[str, pd.DataFrame]:
    """
    商品ごとに指定モデルを学習し、テスト期間の予測を返す。

    Returns:
        {product: DataFrame(date, actual, predicted)}
    """
    import sklearn.base as base  # noqa: F401

    results: dict[str, pd.DataFrame] = {}
    for product, group in df_features.groupby("product"):
        group = group.sort_values("date").reset_index(drop=True)
        # ラグ特徴量の欠損行を除去
        valid = group.dropna(subset=FEATURE_COLS)
        train, test = _split(valid, test_days)

        if len(train) < 30 or len(test) == 0:
            continue

        X_train = train[FEATURE_COLS]
        y_train = train[TARGET_COL]
        X_test  = test[FEATURE_COLS]
        y_test  = test[TARGET_COL]

        model = base.clone(MODELS[model_name])
        model.fit(X_train, y_train)
        preds = model.predict(X_test).clip(0)

        results[product] = pd.DataFrame({
            "date":      test["date"].values,
            "actual":    y_test.values,
            "predicted": preds.round().astype(int),
        })

    return results


def train_all_models(
    df_features: pd.DataFrame,
    test_days: int = 90,
) -> dict[str, dict[str, pd.DataFrame]]:
    """全モデルで学習・予測"""
    return {name: train_and_predict(df_features, test_days, name) for name in MODELS}
