# S&P 500 Market Map

This project is now self-contained for data updates.

## Structure

- `data/scripts/`
  - ordered pipeline
- `data/extracted/`
  - raw downloaded snapshots
- `data/manual/notebook/`
  - local intermediate CSV outputs
- `public/data/`
  - final JSON consumed by the app
- `src/`
  - React app

## Main Commands

### 1. Update everything

This runs the full data pipeline in order:

```bash
python3 ./data/scripts/00-update-sources.py
```

It does:

1. `01-extract-wikipedia.py`
2. `02-build-timeseries-csv.py`
3. `03-build-company-weights-csv.py`
4. `04-build-returns-csv.py`
5. `05-build-market-map-data.py`

### 2. Run the app locally

```bash
npm run dev
```

### 3. Build the app

```bash
npm run build
```

### 4. Rebuild only the final JSON files

```bash
npm run build:data
```

## Publish to GitHub Pages

This command:

1. updates the data
2. builds the app
3. stages `market-map`
4. commits `market-map`
5. pushes `main`

```bash
npm run publish:pages
```

Equivalent direct command:

```bash
python3 ./data/scripts/06-update-and-publish.py
```

## Important Outputs

- `public/data/sp500-market-map.json`
- `public/data/sp500-sector-returns.json`

## Notebook

Simple pipeline notebook:

- `notebooks/market_map_pipeline_simple.ipynb`

Older full notebook with charts:

- `../notebooks/sp500_market_map_replica.ipynb`
