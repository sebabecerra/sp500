# Notebook CSV Source

Put the notebook-exported company table here as:

- `sp500_companies_wiki_yfinance.csv`

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

The build script uses `weight` directly when present. If `weight` is missing, it recalculates company participation from `marketCap`.
