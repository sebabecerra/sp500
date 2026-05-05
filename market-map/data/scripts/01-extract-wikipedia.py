from __future__ import annotations

import json
from pathlib import Path

import pandas as pd
import requests


WIKIPEDIA_SP500_URL = "https://en.wikipedia.org/wiki/List_of_S%26P_500_companies"

MARKET_MAP_ROOT = Path(__file__).resolve().parents[2]
DATA_ROOT = MARKET_MAP_ROOT / "data"
WIKIPEDIA_DIR = DATA_ROOT / "extracted" / "wikipedia"


def clean_company_name(name: str) -> str:
    return (
        name.replace(" (The)", "")
        .replace(" (Class A)", " A")
        .replace(" (Class B)", " B")
        .replace(" (Class C)", " C")
        .strip()
    )


def pick_constituents_table(html: str) -> pd.DataFrame:
    tables = pd.read_html(html)
    required_columns = {"Symbol", "Security", "GICS Sector", "GICS Sub-Industry"}

    for table in tables:
        columns = {str(column).strip() for column in table.columns}
        if required_columns.issubset(columns):
            return table

    raise RuntimeError("Could not find the Wikipedia S&P 500 constituents table with the expected columns.")


def main() -> None:
    response = requests.get(
        WIKIPEDIA_SP500_URL,
        headers={"User-Agent": "Mozilla/5.0"},
        timeout=30,
    )
    response.raise_for_status()
    html = response.text

    table = pick_constituents_table(html)

    rows = []
    for _, row in table.iterrows():
        rows.append(
            {
                "ticker": str(row["Symbol"]).replace(".", "-").strip(),
                "name": clean_company_name(str(row["Security"]).strip()),
                "sector": str(row["GICS Sector"]).strip(),
                "industry": str(row["GICS Sub-Industry"]).strip(),
            }
        )

    WIKIPEDIA_DIR.mkdir(parents=True, exist_ok=True)
    (WIKIPEDIA_DIR / "constituents.html").write_text(html, encoding="utf-8")
    (WIKIPEDIA_DIR / "constituents.json").write_text(json.dumps(rows, indent=2), encoding="utf-8")

    print(f"Saved Wikipedia constituents snapshot with {len(rows)} rows to {WIKIPEDIA_DIR}")


if __name__ == "__main__":
    main()
