from __future__ import annotations

import json
from pathlib import Path

import pandas as pd
import requests


WIKIPEDIA_SP500_URL = "https://en.wikipedia.org/wiki/List_of_S%26P_500_companies"

REPO_ROOT = Path(__file__).resolve().parents[3]
WIKIPEDIA_DIR = REPO_ROOT / "sources" / "extracted" / "wikipedia"


def clean_company_name(name: str) -> str:
    return (
        name.replace(" (The)", "")
        .replace(" (Class A)", " A")
        .replace(" (Class B)", " B")
        .replace(" (Class C)", " C")
        .strip()
    )


def main() -> None:
    response = requests.get(
        WIKIPEDIA_SP500_URL,
        headers={"User-Agent": "Mozilla/5.0"},
        timeout=30,
    )
    response.raise_for_status()
    html = response.text

    tables = pd.read_html(html)
    table = tables[0]

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
