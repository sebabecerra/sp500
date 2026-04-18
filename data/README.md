# Data Layout

This project keeps data sources separated by provenance.

- `manual/`
  - Human-curated or notebook-exported sources used as the build input.
- `extracted/`
  - Machine-extracted snapshots from public sources.

Current source of truth for the app:

1. Build a single company-level CSV in a notebook
2. Save it into `data/manual/notebook/sp500_companies_wiki_yfinance.csv`
3. Run `npm run build:data`
4. The app then reads only the generated JSON in `public/data/`

The `extracted/` folder remains available for provenance and experiments, but the shipping app dataset is built from the notebook CSV.
