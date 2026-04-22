# Datasets

This folder is the shared data layer for the S&P 500 project family.

Current scope:
- `annual-returns.json` for:
  - `histogram/`
  - `risk-indicator/`
  - `index-forecast/`

Target structure:
- `sources/`
- `intermediate/`
- `exports/`
- `scripts/`

Rule:
- data generation logic lives here
- app folders consume exported datasets and focus on visualization
