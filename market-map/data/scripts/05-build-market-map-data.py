from __future__ import annotations

import csv
import json
import math
import shutil
import unicodedata
from pathlib import Path


MARKET_MAP_ROOT = Path(__file__).resolve().parents[2]
DATA_ROOT = MARKET_MAP_ROOT / "data"
OUTPUT_DIR = MARKET_MAP_ROOT / "public" / "data"
RAW_OUTPUT_DIR = MARKET_MAP_ROOT / "public" / "raw"

CSV_CANDIDATES = [
    DATA_ROOT / "manual/notebook/sp500_market_map_returns.csv",
    DATA_ROOT / "manual/sp500_market_map_returns.csv",
    DATA_ROOT / "manual/notebook/sp500_companies_wiki_yfinance.csv",
    DATA_ROOT / "manual/sp500_companies_wiki_yfinance.csv",
]

WEIGHTS_CANDIDATES = [
    DATA_ROOT / "manual/notebook/sp500_market_map_returns.csv",
    DATA_ROOT / "manual/sp500_market_map_returns.csv",
    DATA_ROOT / "manual/notebook/sp500_market_map_replica.csv",
    DATA_ROOT / "manual/sp500_market_map_replica.csv",
]

WIDE_CANDIDATES = [
    DATA_ROOT / "manual/notebook/sp500_timeseries_15y_wide.csv",
    DATA_ROOT / "manual/sp500_timeseries_15y_wide.csv",
]

SECTOR_CONFIG = {
    "Information Technology": {"key": "information-technology", "es": "Tecnologia", "color": "#78b9ff"},
    "Financials": {"key": "financials", "es": "Financieras", "color": "#22c55e"},
    "Communication Services": {"key": "communication-services", "es": "Servicios de comunicación", "color": "#b793ff"},
    "Consumer Discretionary": {"key": "consumer-discretionary", "es": "Consumo discrecional", "color": "#8395ff"},
    "Health Care": {"key": "health-care", "es": "Salud", "color": "#e7e3ff"},
    "Industrials": {"key": "industrials", "es": "Industriales", "color": "#ff9cbc"},
    "Consumer Staples": {"key": "consumer-staples", "es": "Consumo básico", "color": "#ff985f"},
    "Energy": {"key": "energy", "es": "Energía", "color": "#f4c84d"},
    "Utilities": {"key": "utilities", "es": "Utilities", "color": "#d8df53"},
    "Materials": {"key": "materials", "es": "Materiales", "color": "#ff6767"},
    "Real Estate": {"key": "real-estate", "es": "Real Estate", "color": "#b7ece0"},
}


def read_first_existing(paths: list[Path]) -> Path:
    for path in paths:
        if path.exists():
            return path
    expected = "\n".join(str(path) for path in paths)
    raise FileNotFoundError(f"Could not find source file. Expected one of:\n{expected}")


def load_csv_rows(path: Path) -> list[dict[str, str]]:
    with path.open(newline="", encoding="utf-8") as handle:
        return list(csv.DictReader(handle))


def parse_number(value: str | None) -> float | None:
    if value is None:
        return None
    normalized = value.strip().replace("$", "").replace("%", "").replace(",", "")
    if not normalized:
        return None
    try:
        parsed = float(normalized)
    except ValueError:
        return None
    if math.isnan(parsed) or math.isinf(parsed):
        return None
    return parsed


def is_finite_positive(value: float | None) -> bool:
    return value is not None and math.isfinite(value) and value > 0


def format_trillions(value: float) -> str:
    return f"${value / 1e12:.2f}T"


def clean_company_name(name: str) -> str:
    return (
        name.replace(" (The)", "")
        .replace(" (Class A)", " A")
        .replace(" (Class B)", " B")
        .replace(" (Class C)", " C")
        .strip()
    )


def slugify(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value)
    ascii_value = normalized.encode("ascii", "ignore").decode("ascii").lower()
    cleaned = "".join(char if char.isalnum() or char in " -" else "" for char in ascii_value).strip()
    return "-".join(part for part in cleaned.split() if part)


def round_number(value: float, digits: int = 4) -> float:
    return round(value, digits)


def pick_name(row: dict[str, str]) -> str:
    for key in ("display_name", "quote_name", "name", "company", "Security"):
        value = row.get(key, "")
        if value and value.strip():
            return clean_company_name(value)
    return ""


