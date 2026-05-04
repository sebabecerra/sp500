# Market Map Data

This folder contains the real market-map data pipeline from inside the app itself.

Structure:

- `scripts/`
  - `extract-wikipedia.py`: baja la lista actual del S&P 500 desde Wikipedia
  - `build-timeseries-csv.py`: baja precios diarios históricos con yfinance
  - `build-company-weights-csv.py`: calcula market caps y pesos actuales
  - `build-returns-csv.py`: calcula retornos 1D, YTD, 1Y, 5Y y 10Y por empresa
  - `build-market-map-data.py`: construye los JSON finales del market map y del gráfico sectorial
  - `update-sources.py`: corre los pasos de extracción en el orden correcto
  - `lib/data-sources.mjs`: helpers compartidos para descarga y parsing

Recommended order:

1. refresh shared sources
2. build market-map JSON outputs

Commands:

```bash
python3 ./data/scripts/update-sources.py
python3 ./data/scripts/build-market-map-data.py
```
