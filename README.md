# S&P 500

Multi-app S&P 500 visualization repo designed for static publishing on GitHub Pages.

## Repo Layout

```text
sp500/
├── market-map/
├── composition/
├── histogram/
├── risk-indicator/
├── index-forecast/
├── sources/
├── datasets/
├── notebooks/
├── pages/
├── scripts/
└── dist/
```

## Apps

- [`market-map/`](/Users/sbc/projects/Plots/sp500/market-map)
  - main S&P 500 market map app
- [`composition/`](/Users/sbc/projects/Plots/sp500/composition)
  - alternate composition views
- [`histogram/`](/Users/sbc/projects/Plots/sp500/histogram)
  - annual returns histogram
- [`risk-indicator/`](/Users/sbc/projects/Plots/sp500/risk-indicator)
  - annual returns risk view
- [`index-forecast/`](/Users/sbc/projects/Plots/sp500/index-forecast)
  - forecast-style annual returns view

## Shared Project Folders

- [`sources/`](/Users/sbc/projects/Plots/sp500/sources)
  - raw, manual, and intermediate source material
- [`datasets/`](/Users/sbc/projects/Plots/sp500/datasets)
  - shared exports and generation logic for the annual returns app family
- [`notebooks/`](/Users/sbc/projects/Plots/sp500/notebooks)
  - notebook work supporting the project
- [`pages/`](/Users/sbc/projects/Plots/sp500/pages)
  - root `/sp500/` index page
- [`scripts/`](/Users/sbc/projects/Plots/sp500/scripts)
  - cross-app orchestration scripts
- [`dist/`](/Users/sbc/projects/Plots/sp500/dist)
  - final unified static output

## GitHub Pages URLs

- [https://sebabecerra.github.io/sp500/](https://sebabecerra.github.io/sp500/)
- [https://sebabecerra.github.io/sp500/market-map/](https://sebabecerra.github.io/sp500/market-map/)
- [https://sebabecerra.github.io/sp500/composition/](https://sebabecerra.github.io/sp500/composition/)
- [https://sebabecerra.github.io/sp500/histogram/](https://sebabecerra.github.io/sp500/histogram/)
- [https://sebabecerra.github.io/sp500/risk-indicator/](https://sebabecerra.github.io/sp500/risk-indicator/)
- [https://sebabecerra.github.io/sp500/index-forecast/](https://sebabecerra.github.io/sp500/index-forecast/)

## Local Workflows

### Unified preview matching GitHub Pages

```bash
npm run preview:pages
```

This builds every app and serves the whole site under:

- `http://127.0.0.1:8031/sp500/`

### Work only on the market-map app

```bash
npm run dev:market-map
```

This forwards to:

```bash
npm -C market-map run dev
```

## Build Logic

- root build orchestration:
  - [`scripts/build-pages.mjs`](/Users/sbc/projects/Plots/sp500/scripts/build-pages.mjs)
- root local static preview:
  - [`scripts/serve-pages.mjs`](/Users/sbc/projects/Plots/sp500/scripts/serve-pages.mjs)
- market-map data generation:
  - [`scripts/build-data.mjs`](/Users/sbc/projects/Plots/sp500/scripts/build-data.mjs)
  - [`scripts/build-sector-returns.mjs`](/Users/sbc/projects/Plots/sp500/scripts/build-sector-returns.mjs)
- annual returns shared dataset generation:
  - [`datasets/scripts/build-annual-returns.mjs`](/Users/sbc/projects/Plots/sp500/datasets/scripts/build-annual-returns.mjs)