def build_market_map_json() -> None:
    csv_path = read_first_existing(CSV_CANDIDATES)
    rows = load_csv_rows(csv_path)

    companies: list[dict[str, object]] = []
    for row in rows:
        ticker = (row.get("ticker") or row.get("symbol") or "").strip()
        name = pick_name(row)
        sector = (row.get("sector") or "").strip()
        industry = (
            row.get("industry")
            or row.get("subindustry")
            or row.get("sub-industry")
            or ""
        ).strip()
        weight_value = parse_number(row.get("weight"))
        market_cap = parse_number(row.get("marketCap"))
        change_value = parse_number(row.get("change"))
        return_1d_value = parse_number(row.get("return_1d") or row.get("return1d"))
        return_ytd_value = parse_number(row.get("return_ytd") or row.get("returnYtd"))
        return_1y_value = parse_number(row.get("return_1y") or row.get("return1y"))
        return_5y_value = parse_number(row.get("return_5y") or row.get("return5y"))
        return_10y_value = parse_number(row.get("return_10y") or row.get("return10y"))

        if not ticker or not name or not sector:
            continue

        companies.append(
            {
                "ticker": ticker,
                "name": name,
                "sector": sector,
                "industry": industry or "Unclassified",
                "marketCap": market_cap if is_finite_positive(market_cap) else None,
                "weight": weight_value if weight_value is not None and weight_value > 0 else None,
                "change": change_value,
                "return1d": return_1d_value if return_1d_value is not None else change_value,
                "returnYtd": return_ytd_value,
                "return1y": return_1y_value,
                "return5y": return_5y_value,
                "return10y": return_10y_value,
            }
        )

    if not companies:
        raise RuntimeError(f"No valid company rows found in {csv_path}")

    total_market_cap = sum(company["marketCap"] or 0 for company in companies)
    has_explicit_weights = all(company["weight"] is not None for company in companies)

    if not has_explicit_weights and not is_finite_positive(total_market_cap):
        raise RuntimeError(
            "Source CSV does not contain usable weight values, and marketCap is missing or invalid for recalculation."
        )

    grouped: dict[str, dict[str, object]] = {}
    for company in companies:
        sector = company["sector"]
        config = SECTOR_CONFIG.get(sector, {})
        sector_key = config.get("key") or slugify(str(sector))
        sector_name = {"en": sector, "es": config.get("es") or sector}
        color = config.get("color") or "#64748b"
        weight = company["weight"]
        if weight is None:
            market_cap = company["marketCap"]
            assert market_cap is not None
            weight = market_cap / total_market_cap * 100

        if sector not in grouped:
            grouped[sector] = {
                "key": sector_key,
                "name": sector_name,
                "color": color,
                "companies": [],
            }

        grouped[sector]["companies"].append(
            {
                "name": company["name"],
                "label": company["ticker"],
                "ticker": company["ticker"],
                "industry": company["industry"],
                "change": company["change"],
                "return1d": company["return1d"],
                "returnYtd": company["returnYtd"],
                "return1y": company["return1y"],
                "return5y": company["return5y"],
                "return10y": company["return10y"],
                "weight": round_number(float(weight)),
            }
        )

    sectors = []
    for sector in grouped.values():
        top = sorted(sector["companies"], key=lambda company: company["weight"], reverse=True)
        sector_weight = sum(company["weight"] for company in top)
        sectors.append(
            {
                "key": sector["key"],
                "name": sector["name"],
                "weight": round_number(sector_weight),
                "companies": len(top),
                "color": sector["color"],
                "top": top,
            }
        )
    sectors.sort(key=lambda sector: sector["weight"], reverse=True)

    payload = {
        "generatedAt": __import__("datetime").datetime.utcnow().isoformat() + "Z",
        "title": {"en": "S&P 500 Market Map", "es": "Mapa del S&P 500"},
        "subtitle": {
            "en": "Static market map built from a notebook-generated CSV with Wikipedia classification and Yahoo Finance market capitalization.",
            "es": "Mapa de mercado estático construido desde un CSV generado en notebook con clasificación de Wikipedia y capitalización de mercado de Yahoo Finance.",
        },
        "note": {
            "en": "This app reads a single CSV exported from the notebook pipeline. If the CSV includes company weights they are used directly; otherwise weights are recalculated from market capitalization.",
            "es": "Esta app lee un solo CSV exportado desde el notebook. Si el CSV ya incluye pesos por compañía, se usan directo; si no, los pesos se recalculan desde la capitalización de mercado.",
        },
        "source": {"name": f"Notebook CSV: {csv_path.name}", "url": f"./raw/{csv_path.name}"},
        "totalMarketCap": format_trillions(total_market_cap) if is_finite_positive(total_market_cap) else "N/A",
        "availableModes": [
            mode
            for mode, enabled in [
                ("weight", True),
                ("1d", any(company["return1d"] is not None for company in companies)),
                ("ytd", any(company["returnYtd"] is not None for company in companies)),
                ("1y", any(company["return1y"] is not None for company in companies)),
                ("5y", any(company["return5y"] is not None for company in companies)),
                ("10y", any(company["return10y"] is not None for company in companies)),
            ]
            if enabled
        ],
        "sectors": sectors,
    }

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    RAW_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(csv_path, RAW_OUTPUT_DIR / csv_path.name)
    (OUTPUT_DIR / "sp500-market-map.json").write_text(json.dumps(payload, indent=2), encoding="utf-8")

    total_companies = sum(sector["companies"] for sector in sectors)
    print(
        f"Saved market-map/public/data/sp500-market-map.json with {len(sectors)} sectors and {total_companies} companies from {csv_path}"
    )


