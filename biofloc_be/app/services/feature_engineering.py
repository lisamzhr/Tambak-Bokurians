import pandas as pd

PARAMS = ["temperature_c", "do_mg_l", "ph", "ammonia_mg_l", "nitrite_mg_l", "nitrate_mg_l", "turbidity_ntu"]

def bucket_15min(df: pd.DataFrame, pond_col: str = "pond_id") -> pd.DataFrame:
    """Agregasi raw readings jadi bucket 15 menit: mean, min, max, std per parameter."""
    if df.empty:
        return df
        
    df = df.copy()
    df["timestamp"] = pd.to_datetime(df["timestamp"])
    df = df.set_index("timestamp")

    agg_map = {p: ["mean", "min", "max", "std"] for p in PARAMS if p in df.columns}

    grouped = (
        df.groupby(pond_col)
        .resample("15min")
        .agg(agg_map)
    )
    grouped.columns = ["_".join(c) for c in grouped.columns]
    grouped = grouped.reset_index()
    return grouped

def daily_rollup(bucket_df: pd.DataFrame, pond_col: str = "pond_id") -> pd.DataFrame:
    """Dari bucket 15 menit -> rata-rata harian + delta terhadap hari sebelumnya."""
    if bucket_df.empty:
        return bucket_df
        
    df = bucket_df.copy()
    df["date"] = df["timestamp"].dt.date

    mean_cols = [c for c in df.columns if c.endswith("_mean")]
    daily = df.groupby([pond_col, "date"])[mean_cols].mean().reset_index()
    daily = daily.sort_values([pond_col, "date"])

    for c in mean_cols:
        daily[f"{c}_delta"] = daily.groupby(pond_col)[c].diff()

    return daily

def add_lag_features(daily_df: pd.DataFrame, pond_col: str = "pond_id", n_lags: int = 3) -> pd.DataFrame:
    """Tambah lag t-1..t-n dan rolling mean 3 hari, dipakai buat forecasting trend."""
    if daily_df.empty:
        return daily_df
        
    df = daily_df.copy()
    mean_cols = [c for c in df.columns if c.endswith("_mean")]

    for c in mean_cols:
        for lag in range(1, n_lags + 1):
            df[f"{c}_lag{lag}"] = df.groupby(pond_col)[c].shift(lag)
        df[f"{c}_roll3"] = df.groupby(pond_col)[c].transform(lambda s: s.rolling(3).mean())

    return df