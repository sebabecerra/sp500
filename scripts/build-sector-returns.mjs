import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { csvParse } from 'd3-dsv'
import { sectorConfig } from './lib/data-sources.mjs'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const root = resolve(scriptDir, '..')
const marketMapDir = resolve(root, 'market-map')
const outputDir = resolve(marketMapDir, 'public/data')

const weightsCandidates = [
  resolve(root, 'sources/manual/notebook/sp500_market_map_returns.csv'),
  resolve(root, 'sources/manual/sp500_market_map_returns.csv'),
  resolve(root, 'sources/manual/notebook/sp500_market_map_replica.csv'),
  resolve(root, 'sources/manual/sp500_market_map_replica.csv'),
]

const wideCandidates = [
  resolve(root, 'sources/manual/notebook/sp500_timeseries_15y_wide.csv'),
  resolve(root, 'sources/manual/sp500_timeseries_15y_wide.csv'),
]

async function readFirstExisting(paths) {
  for (const path of paths) {
    try {
      return { path, contents: await readFile(path, 'utf8') }
    } catch {
      // try next
    }
  }

  throw new Error(`Could not find source file. Expected one of:\n${paths.join('\n')}`)
}

function parseNumber(value) {
  if (typeof value !== 'string') return Number.NaN
  const normalized = value.trim().replace(/[$,%]/g, '').replace(/,/g, '')
  return normalized ? Number(normalized) : Number.NaN
}

const { path: weightsPath, contents: weightsContents } = await readFirstExisting(weightsCandidates)
const { path: widePath, contents: wideContents } = await readFirstExisting(wideCandidates)

const metadataRows = csvParse(weightsContents)
const priceRows = csvParse(wideContents)

const companyMeta = metadataRows
  .map((row) => {
    const ticker = (row.ticker || row.symbol || '').trim()
    const sector = (row.sector || '').trim()
    const weight = parseNumber(row.weight)

    if (!ticker || !sector || !Number.isFinite(weight) || weight <= 0) return null

    const config = sectorConfig[sector]

    return {
      ticker,
      sector,
      sectorKey: config?.key || sector.toLowerCase().replace(/[^\w]+/g, '-'),
      sectorName: {
        en: sector,
        es: config?.es || sector,
      },
      color: config?.color || '#64748b',
      weight,
    }
  })
  .filter(Boolean)

const sectorMap = new Map()
for (const row of companyMeta) {
  if (!sectorMap.has(row.sectorKey)) {
    sectorMap.set(row.sectorKey, {
      key: row.sectorKey,
      name: row.sectorName,
      color: row.color,
      totalWeight: 0,
      members: [],
    })
  }

  const sector = sectorMap.get(row.sectorKey)
  sector.totalWeight += row.weight
  sector.members.push({ ticker: row.ticker, weight: row.weight })
}

const sectors = [...sectorMap.values()].sort((a, b) => b.totalWeight - a.totalWeight)

const seriesState = new Map(
  sectors.map((sector) => [
    sector.key,
    {
      level: null,
      points: [],
    },
  ]),
)

for (let i = 1; i < priceRows.length; i += 1) {
  const prev = priceRows[i - 1]
  const current = priceRows[i]

  for (const sector of sectors) {
    let weightedReturn = 0
    let availableWeight = 0

    for (const member of sector.members) {
      const prevPrice = parseNumber(prev[member.ticker])
      const currentPrice = parseNumber(current[member.ticker])

      if (!Number.isFinite(prevPrice) || !Number.isFinite(currentPrice) || prevPrice <= 0) {
        continue
      }

      const dailyReturn = currentPrice / prevPrice - 1
      weightedReturn += member.weight * dailyReturn
      availableWeight += member.weight
    }

    if (availableWeight <= 0) continue

    const normalizedReturn = weightedReturn / availableWeight
    const state = seriesState.get(sector.key)

    if (state.level === null) {
      state.level = 100
    } else {
      state.level *= 1 + normalizedReturn
    }

    state.points.push({
      date: current.date,
      value: Number(state.level.toFixed(4)),
      coverage: Number((availableWeight / sector.totalWeight).toFixed(4)),
    })
  }
}

const payload = {
  generatedAt: new Date().toISOString(),
  source: {
    weights: weightsPath.split('/').pop(),
    prices: widePath.split('/').pop(),
  },
  note: 'Sector series are chained from weighted daily constituent returns using current company weights normalized within each sector among available members.',
  sectors: sectors.map((sector) => ({
    key: sector.key,
    name: sector.name,
    color: sector.color,
    weight: Number(sector.totalWeight.toFixed(4)),
    companies: sector.members.length,
    series: seriesState.get(sector.key).points,
  })),
}

const totalByDate = new Map()

for (const sector of payload.sectors) {
  for (const point of sector.series) {
    const current = totalByDate.get(point.date) ?? { weighted: 0, weight: 0, coverage: 0 }
    current.weighted += point.value * sector.weight
    current.weight += sector.weight
    current.coverage += point.coverage * sector.weight
    totalByDate.set(point.date, current)
  }
}

const totalSeries = [...totalByDate.entries()]
  .map(([date, value]) => ({
    date,
    value: Number((value.weighted / value.weight).toFixed(4)),
    coverage: Number((value.coverage / value.weight).toFixed(4)),
  }))
  .sort((a, b) => a.date.localeCompare(b.date))

payload.sectors.unshift({
  key: 'total',
  name: { en: 'Total', es: 'Total' },
  color: '#f3c557',
  weight: 100,
  companies: companyMeta.length,
  series: totalSeries,
})

await mkdir(outputDir, { recursive: true })
await writeFile(resolve(outputDir, 'sp500-sector-returns.json'), JSON.stringify(payload, null, 2), 'utf8')

console.log(
  `Saved market-map/public/data/sp500-sector-returns.json with ${payload.sectors.length} sectors from ${weightsPath} and ${widePath}`,
)
