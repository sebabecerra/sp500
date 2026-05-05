from __future__ import annotations

import json
import time
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd
import yfinance as yf


ROOT = Path(__file__).resolve().parent.parent
WIKI_JSON = ROOT / "sources/extracted/wikipedia/constituents.json"
OUT_DIR = ROOT / "sources/manual/notebook"
CONSTITUENTS_OUT = OUT_DIR / "sp500_current_constituents.csv"
WIDE_OUT = OUT_DIR / "sp500_timeseries_15y_wide.csv"
LONG_OUT = OUT_DIR / "sp500_timeseries_15y_long.csv"
META_OUT = OUT_DIR / "sp500_timeseries_15y_meta.json"


def normalize_ticker(symbol: str) -> str:
    return symbol.strip().replace(".", "-")


def chunked(items: list[str], size: int) -> list[list[str]]:
    return [items[i : i + size] for i in range(0, len(items), size)]


def extract_close_wide(history: pd.DataFrame, tickers: list[str]) -> tuple[pd.DataFrame, list[str]]:
    missing: list[str] = []

    if isinstance(history.columns, pd.MultiIndex):
        available_tickers = set(history.columns.get_level_values(0))
        series_by_ticker: dict[str, pd.Series] = {}
        for ticker in tickers:
            if ticker in available_tickers and "Close" in history[ticker]:
                series = history[ticker]["Close"].dropna()
                if series.empty:
                    missing.append(ticker)
                    continue
                series_by_ticker[ticker] = series
            else:
                missing.append(ticker)
        close_wide = pd.DataFrame(series_by_ticker)
    else:
        ticker = tickers[0]
        if "Close" not in history:
            missing.append(ticker)
            close_wide = pd.DataFrame()
        else:
            close_wide = history[["Close"]].rename(columns={"Close": ticker}).dropna()

    if not close_wide.empty:
        close_wide.index = pd.to_datetime(close_wide.index).tz_localize(None)
        close_wide = close_wide.sort_index()
        close_wide.index.name = "date"

    return close_wide, missing


def download_close_wide_in_batches(tickers: list[str]) -> tuple[pd.DataFrame, list[str]]:
    frames: list[pd.DataFrame] = []
    missing_all: list[str] = []

    for batch in chunked(tickers, 25):
        batch_frame = pd.DataFrame()
        batch_missing = batch[:]

        for attempt in range(3):
            history = yf.download(
                tickers=batch,
                period="15y",
                interval="1d",
                auto_adjust=True,
                group_by="ticker",
                threads=False,
                progress=False,
            )
            batch_frame, batch_missing = extract_close_wide(history, batch)
            if not batch_frame.empty:
                break
            time.sleep(2 * (attempt + 1))

        if not batch_frame.empty:
            frames.append(batch_frame)
        missing_all.extend(batch_missing)
        time.sleep(0.5)

    if not frames:
        return pd.DataFrame(), sorted(set(missing_all))

    close_wide = pd.concat(frames, axis=1).sort_index()
    close_wide = close_wide.loc[:, ~close_wide.columns.duplicated()]
    return close_wide, sorted(set(missing_all))


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    wiki_rows = json.loads(WIKI_JSON.read_text())
    constituents = [
        {
            "ticker": normalize_ticker(str(row.get("ticker", ""))),
            "name": row.get("name", ""),
            "sector": row.get("sector", ""),
            "industry": row.get("industry", ""),
        }
        for row in wiki_rows
        if row.get("ticker")
    ]

    constituents_df = pd.DataFrame(constituents)
    constituents_df.to_csv(CONSTITUENTS_OUT, index=False)

    tickers = constituents_df["ticker"].dropna().astype(str).str.strip().drop_duplicates().tolist()
    previous_wide = None
    if WIDE_OUT.exists():
        previous_wide = pd.read_csv(WIDE_OUT, index_col=0, parse_dates=True)
        previous_wide.index = pd.to_datetime(previous_wide.index).tz_localize(None)
        previous_wide.index.name = "date"

    close_wide, missing = download_close_wide_in_batches(tickers)
    used_previous_fallback = False
    if close_wide.empty:
        if previous_wide is None or previous_wide.empty:
            raise RuntimeError("Yahoo download returned no close-price history and no previous wide file is available.")
        close_wide = previous_wide.copy()
        used_previous_fallback = True
    elif previous_wide is not None and not previous_wide.empty:
        missing_columns = [ticker for ticker in tickers if ticker not in close_wide.columns and ticker in previous_wide.columns]
        if missing_columns:
            close_wide = pd.concat([close_wide, previous_wide[missing_columns]], axis=1).sort_index()
            close_wide = close_wide.loc[:, ~close_wide.columns.duplicated()]

    close_long = (
        close_wide.reset_index()
        .melt(id_vars="date", var_name="ticker", value_name="close")
        .dropna(subset=["close"])
        .sort_values(["date", "ticker"])
    )

    close_wide.to_csv(WIDE_OUT)
    close_long.to_csv(LONG_OUT, index=False)

    meta = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "source": "Current S&P 500 constituents from Wikipedia",
        "sourceUrl": "https://en.wikipedia.org/wiki/List_of_S%26P_500_companies",
        "tickersRequested": len(tickers),
        "tickersReturned": len(close_wide.columns),
        "missingTickers": missing,
        "dateStart": str(close_wide.index.min().date()),
        "dateEnd": str(close_wide.index.max().date()),
        "rowsWide": int(close_wide.shape[0]),
        "columnsWide": int(close_wide.shape[1]),
        "rowsLong": int(close_long.shape[0]),
        "usedPreviousFallback": used_previous_fallback,
    }
    META_OUT.write_text(json.dumps(meta, indent=2))

    print(f"Wrote {WIDE_OUT}")
    print(f"Wrote {LONG_OUT}")
    print(f"Wrote {META_OUT}")
    print(f"Date range: {meta['dateStart']} -> {meta['dateEnd']}")
    print(f"Missing tickers: {len(missing)}")


if __name__ == "__main__":
    main()
