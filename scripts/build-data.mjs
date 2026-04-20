import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { csvParse } from 'd3-dsv'
import { cleanCompanyName, formatTrillions, isFinitePositive, sectorConfig } from './lib/data-sources.mjs'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const root = resolve(scriptDir, '..')
const outputDir = resolve(root, 'public/data')
const rawOutputDir = resolve(root, 'public/raw')

const csvCandidates = [
  resolve(root, 'data/manual/notebook/sp500_market_map_returns.csv'),
  resolve(root, 'data/manual/sp500_market_map_returns.csv'),
  resolve(root, 'data/manual/notebook/sp500_companies_wiki_yfinance.csv'),
  resolve(root, 'data/manual/sp500_companies_wiki_yfinance.csv'),
]

async function readFirstExisting(paths) {
  for (const path of paths) {
    try {
      return { path, contents: await readFile(path, 'utf8') }
    } catch {
      // Try next path.
    }
  }

  throw new Error(
    `Could not find source CSV. Expected one of:\n${paths.map((path) => `- ${path}`).join('\n')}`,
  )
}

function slugify(value) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
}

function parseNumber(value) {
  if (typeof value !== 'string') return Number.NaN
  const normalized = value.trim().replace(/[$,%]/g, '').replace(/,/g, '')
  if (!normalized) return Number.NaN
  return Number(normalized)
}

function pickName(row) {
  return cleanCompanyName(row.display_name || row.quote_name || row.name || row.company || row.Security || '')
}

const { path: csvPath, contents: csvContents } = await readFirstExisting(csvCandidates)
const rows = csvParse(csvContents)

const companies = rows
  .map((row) => {
    const ticker = (row.ticker || row.symbol || '').trim()
    const name = pickName(row)
    const sector = (row.sector || '').trim()
    const industry = (row.industry || row.subindustry || row['sub-industry'] || '').trim()
    const weightValue = parseNumber(row.weight)
    const marketCap = parseNumber(row.marketCap)
    const changeValue = parseNumber(row.change)
    const return1dValue = parseNumber(row.return_1d ?? row.return1d)
    const returnYtdValue = parseNumber(row.return_ytd ?? row.returnYtd)
    const return1yValue = parseNumber(row.return_1y ?? row.return1y)
    const return5yValue = parseNumber(row.return_5y ?? row.return5y)
    const return10yValue = parseNumber(row.return_10y ?? row.return10y)

    if (!ticker || !name || !sector) return null

    return {
      ticker,
      name,
      sector,
      industry: industry || 'Unclassified',
      marketCap: isFinitePositive(marketCap) ? marketCap : null,
      weight: Number.isFinite(weightValue) && weightValue > 0 ? weightValue : null,
      change: Number.isFinite(changeValue) ? changeValue : undefined,
      return1d: Number.isFinite(return1dValue)
        ? return1dValue
        : Number.isFinite(changeValue)
          ? changeValue
          : undefined,
      returnYtd: Number.isFinite(returnYtdValue) ? returnYtdValue : undefined,
      return1y: Number.isFinite(return1yValue) ? return1yValue : undefined,
      return5y: Number.isFinite(return5yValue) ? return5yValue : undefined,
      return10y: Number.isFinite(return10yValue) ? return10yValue : undefined,
    }
  })
  .filter(Boolean)

if (!companies.length) {
  throw new Error(`No valid company rows found in ${csvPath}`)
}

const totalMarketCap = companies.reduce((sum, company) => sum + (company.marketCap ?? 0), 0)
const hasExplicitWeights = companies.every((company) => company.weight !== null)

if (!hasExplicitWeights && !isFinitePositive(totalMarketCap)) {
  throw new Error(
    'Source CSV does not contain usable weight values, and marketCap is missing or invalid for recalculation.',
  )
}

const grouped = new Map()

for (const company of companies) {
  const config = sectorConfig[company.sector]
  const key = config?.key || slugify(company.sector)
  const name = {
    en: company.sector,
    es: config?.es || company.sector,
  }
  const color = config?.color || '#64748b'
  const weight = company.weight ?? (company.marketCap / totalMarketCap) * 100

  if (!grouped.has(company.sector)) {
    grouped.set(company.sector, {
      key,
      name,
      color,
      companies: [],
    })
  }

      grouped.get(company.sector).companies.push({
        name: company.name,
        label: company.ticker,
        ticker: company.ticker,
        industry: company.industry,
        change: company.change,
        return1d: company.return1d,
        returnYtd: company.returnYtd,
        return1y: company.return1y,
        return5y: company.return5y,
        return10y: company.return10y,
        weight: Number(weight.toFixed(4)),
      })
}

const sectors = [...grouped.values()]
  .map((sector) => {
    const top = sector.companies.sort((a, b) => b.weight - a.weight)
    const sectorWeight = top.reduce((sum, company) => sum + company.weight, 0)

    return {
      key: sector.key,
      name: sector.name,
      weight: Number(sectorWeight.toFixed(4)),
      companies: top.length,
      color: sector.color,
      top,
    }
  })
  .sort((a, b) => b.weight - a.weight)

const payload = {
  generatedAt: new Date().toISOString(),
  title: { en: 'S&P 500 Market Map', es: 'Mapa del S&P 500' },
  subtitle: {
    en: 'Static market map built from a notebook-generated CSV with Wikipedia classification and Yahoo Finance market capitalization.',
    es: 'Mapa de mercado estático construido desde un CSV generado en notebook con clasificación de Wikipedia y capitalización de mercado de Yahoo Finance.',
  },
  note: {
    en: 'This app reads a single CSV exported from the notebook pipeline. If the CSV includes company weights they are used directly; otherwise weights are recalculated from market capitalization.',
    es: 'Esta app lee un solo CSV exportado desde el notebook. Si el CSV ya incluye pesos por compañía, se usan directo; si no, los pesos se recalculan desde la capitalización de mercado.',
  },
  source: {
    name: `Notebook CSV: ${csvPath.split('/').pop()}`,
    url: `./raw/${csvPath.split('/').pop()}`,
  },
  totalMarketCap: isFinitePositive(totalMarketCap) ? formatTrillions(totalMarketCap) : 'N/A',
  availableModes: [
    'weight',
    companies.some((company) => company.return1d !== undefined) ? '1d' : null,
    companies.some((company) => company.returnYtd !== undefined) ? 'ytd' : null,
    companies.some((company) => company.return1y !== undefined) ? '1y' : null,
    companies.some((company) => company.return5y !== undefined) ? '5y' : null,
    companies.some((company) => company.return10y !== undefined) ? '10y' : null,
  ].filter(Boolean),
  sectors,
}

await mkdir(outputDir, { recursive: true })
await mkdir(rawOutputDir, { recursive: true })
await copyFile(csvPath, resolve(rawOutputDir, csvPath.split('/').pop()))
await writeFile(resolve(outputDir, 'sp500-market-map.json'), JSON.stringify(payload, null, 2), 'utf8')

console.log(
  `Saved public/data/sp500-market-map.json with ${payload.sectors.length} sectors and ${payload.sectors.reduce((sum, sector) => sum + sector.companies, 0)} companies from ${csvPath}`,
)
