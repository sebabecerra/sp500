# S&P 500

Multi-page S&P 500 visualization repo designed for static publishing on GitHub Pages.

This repository is not a single chart. It is a small publishing container for multiple S&P 500 visualizations, each exposed as its own page under the same site, following the same pattern used in the oil projects:

- `/sp500/` -> project index
- `/sp500/market-map/` -> market map
- `/sp500/composition/` -> composition views

The current codebase lives in:

- [`/Users/sbc/projects/Plots/sp500/market-map`](/Users/sbc/projects/Plots/sp500/market-map)

The GitHub repository is:

- [https://github.com/sebabecerra/sp500](https://github.com/sebabecerra/sp500)

The intended GitHub Pages URLs are:

- [https://sebabecerra.github.io/sp500/](https://sebabecerra.github.io/sp500/)
- [https://sebabecerra.github.io/sp500/market-map/](https://sebabecerra.github.io/sp500/market-map/)
- [https://sebabecerra.github.io/sp500/composition/](https://sebabecerra.github.io/sp500/composition/)

## What This Project Is

This project exists to explore multiple editorial representations of the S&P 500 while keeping data lineage and deployment simple.

There are two main goals:

1. build static, shareable S&P 500 visualizations that can live on GitHub Pages
2. keep data construction separate from front-end rendering

That second point is important. The website is static. It does not fetch live market data at runtime. Instead, the data is prepared ahead of time and baked into the build.

## Main Pages

### 1. Market Map

The `market-map` page is a treemap-style composition chart for the S&P 500.

Core characteristics:

- hierarchy: `sector -> industry -> company`
- company area encodes relative participation in the index
- grouping by sector and industry improves navigation inside dense areas
- labels scale with available box size
- hover tooltip shows company, sector, industry, and weight
- tooltip is constrained to remain inside the chart bounds

Main files:

- [`/Users/sbc/projects/Plots/sp500/market-map/src/App.tsx`](/Users/sbc/projects/Plots/sp500/market-map/src/App.tsx)
- [`/Users/sbc/projects/Plots/sp500/market-map/src/components/MarketMapPro.tsx`](/Users/sbc/projects/Plots/sp500/market-map/src/components/MarketMapPro.tsx)
- [`/Users/sbc/projects/Plots/sp500/market-map/src/components/MarketToolbar.tsx`](/Users/sbc/projects/Plots/sp500/market-map/src/components/MarketToolbar.tsx)
- [`/Users/sbc/projects/Plots/sp500/market-map/src/types.ts`](/Users/sbc/projects/Plots/sp500/market-map/src/types.ts)

### 2. Composition

The `composition` page contains alternate visual treatments of the same S&P 500 composition idea.

This area is used for variants such as:

- bubble composition
- treemap composition
- marimekko composition

Main files:

- [`/Users/sbc/projects/Plots/sp500/market-map/composition/src/App.tsx`](/Users/sbc/projects/Plots/sp500/market-map/composition/src/App.tsx)
- [`/Users/sbc/projects/Plots/sp500/market-map/composition/src/components/BubbleChart.tsx`](/Users/sbc/projects/Plots/sp500/market-map/composition/src/components/BubbleChart.tsx)
- [`/Users/sbc/projects/Plots/sp500/market-map/composition/src/components/TreemapChart.tsx`](/Users/sbc/projects/Plots/sp500/market-map/composition/src/components/TreemapChart.tsx)
- [`/Users/sbc/projects/Plots/sp500/market-map/composition/src/components/MarimekkoChart.tsx`](/Users/sbc/projects/Plots/sp500/market-map/composition/src/components/MarimekkoChart.tsx)

## What Makes This Project Different

The interesting part of this repo is not just that it draws an S&P 500 treemap. The more important part is the structure around it:

### 1. Static publishing first

The project is intentionally designed for GitHub Pages.

That means:

- no runtime API required
- no server process in production
- all data is prepared before build
- every page must work from static assets only

This constraint is useful because it forces the repo to be reproducible and easy to share.

### 2. Notebook-driven data pipeline

The source of truth for the market map is a CSV exported from notebook work, not a browser-only scrape and not a live API call at page load.

That gives us:

- explicit provenance
- an inspectable intermediate dataset
- easier validation
- the ability to regenerate JSON without changing front-end code

### 3. One repo, many charts

The repo is meant to behave like a gallery of related S&P 500 graphics, not like a one-off app.

That is why:

- the root page is an index
- each visualization gets its own subpath
- the GitHub Pages build assembles multiple apps into one final `dist/`

### 4. Editorial rather than generic dashboard design

The goal is not a standard finance dashboard. The goal is to produce charts that feel like standalone editorial objects:

- strong color structure
- large headline labels
- single-purpose pages
- controlled interaction rather than overloaded controls

## Data Model and Provenance

The current `market-map` build uses a CSV as its source of truth.

Primary CSV source:

- [`/Users/sbc/projects/Plots/sp500/market-map/data/manual/notebook/sp500_companies_wiki_yfinance.csv`](/Users/sbc/projects/Plots/sp500/market-map/data/manual/notebook/sp500_companies_wiki_yfinance.csv)

This CSV is expected to contain company-level rows with fields such as:

- `ticker`
- `name`
- `sector`
- `industry`
- `marketCap`
- `weight`
- optionally `change`

### Intended data construction

The intended notebook pipeline is:

- Wikipedia -> classification
  - ticker
  - company name
  - sector
  - industry
- Yahoo Finance / yfinance -> financial magnitude
  - market cap
  - optionally daily change
- notebook -> derived values
  - participation / weight

In other words:

- classification comes from Wikipedia
- participation is calculated from market cap
- the website consumes the already-built CSV

### Why use the CSV inside the repo

This is deliberate.

Benefits:

- the site is reproducible
- the front-end build does not depend on external APIs
- the data is versioned with the visualization
- notebook work and web work are clearly separated

## Data Build Pipeline

The front-end does not read the notebook directly. It reads generated JSON.

Current flow:

1. notebook exports `sp500_companies_wiki_yfinance.csv`
2. [`/Users/sbc/projects/Plots/sp500/market-map/scripts/build-data.mjs`](/Users/sbc/projects/Plots/sp500/market-map/scripts/build-data.mjs) reads that CSV
3. the script generates:
   - [`/Users/sbc/projects/Plots/sp500/market-map/public/data/sp500-market-map.json`](/Users/sbc/projects/Plots/sp500/market-map/public/data/sp500-market-map.json)
4. the app fetches that JSON at runtime from static assets

There is also a copied raw CSV for visibility:

- [`/Users/sbc/projects/Plots/sp500/market-map/public/raw/sp500_companies_wiki_yfinance.csv`](/Users/sbc/projects/Plots/sp500/market-map/public/raw/sp500_companies_wiki_yfinance.csv)

## Build Scripts

### Root app scripts

Defined in:

- [`/Users/sbc/projects/Plots/sp500/market-map/package.json`](/Users/sbc/projects/Plots/sp500/market-map/package.json)

Main scripts:

- `npm run build:data`
  - reads the notebook CSV and generates `public/data/sp500-market-map.json`
- `npm run dev`
  - runs the local development server for the market map app
- `npm run build`
  - builds the market map app only
- `npm run build:pages`
  - builds the full multi-page GitHub Pages output

### Multi-page Pages build

The multi-page publishing logic is orchestrated in:

- [`/Users/sbc/projects/Plots/sp500/market-map/scripts/build-pages.mjs`](/Users/sbc/projects/Plots/sp500/market-map/scripts/build-pages.mjs)

What it does:

1. clears `dist/`
2. builds `market-map` into `dist/market-map`
3. builds `composition` into `dist/composition`
4. copies a project index page to `dist/index.html`

The root index page is:

- [`/Users/sbc/projects/Plots/sp500/market-map/pages/index.html`](/Users/sbc/projects/Plots/sp500/market-map/pages/index.html)

## Routing and Base Paths

The Vite base path matters because GitHub Pages project sites are not served from `/`.

Current base paths:

- market map:
  - [`/Users/sbc/projects/Plots/sp500/market-map/vite.config.ts`](/Users/sbc/projects/Plots/sp500/market-map/vite.config.ts)
  - `base: '/sp500/market-map/'`
- composition:
  - [`/Users/sbc/projects/Plots/sp500/market-map/composition/vite.config.ts`](/Users/sbc/projects/Plots/sp500/market-map/composition/vite.config.ts)
  - `base: '/sp500/composition/'`

This structure is what allows one GitHub repo named `sp500` to expose multiple pages cleanly.

## Interaction Design

The current `market-map` interaction model is intentionally focused.

### Search

Users can search by:

- ticker
- company name

### Sector focus

Clicking a sector scopes the map to that sector.

### Hover tooltip

The tooltip shows:

- ticker
- company name
- sector
- industry
- weight
- change when available

Tooltip logic now keeps the hover box inside the chart bounds instead of allowing it to overflow at the right or bottom edges.

That logic lives in:

- [`/Users/sbc/projects/Plots/sp500/market-map/src/components/MarketMapPro.tsx`](/Users/sbc/projects/Plots/sp500/market-map/src/components/MarketMapPro.tsx)

### Labels

Labels are not fixed-size buckets only. They are scaled based on available rectangle area so larger boxes breathe more naturally and small boxes do not get oversized text.

## Repository Structure

Top-level structure inside the repo:

- [`/Users/sbc/projects/Plots/sp500/market-map/.github`](/Users/sbc/projects/Plots/sp500/market-map/.github)
- [`/Users/sbc/projects/Plots/sp500/market-map/composition`](/Users/sbc/projects/Plots/sp500/market-map/composition)
- [`/Users/sbc/projects/Plots/sp500/market-map/data`](/Users/sbc/projects/Plots/sp500/market-map/data)
- [`/Users/sbc/projects/Plots/sp500/market-map/pages`](/Users/sbc/projects/Plots/sp500/market-map/pages)
- [`/Users/sbc/projects/Plots/sp500/market-map/public`](/Users/sbc/projects/Plots/sp500/market-map/public)
- [`/Users/sbc/projects/Plots/sp500/market-map/scripts`](/Users/sbc/projects/Plots/sp500/market-map/scripts)
- [`/Users/sbc/projects/Plots/sp500/market-map/src`](/Users/sbc/projects/Plots/sp500/market-map/src)

## Local Development

### Run market map only

```bash
npm install
npm run build:data
npm run dev
```

Expected local route:

- `http://127.0.0.1:5181/sp500/market-map/`

### Build market map only

```bash
npm run build
```

### Build full GitHub Pages output

```bash
npm run build:pages
```

That produces:

- `dist/index.html`
- `dist/market-map/index.html`
- `dist/composition/index.html`

## GitHub Pages Deployment

Workflow file:

- [`/Users/sbc/projects/Plots/sp500/market-map/.github/workflows/deploy.yml`](/Users/sbc/projects/Plots/sp500/market-map/.github/workflows/deploy.yml)

The workflow:

1. installs root dependencies
2. installs `composition` dependencies
3. runs `npm run build:pages`
4. uploads the generated `dist/`
5. deploys to GitHub Pages

### Important current status

The code and workflow are in place, but GitHub Pages must be enabled in the repository settings.

At the time of writing:

- the GitHub Actions build succeeds through the actual app build
- the workflow fails at `Setup Pages`
- the public repo API reports `has_pages: false`

That means the repository still needs:

1. `Settings -> Pages`
2. `Source -> GitHub Actions`

Once that is enabled, the Pages deploy should be able to publish successfully.

## Why This Repo Matters

This repo is useful because it turns a messy exploratory process into a reproducible publishing workflow:

- notebook for extraction and construction
- CSV as stable intermediate artifact
- Node build for transformation
- static front-end for rendering
- GitHub Pages for distribution

That is a good pattern for data projects where:

- the visual layer changes often
- data provenance matters
- hosting should stay simple

## Current Notes

- `market-map` is the main production-oriented page right now
- `composition` is the experimental/editorial branch of the same theme
- Pages is wired but still depends on enabling GitHub Pages in the repository settings

## Next Good Improvements

Good next steps for this repo:

- add a richer project-level README section for the notebook workflow itself
- document the CSV schema explicitly
- move shared utilities into a clearer shared module if more pages are added
- add screenshots or thumbnails for each project page
- add a changelog section if the repo keeps evolving quickly

