# sp500

Multi-page S&P 500 repo.

- `/sp500/` project index
- `/sp500/market-map/` market map
- `/sp500/composition/` composition views

## Scripts

- `npm run build:data`: reads `data/manual/notebook/sp500_companies_wiki_yfinance.csv` and generates `public/data/sp500-market-map.json`
- `npm run build:pages`: builds the GitHub Pages output for all S&P 500 apps
- `npm run dev`: local development server
- `npm run build`: production build
