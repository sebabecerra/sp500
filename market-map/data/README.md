# Market Map Data

This folder contains the real market-map data pipeline from inside the app itself.

Structure:

- `scripts/`
  - `00-update-sources.py`: corre los pasos de extracción en el orden correcto
  - `01-extract-wikipedia.py`: baja la lista actual del S&P 500 desde Wikipedia
  - `02-build-timeseries-csv.py`: baja precios diarios históricos con yfinance
  - `03-build-company-weights-csv.py`: calcula market caps y pesos actuales
  - `04-build-returns-csv.py`: calcula retornos 1D, YTD, 1Y, 5Y y 10Y por empresa
  - `05-build-market-map-data.py`: construye los JSON finales del market map y del gráfico sectorial
  - `06-update-and-publish.py`: actualiza datos, valida el build, hace commit de `market-map` y empuja `main`
  - `lib/data-sources.mjs`: helpers compartidos para descarga y parsing

Recommended order:

1. run `00-update-sources.py` to refresh local data and build the final JSON outputs

Commands:

```bash
python3 ./data/scripts/00-update-sources.py
```

Optional:

```bash
python3 ./data/scripts/05-build-market-map-data.py
python3 ./data/scripts/06-update-and-publish.py
```
