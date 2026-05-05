from __future__ import annotations

import csv
import json
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import yfinance as yf


ROOT = Path(__file__).resolve().parent.parent
WIKI_JSON = ROOT / "sources/extracted/wikipedia/constituents.json"
YAHOO_QUOTES_JSON = ROOT / "sources/extracted/yahoo/quotes.json"
OUTPUT_CSV = ROOT / "sources/manual/notebook/sp500_companies_wiki_yfinance.csv"
FALLBACK_WEIGHT_CSVS = [
    OUTPUT_CSV,
    ROOT / "market-map/public/raw/sp500_market_map_returns.csv",
]


def parse_market_cap(row: dict[str, object]) -> float | None:
    candidates = [
        row.get("marketCap"),
        row.get("regularMarketMarketCap"),
    ]
    for value in candidates:
        if isinstance(value, (int, float)) and value > 0:
            return float(value)
    return None


def company_name(wiki_row: dict[str, str], quote_row: dict[str, object] | None) -> str:
    if quote_row:
        for field in ("displayName", "shortName", "longName"):
            value = quote_row.get(field)
            if isinstance(value, str) and value.strip():
                return value.strip()
    return (wiki_row.get("name") or "").strip()


def fetch_market_cap_fallback(ticker: str) -> float | None:
    try:
        fast_info = yf.Ticker(ticker).fast_info
        value = fast_info.get("market_cap") or fast_info.get("marketCap")
        if isinstance(value, (int, float)) and value > 0:
            return float(value)
    except Exception:
        pass

    try:
        info = yf.Ticker(ticker).info
        value = info.get("marketCap")
        if isinstance(value, (int, float)) and value > 0:
            return float(value)
    except Exception:
        pass

    return None


def main() -> None:
    wiki_rows = json.loads(WIKI_JSON.read_text())
    previous_rows: list[dict[str, str]] = []
    for candidate in FALLBACK_WEIGHT_CSVS:
        if not candidate.exists():
            continue
        with candidate.open() as f:
            rows = list(csv.DictReader(f))
        if len(rows) > len(previous_rows):
            previous_rows = rows
    previous_by_ticker = {
        str(row.get("ticker", "")).strip().upper(): row
        for row in previous_rows
        if row.get("ticker")
    }

    if YAHOO_QUOTES_JSON.exists():
        try:
            quote_rows = json.loads(YAHOO_QUOTES_JSON.read_text())
        except json.JSONDecodeError:
            quote_rows = []
    else:
        quote_rows = []

    quotes_by_symbol = {
        str(row.get("symbol", "")).strip().upper(): row
        for row in quote_rows
        if row.get("symbol")
    }

    combined_rows: list[dict[str, object]] = []
    pending_market_caps: dict[str, dict[str, object]] = {}
    for wiki_row in wiki_rows:
        ticker = str(wiki_row.get("ticker", "")).strip().upper()
        if not ticker:
            continue
        quote_row = quotes_by_symbol.get(ticker)
        market_cap = parse_market_cap(quote_row or {})
        row = {
            "ticker": ticker,
            "name": company_name(wiki_row, quote_row),
            "sector": wiki_row.get("sector", ""),
            "industry": wiki_row.get("industry", ""),
            "marketCap": market_cap,
        }
        if market_cap is None:
            pending_market_caps[ticker] = row
        else:
            combined_rows.append(row)

    if pending_market_caps:
        with ThreadPoolExecutor(max_workers=8) as executor:
            future_map = {
                executor.submit(fetch_market_cap_fallback, ticker): ticker
                for ticker in pending_market_caps
            }
            for future in as_completed(future_map):
                ticker = future_map[future]
                market_cap = future.result()
                if market_cap is None:
                    continue
                row = pending_market_caps[ticker]
                row["marketCap"] = market_cap
                combined_rows.append(row)

    completed_rows: list[dict[str, object]] = []
    fallback_rows: list[dict[str, object]] = []
    for row in combined_rows:
        if row["marketCap"] is None:
            ticker = str(row["ticker"])
            previous = previous_by_ticker.get(ticker)
            previous_weight = None
            if previous:
                try:
                    previous_weight = float(previous.get("weight", ""))
                except (TypeError, ValueError):
                    previous_weight = None
            if previous_weight is not None and previous_weight > 0:
                row["weight"] = previous_weight
                fallback_rows.append(row)
            continue
        completed_rows.append(row)

    missing_tickers = {
        str(row["ticker"])
        for row in pending_market_caps.values()
        if not any(str(done["ticker"]) == str(row["ticker"]) for done in completed_rows)
    }
    for ticker in sorted(missing_tickers):
        row = pending_market_caps[ticker]
        previous = previous_by_ticker.get(ticker)
        previous_weight = None
        if previous:
            try:
                previous_weight = float(previous.get("weight", ""))
            except (TypeError, ValueError):
                previous_weight = None
        if previous_weight is not None and previous_weight > 0:
            row["weight"] = previous_weight
            fallback_rows.append(row)

    total_market_cap = sum(float(row["marketCap"]) for row in completed_rows)
    if total_market_cap > 0:
        for row in completed_rows:
            row["weight"] = float(row["marketCap"]) / total_market_cap * 100

    combined_rows = completed_rows + fallback_rows
    if not combined_rows:
        raise RuntimeError("Could not compute weights from current market caps or previous fallback weights.")

    total_weight = sum(float(row["weight"]) for row in combined_rows if row.get("weight") is not None)
    if total_weight <= 0:
        raise RuntimeError("Could not compute a positive total portfolio weight.")
    for row in combined_rows:
        row["weight"] = float(row["weight"]) / total_weight * 100

    combined_rows.sort(key=lambda row: float(row["weight"]), reverse=True)
    OUTPUT_CSV.parent.mkdir(parents=True, exist_ok=True)

    with OUTPUT_CSV.open("w", newline="") as f:
        writer = csv.DictWriter(
            f,
            fieldnames=["ticker", "name", "sector", "industry", "marketCap", "weight", "change"],
        )
        writer.writeheader()
        for row in combined_rows:
            writer.writerow(
                {
                    "ticker": row["ticker"],
                    "name": row["name"],
                    "sector": row["sector"],
                    "industry": row["industry"],
                    "marketCap": f"{float(row['marketCap']):.0f}",
                    "weight": f"{float(row['weight']):.6f}",
                    "change": "",
                }
            )

    print(f"Wrote {len(combined_rows)} rows to {OUTPUT_CSV}")
    print(f"Rows with live market cap: {len(completed_rows)}")
    print(f"Rows using previous-weight fallback: {len(fallback_rows)}")


if __name__ == "__main__":
    main()
