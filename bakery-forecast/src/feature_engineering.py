"""特徴量エンジニアリング"""

import numpy as np
import pandas as pd


def add_calendar_features(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df["dayofweek"] = df["date"].dt.dayofweek          # 0=月 ~ 6=日
    df["month"] = df["date"].dt.month
    df["dayofyear"] = df["date"].dt.dayofyear
    df["week_of_year"] = df["date"].dt.isocalendar().week.astype(int)
    df["is_weekend"] = (df["dayofweek"] >= 5).astype(int)
    df["is_holiday"] = df["is_holiday"].astype(int)
    # 月末フラグ
    df["is_month_end"] = (df["date"].dt.is_month_end).astype(int)
    # 正弦・余弦で年間周期を連続表現
    df["sin_doy"] = np.sin(2 * np.pi * df["dayofyear"] / 365)
    df["cos_doy"] = np.cos(2 * np.pi * df["dayofyear"] / 365)
    df["sin_dow"] = np.sin(2 * np.pi * df["dayofweek"] / 7)
    df["cos_dow"] = np.cos(2 * np.pi * df["dayofweek"] / 7)
    return df


def add_lag_features(df: pd.DataFrame, product: str) -> pd.DataFrame:
    """商品別にラグ・ローリング特徴量を追加 (時系列順に並んでいる前提)"""
    df = df.copy().sort_values("date").reset_index(drop=True)
    s = df["sales"]
    for lag in [1, 7, 14, 28]:
        df[f"lag_{lag}"] = s.shift(lag)
    for window in [7, 14, 28]:
        df[f"roll_mean_{window}"] = s.shift(1).rolling(window).mean()
        df[f"roll_std_{window}"] = s.shift(1).rolling(window).std()
    df["roll_max_7"] = s.shift(1).rolling(7).max()
    df["roll_min_7"] = s.shift(1).rolling(7).min()
    return df


def build_features(df: pd.DataFrame) -> pd.DataFrame:
    """商品ごとに特徴量を付与して結合する"""
    dfs = []
    for product, group in df.groupby("product"):
        g = add_calendar_features(group)
        g = add_lag_features(g, product)
        dfs.append(g)
    result = pd.concat(dfs).sort_values(["date", "product"]).reset_index(drop=True)
    return result


FEATURE_COLS = [
    "dayofweek", "month", "dayofyear", "week_of_year",
    "is_weekend", "is_holiday", "is_month_end",
    "sin_doy", "cos_doy", "sin_dow", "cos_dow",
    "rain_mm", "temperature",
    "lag_1", "lag_7", "lag_14", "lag_28",
    "roll_mean_7", "roll_mean_14", "roll_mean_28",
    "roll_std_7", "roll_std_14", "roll_std_28",
    "roll_max_7", "roll_min_7",
]
TARGET_COL = "sales"
