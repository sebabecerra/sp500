# Notebook CSV Source

Put the notebook-exported company table here as:

- `sp500_companies_wiki_yfinance.csv`
- `sp500_market_map_returns.csv`

Expected columns:

- `ticker`
- `name`
- `sector`
- `industry`
- `marketCap`
- `weight`

Optional columns:

- `display_name`
- `quote_name`
- `change`
- `return_1d`
- `return_ytd`
- `return_1y`
- `return_5y`
- `return_10y`

The build script uses `weight` directly when present. If `weight` is missing, it recalculates company participation from `marketCap`.

For return-based market maps, prefer `sp500_market_map_returns.csv`. That file is meant to be the dedicated source for performance horizons like `1D`, `YTD`, `1Y`, `5Y`, and `10Y`.
