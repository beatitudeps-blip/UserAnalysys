"""パン屋の日次販売データ生成 (合成データ)"""

import numpy as np
import pandas as pd


# 日本の主要な祝日・特需日 (月, 日) のタプル
JAPANESE_HOLIDAYS = {
    (1, 1), (1, 2), (1, 3),   # 正月
    (2, 14),                   # バレンタインデー
    (3, 14),                   # ホワイトデー
    (4, 29), (4, 30),
    (5, 1), (5, 2), (5, 3), (5, 4), (5, 5),  # GW
    (7, 7),                    # 七夕
    (8, 11), (8, 12), (8, 13), (8, 14), (8, 15),  # お盆
    (9, 15),                   # 敬老の日 (概算)
    (10, 31),                  # ハロウィン
    (11, 3),                   # 文化の日
    (12, 23), (12, 24), (12, 25),  # クリスマス
    (12, 29), (12, 30), (12, 31),  # 年末
}

# 商品カテゴリと基準日販売数
PRODUCTS = {
    "食パン":     {"base": 120, "price": 300},
    "クロワッサン": {"base": 80,  "price": 200},
    "バゲット":   {"base": 50,  "price": 350},
    "メロンパン":  {"base": 100, "price": 180},
    "あんぱん":   {"base": 90,  "price": 160},
}


def _is_holiday(date: pd.Timestamp) -> bool:
    return (date.month, date.day) in JAPANESE_HOLIDAYS


def _day_of_week_factor(dow: int) -> float:
    """日曜=0, 土曜=5 の週内パターン (土日がピーク)"""
    factors = [1.25, 0.85, 0.88, 0.90, 0.95, 1.10, 1.30]
    return factors[dow]


def _month_factor(month: int) -> float:
    """月別季節性"""
    factors = [1.15, 1.05, 1.10, 1.05, 1.00, 0.90, 0.85, 0.85, 0.95, 1.00, 1.05, 1.25]
    return factors[month - 1]


def _weather_factor(rain: float) -> float:
    """降水量に応じた需要低下 (mm/日)"""
    if rain <= 0:
        return 1.0
    elif rain <= 5:
        return 0.95
    elif rain <= 20:
        return 0.88
    else:
        return 0.80


def generate_sales_data(
    start: str = "2023-01-01",
    end: str = "2024-12-31",
    seed: int = 42,
) -> pd.DataFrame:
    """
    パン屋の日次販売データを生成する。

    Returns:
        date, product, sales, price, is_holiday, is_weekend,
        rain_mm, temperature の列を持つ DataFrame
    """
    rng = np.random.default_rng(seed)
    dates = pd.date_range(start, end, freq="D")
    n = len(dates)

    # 気象データ (合成)
    rain = rng.exponential(scale=3, size=n)
    rain[rng.random(n) > 0.3] = 0  # 70% は晴れ
    temp_base = 15 + 12 * np.sin(2 * np.pi * (np.arange(n) - 30) / 365)
    temperature = temp_base + rng.normal(0, 3, n)

    rows = []
    for i, date in enumerate(dates):
        dow_f = _day_of_week_factor(date.dayofweek)
        mon_f = _month_factor(date.month)
        weather_f = _weather_factor(rain[i])
        holiday_f = 1.35 if _is_holiday(date) else 1.0

        for name, info in PRODUCTS.items():
            base = info["base"]
            # 商品ごとの週末感度が異なる
            product_dow_f = dow_f if name != "バゲット" else (dow_f * 0.85 + 0.15)
            mu = base * product_dow_f * mon_f * weather_f * holiday_f
            # ポアソンノイズ (整数販売数)
            sales = int(rng.poisson(max(mu, 1)))
            rows.append({
                "date": date,
                "product": name,
                "sales": sales,
                "price": info["price"],
                "revenue": sales * info["price"],
                "is_holiday": _is_holiday(date),
                "is_weekend": date.dayofweek >= 5,
                "rain_mm": round(rain[i], 1),
                "temperature": round(temperature[i], 1),
            })

    df = pd.DataFrame(rows)
    df["date"] = pd.to_datetime(df["date"])
    return df


if __name__ == "__main__":
    df = generate_sales_data()
    print(df.head(10).to_string())
    print(f"\n合計 {len(df)} 行, 期間: {df['date'].min().date()} ~ {df['date'].max().date()}")