def load_price_rows(path: Path) -> list[dict[str, str]]:
    with path.open(newline="", encoding="utf-8") as handle:
        return list(csv.DictReader(handle))


def build_sector_returns_json() -> None:
    weights_path = read_first_existing(WEIGHTS_CANDIDATES)
    wide_path = read_first_existing(WIDE_CANDIDATES)

    metadata_rows = load_csv_rows(weights_path)
    price_rows = load_price_rows(wide_path)

    company_meta = []
    for row in metadata_rows:
        ticker = (row.get("ticker") or row.get("symbol") or "").strip()
        sector = (row.get("sector") or "").strip()
        weight = parse_number(row.get("weight"))
        if not ticker or not sector or weight is None or weight <= 0:
            continue

        config = SECTOR_CONFIG.get(sector, {})
        company_meta.append(
            {
                "ticker": ticker,
                "sector": sector,
                "sectorKey": config.get("key") or slugify(sector),
                "sectorName": {"en": sector, "es": config.get("es") or sector},
                "color": config.get("color") or "#64748b",
                "weight": weight,
            }
        )

    sector_map: dict[str, dict[str, object]] = {}
    for row in company_meta:
        sector_key = row["sectorKey"]
        if sector_key not in sector_map:
            sector_map[sector_key] = {
                "key": sector_key,
                "name": row["sectorName"],
                "color": row["color"],
                "totalWeight": 0.0,
                "members": [],
            }
        sector_map[sector_key]["totalWeight"] += row["weight"]
        sector_map[sector_key]["members"].append({"ticker": row["ticker"], "weight": row["weight"]})

    sectors = sorted(sector_map.values(), key=lambda sector: sector["totalWeight"], reverse=True)
    series_state = {sector["key"]: {"level": None, "points": []} for sector in sectors}

    for i in range(1, len(price_rows)):
        prev_row = price_rows[i - 1]
        current_row = price_rows[i]

        for sector in sectors:
            weighted_return = 0.0
            available_weight = 0.0

            for member in sector["members"]:
                prev_price = parse_number(prev_row.get(member["ticker"]))
                current_price = parse_number(current_row.get(member["ticker"]))
                if prev_price is None or current_price is None or prev_price <= 0:
                    continue

                daily_return = current_price / prev_price - 1
                weighted_return += member["weight"] * daily_return
                available_weight += member["weight"]

            if available_weight <= 0:
                continue

            normalized_return = weighted_return / available_weight
            state = series_state[sector["key"]]

            if state["level"] is None:
                state["level"] = 100.0
            else:
                state["level"] *= 1 + normalized_return

            state["points"].append(
                {
                    "date": current_row["date"],
                    "value": round_number(state["level"]),
                    "coverage": round_number(available_weight / sector["totalWeight"]),
                }
            )

    payload = {
        "generatedAt": __import__("datetime").datetime.utcnow().isoformat() + "Z",
        "source": {"weights": weights_path.name, "prices": wide_path.name},
        "note": "Sector series are chained from weighted daily constituent returns using current company weights normalized within each sector among available members.",
        "sectors": [
            {
                "key": sector["key"],
                "name": sector["name"],
                "color": sector["color"],
                "weight": round_number(sector["totalWeight"]),
                "companies": len(sector["members"]),
                "series": series_state[sector["key"]]["points"],
            }
            for sector in sectors
        ],
    }

    total_by_date: dict[str, dict[str, float]] = {}
    for sector in payload["sectors"]:
        for point in sector["series"]:
            current = total_by_date.setdefault(point["date"], {"weighted": 0.0, "weight": 0.0, "coverage": 0.0})
            current["weighted"] += point["value"] * sector["weight"]
            current["weight"] += sector["weight"]
            current["coverage"] += point["coverage"] * sector["weight"]

    total_series = [
        {
            "date": date,
            "value": round_number(values["weighted"] / values["weight"]),
            "coverage": round_number(values["coverage"] / values["weight"]),
        }
        for date, values in sorted(total_by_date.items())
    ]

    payload["sectors"].insert(
        0,
        {
            "key": "total",
            "name": {"en": "Total", "es": "Total"},
            "color": "#f3c557",
            "weight": 100,
            "companies": len(company_meta),
            "series": total_series,
        },
    )

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    (OUTPUT_DIR / "sp500-sector-returns.json").write_text(json.dumps(payload, indent=2), encoding="utf-8")

    print(
        f"Saved market-map/public/data/sp500-sector-returns.json with {len(payload['sectors'])} sectors from {weights_path} and {wide_path}"
    )


def main() -> None:
    build_market_map_json()
    build_sector_returns_json()


if __name__ == "__main__":
    main()
