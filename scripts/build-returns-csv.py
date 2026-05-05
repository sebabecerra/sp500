from __future__ import annotations

import csv
import json
import re
import unicodedata
from datetime import datetime
from pathlib import Path

import pandas as pd
import yfinance as yf


ROOT = Path(__file__).resolve().parent.parent
WEIGHTS_CSV = ROOT / "sources/manual/notebook/sp500_companies_wiki_yfinance.csv"
WIKI_JSON = ROOT / "sources/extracted/wikipedia/constituents.json"
TIMESERIES_WIDE_CSV = ROOT / "sources/manual/notebook/sp500_timeseries_15y_wide.csv"
OUTPUT_CSV = ROOT / "sources/manual/notebook/sp500_market_map_returns.csv"

NAME_OVERRIDES = {
    "marsh and mclennan": "MRSH",
    "kkr": "KKR",
    "coinbase global": "COIN",
    "oreilly auto parts": "ORLY",
    "o reilly auto parts": "ORLY",
    "hologic": "HOLX",
    "norfolk southern railway": "NSC",
    "campbell soup": "CPB",
    "pinnacle west": "PNW",
    "berkshire hathaway": "BRK-B",
    "carvana": "CVNA",
}


def normalize_name(value: str) -> str:
    value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    value = value.lower().strip()
    value = value.replace("&", " and ")
    value = re.sub(
        r"\b(incorporated|inc|corp|corporation|company|companies|co|plc|ltd|group|holdings|holding|class a|class b|class c|the)\b",
        " ",
        value,
    )
    value = re.sub(r"[^a-z0-9]+", " ", value)
    value = re.sub(r"\s+", " ", value).strip()
    return value


def pct_return(current: float | None, previous: float | None) -> float | None:
    if current is None or previous is None:
        return None
    if pd.isna(current) or pd.isna(previous) or previous == 0:
        return None
    return (float(current) / float(previous) - 1.0) * 100.0


def last_valid_before(series: pd.Series, cutoff: pd.Timestamp) -> float | None:
    filtered = series.loc[series.index <= cutoff].dropna()
    if filtered.empty:
        return None
    return float(filtered.iloc[-1])


def compute_returns(series: pd.Series, now: pd.Timestamp) -> dict[str, float | None]:
    clean = series.dropna()
    if clean.empty:
        return {
            "return_1d": None,
            "return_ytd": None,
            "return_1y": None,
            "return_5y": None,
            "return_10y": None,
        }

    current = float(clean.iloc[-1])
    previous_day = float(clean.iloc[-2]) if len(clean) >= 2 else None
    start_of_year_cutoff = pd.Timestamp(year=now.year, month=1, day=1, tz=now.tz)
    one_year_cutoff = now - pd.DateOffset(years=1)
    five_year_cutoff = now - pd.DateOffset(years=5)
    ten_year_cutoff = now - pd.DateOffset(years=10)

    return {
        "return_1d": pct_return(current, previous_day),
        "return_ytd": pct_return(current, last_valid_before(clean, start_of_year_cutoff)),
        "return_1y": pct_return(current, last_valid_before(clean, one_year_cutoff)),
        "return_5y": pct_return(current, last_valid_before(clean, five_year_cutoff)),
        "return_10y": pct_return(current, last_valid_before(clean, ten_year_cutoff)),
    }


def resolve_wiki_row(row: dict[str, str], wiki_by_ticker: dict[str, dict[str, str]], wiki_by_name: dict[str, dict[str, str]]) -> dict[str, str]:
    raw_ticker = (row.get("ticker") or "").strip().upper()
    raw_name = (row.get("name") or "").strip()
    normalized_name = normalize_name(raw_name)

    if raw_ticker in wiki_by_ticker:
        return wiki_by_ticker[raw_ticker]

    override_ticker = NAME_OVERRIDES.get(normalized_name)
    if override_ticker:
        if override_ticker in wiki_by_ticker:
            return wiki_by_ticker[override_ticker]
        return {
            "ticker": override_ticker,
            "name": raw_name,
            "sector": row.get("sector", ""),
            "industry": row.get("industry", ""),
        }

    if normalized_name in wiki_by_name:
        return wiki_by_name[normalized_name]

    return {
        "ticker": raw_ticker or row.get("ticker") or raw_name,
        "name": raw_name,
        "sector": row.get("sector", ""),
        "industry": row.get("industry", ""),
    }


def fetch_histories(tickers: list[str]) -> dict[str, pd.Series]:
    frame = yf.download(
        tickers=tickers,
        period="10y",
        interval="1d",
        auto_adjust=True,
        group_by="ticker",
        threads=True,
        progress=False,
    )

    histories: dict[str, pd.Series] = {}
    if isinstance(frame.columns, pd.MultiIndex):
        available_tickers = set(frame.columns.get_level_values(0))
        for ticker in tickers:
            if ticker in available_tickers:
                series = frame[ticker]["Close"].dropna()
            else:
                series = pd.Series(dtype="float64")
            histories[ticker] = series
    else:
        # Single ticker download fallback.
        ticker = tickers[0]
        histories[ticker] = frame["Close"].dropna() if "Close" in frame else pd.Series(dtype="float64")

    return histories


def load_local_histories(tickers: list[str]) -> dict[str, pd.Series]:
    if not TIMESERIES_WIDE_CSV.exists():
        return {}

    frame = pd.read_csv(TIMESERIES_WIDE_CSV, index_col=0, parse_dates=True)
    histories: dict[str, pd.Series] = {}
    for ticker in tickers:
        if ticker in frame.columns:
            histories[ticker] = frame[ticker].dropna()
    return histories


def fetch_missing_history(ticker: str) -> pd.Series:
    try:
        history = yf.Ticker(ticker).history(period="10y", interval="1d", auto_adjust=True)
        if "Close" in history:
            return history["Close"].dropna()
    except Exception:
        pass
    return pd.Series(dtype="float64")


def main() -> None:
    weight_rows = list(csv.DictReader(WEIGHTS_CSV.open()))
    wiki_rows = json.loads(WIKI_JSON.read_text())

    wiki_by_ticker = {row["ticker"].upper(): row for row in wiki_rows if row.get("ticker")}
    wiki_by_name = {normalize_name(row["name"]): row for row in wiki_rows if row.get("name")}

    resolved_rows = []
    for row in weight_rows:
        wiki_row = resolve_wiki_row(row, wiki_by_ticker, wiki_by_name)
        resolved_rows.append(
            {
                "ticker": wiki_row["ticker"].upper(),
                "name": row["name"],
                "sector": wiki_row.get("sector") or row["sector"],
                "industry": wiki_row.get("industry") or row["industry"],
                "weight": row["weight"],
            }
        )

    tickers = sorted({row["ticker"] for row in resolved_rows if row["ticker"]})
    histories = load_local_histories(tickers)
    missing_for_download = [ticker for ticker in tickers if ticker not in histories]
    if missing_for_download:
        histories.update(fetch_histories(missing_for_download))

    missing_tickers = [ticker for ticker, series in histories.items() if series.empty]
    for ticker in missing_tickers:
        histories[ticker] = fetch_missing_history(ticker)

    now = pd.Timestamp(datetime.utcnow())
    output_rows = []

    for row in resolved_rows:
        ticker = row["ticker"]
        series = histories.get(ticker, pd.Series(dtype="float64"))
        returns = compute_returns(series, now)

        output_rows.append(
            {
                "ticker": ticker,
                "name": row["name"],
                "sector": row["sector"],
                "industry": row["industry"],
                "weight": row["weight"],
                "return_1d": "" if returns["return_1d"] is None else f"{returns['return_1d']:.4f}",
                "return_ytd": "" if returns["return_ytd"] is None else f"{returns['return_ytd']:.4f}",
                "return_1y": "" if returns["return_1y"] is None else f"{returns['return_1y']:.4f}",
                "return_5y": "" if returns["return_5y"] is None else f"{returns['return_5y']:.4f}",
                "return_10y": "" if returns["return_10y"] is None else f"{returns['return_10y']:.4f}",
            }
        )

    with OUTPUT_CSV.open("w", newline="") as f:
        writer = csv.DictWriter(
            f,
            fieldnames=[
                "ticker",
                "name",
                "sector",
                "industry",
                "weight",
                "return_1d",
                "return_ytd",
                "return_1y",
                "return_5y",
                "return_10y",
            ],
        )
        writer.writeheader()
        writer.writerows(output_rows)

    populated = {
        key: sum(1 for row in output_rows if row[key] != "")
        for key in ["return_1d", "return_ytd", "return_1y", "return_5y", "return_10y"]
    }
    print(f"Wrote {len(output_rows)} rows to {OUTPUT_CSV}")
    print("Populated counts:", populated)


if __name__ == "__main__":
    main()
