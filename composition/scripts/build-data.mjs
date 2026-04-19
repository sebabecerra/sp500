import { execFileSync } from 'node:child_process'
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { csvParse } from 'd3-dsv'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const root = resolve(scriptDir, '..')
const outputDir = resolve(root, 'public/data')
const rawDir = resolve(root, 'data/raw')
const visualCapitalistHtmlPath = resolve(rawDir, 'visualcapitalist-sp500-2026.html')
const visualCapitalistFragmentPrefix = 'visualcapitalist-sp500-2026-'

const WEIGHTS_URL = 'https://us500.com/tools/data/sp500-companies-by-weight'
const CONSTITUENTS_URL = 'https://raw.githubusercontent.com/datasets/s-and-p-500-companies/main/data/constituents.csv'

const sectorConfig = {
  'Information Technology': { key: 'information-technology', es: 'Tecnologia', color: '#78b9ff', x: 278, y: 760, r: 190 },
  Financials: { key: 'financials', es: 'Financieras', color: '#22c55e', x: 856, y: 430, r: 150 },
  'Communication Services': { key: 'communication-services', es: 'Servicios de comunicación', color: '#b793ff', x: 690, y: 165, r: 142 },
  'Consumer Discretionary': { key: 'consumer-discretionary', es: 'Consumo discrecional', color: '#8395ff', x: 362, y: 155, r: 150 },
  'Health Care': { key: 'health-care', es: 'Salud', color: '#e7e3ff', x: 720, y: 730, r: 126 },
  Industrials: { key: 'industrials', es: 'Industriales', color: '#ff9cbc', x: 165, y: 433, r: 145 },
  'Consumer Staples': { key: 'consumer-staples', es: 'Consumo básico', color: '#ff985f', x: 958, y: 163, r: 100 },
  Energy: { key: 'energy', es: 'Energía', color: '#f4c84d', x: 957, y: 826, r: 92 },
  Utilities: { key: 'utilities', es: 'Utilities', color: '#d8df53', x: 544, y: 932, r: 74 },
  Materials: { key: 'materials', es: 'Materiales', color: '#ff6767', x: 86, y: 173, r: 78 },
  'Real Estate': { key: 'real-estate', es: 'Real Estate', color: '#b7ece0', x: 896, y: 676, r: 74 },
}

function downloadText(url) {
  return execFileSync('curl', ['-L', url], { encoding: 'utf8' })
}

function extractWeightsFromHtml(html) {
  const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/)
  if (!match) throw new Error('Could not find __NEXT_DATA__ payload in us500 page')
  const json = JSON.parse(match[1])
  return json.props.pageProps.data
}

function cleanCompanyName(name) {
  return name
    .replace(/\s+\(The\)$/i, '')
    .replace(/\s+\(Class A\)$/i, ' A')
    .replace(/\s+\(Class B\)$/i, ' B')
    .replace(/\s+\(Class C\)$/i, ' C')
    .replace(/\s+Corporation$/i, '')
    .trim()
}

function decodeHtml(value) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&#8211;|&ndash;/g, '–')
    .replace(/&#8217;|&rsquo;/g, '’')
    .replace(/&#8220;|&#8221;|&quot;/g, '"')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeVcSector(sector) {
  const map = {
    'Info Tech': 'Information Technology',
    'Health Care': 'Health Care',
    'Communication Services': 'Communication Services',
    'Consumer Discretionary': 'Consumer Discretionary',
    'Consumer Staples': 'Consumer Staples',
    Financials: 'Financials',
    Industrials: 'Industrials',
    Materials: 'Materials',
    Energy: 'Energy',
    Utilities: 'Utilities',
    'Real Estate': 'Real Estate',
  }
  return map[sector] ?? sector
}

function parseVisualCapitalistRows(html) {
  const rowRegex = /<tr class="row-[^"]+">([\s\S]*?)<\/tr>/g
  const colRegex = /<td class="column-(\d)[^"]*">([\s\S]*?)<\/td>/g
  const rows = []

  for (const rowMatch of html.matchAll(rowRegex)) {
    const cells = {}
    for (const colMatch of rowMatch[1].matchAll(colRegex)) {
      cells[colMatch[1]] = decodeHtml(colMatch[2])
    }
    if (cells['2'] && cells['3'] && cells['4']) {
      rows.push({
        name: cleanCompanyName(cells['2']),
        sector: normalizeVcSector(cells['3']),
        weight: Number.parseFloat(cells['4'].replace('%', '')),
      })
    }
  }

  return rows
}

function buildFallbackPayload() {
  const constituentsCsv = downloadText(CONSTITUENTS_URL)
  const weightsHtml = downloadText(WEIGHTS_URL)

  const constituents = csvParse(constituentsCsv)
  const weightRows = extractWeightsFromHtml(weightsHtml)

  const constituentMap = new Map(
    constituents.map((row) => [
      row.Symbol,
      {
        security: row.Security,
        sector: row['GICS Sector'],
      },
    ]),
  )

  const grouped = new Map()

  for (const item of weightRows) {
    const meta = constituentMap.get(item.ticker)
    if (!meta || !sectorConfig[meta.sector]) continue

    if (!grouped.has(meta.sector)) grouped.set(meta.sector, [])
    grouped.get(meta.sector).push({
      name: cleanCompanyName(meta.security || item.name),
      label: item.ticker,
      weight: Number.parseFloat(item.weight),
    })
  }

  const orderedSectors = Object.keys(sectorConfig)
    .map((sectorName) => {
      const config = sectorConfig[sectorName]
      const companies = (grouped.get(sectorName) ?? []).sort((a, b) => b.weight - a.weight)
      const sectorWeight = companies.reduce((sum, company) => sum + company.weight, 0)

      return {
        key: config.key,
        name: { en: sectorName, es: config.es },
        weight: Number(sectorWeight.toFixed(1)),
        companies: companies.length,
        color: config.color,
        x: config.x,
        y: config.y,
        r: config.r,
        top: companies,
      }
    })
    .filter((sector) => sector.companies > 0)

  return {
    generatedAt: new Date().toISOString(),
    title: { en: 'The Entire S&P 500', es: 'Todo el S&P 500' },
    subtitle: {
      en: 'Packed-bubbles style reconstruction of sector weights and company concentration using live S&P 500 constituent weights.',
      es: 'Reconstrucción tipo packed bubbles de los pesos sectoriales y la concentración de compañías usando pesos reales del S&P 500.',
    },
    note: {
      en: 'Company weights come from us500.com and sector classification comes from the open datasets/s-and-p-500-companies constituent list. Poster layout is still a reconstruction.',
      es: 'Los pesos por compañía vienen de us500.com y la clasificación sectorial viene del listado abierto datasets/s-and-p-500-companies. La composición del póster sigue siendo una reconstrucción.',
    },
    source: {
      name: 'us500.com + datasets/s-and-p-500-companies',
      url: 'https://us500.com/tools/data/sp500-companies-by-weight',
    },
    totalMarketCap: '$57.62T',
    sectors: orderedSectors,
  }
}

async function buildPayload() {
  try {
    const entries = await readdir(rawDir)
    const htmlParts = []

    if (entries.includes('visualcapitalist-sp500-2026.html')) {
      htmlParts.push(await readFile(visualCapitalistHtmlPath, 'utf8'))
    }

    const fragmentNames = entries
      .filter((entry) => entry.startsWith(visualCapitalistFragmentPrefix) && entry.endsWith('.html'))
      .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))

    if (fragmentNames.length > 0) {
      const fragments = await Promise.all(fragmentNames.map((name) => readFile(resolve(rawDir, name), 'utf8')))
      htmlParts.push(...fragments)
    }

    if (htmlParts.length === 0) {
      throw new Error('No Visual Capitalist HTML source found')
    }

    const html = htmlParts.join('\n')

    const vcRows = parseVisualCapitalistRows(html)

    if (vcRows.length > 0) {
      const grouped = new Map()
      for (const item of vcRows) {
        if (!sectorConfig[item.sector]) continue
        if (!grouped.has(item.sector)) grouped.set(item.sector, [])
        grouped.get(item.sector).push({
          name: item.name,
          label: item.name,
          weight: item.weight,
        })
      }

      const orderedSectors = Object.keys(sectorConfig)
        .map((sectorName) => {
          const config = sectorConfig[sectorName]
          const companies = (grouped.get(sectorName) ?? []).sort((a, b) => b.weight - a.weight)
          const sectorWeight = companies.reduce((sum, company) => sum + company.weight, 0)

          return {
            key: config.key,
            name: { en: sectorName, es: config.es },
            weight: Number(sectorWeight.toFixed(1)),
            companies: companies.length,
            color: config.color,
            x: config.x,
            y: config.y,
            r: config.r,
            top: companies,
          }
        })
        .filter((sector) => sector.companies > 0)

      return {
        generatedAt: new Date().toISOString(),
        title: { en: 'The Entire S&P 500', es: 'Todo el S&P 500' },
        subtitle: {
          en: 'Packed-bubbles style reconstruction of the Visual Capitalist S&P 500 poster using the article table as source.',
          es: 'Reconstrucción tipo packed bubbles del póster de Visual Capitalist usando la tabla del artículo como fuente.',
        },
        note: {
          en: 'This build uses the local Visual Capitalist article HTML as the source of truth for company, sector, and weight values.',
          es: 'Este build usa el HTML local del artículo de Visual Capitalist como fuente base para empresa, sector y peso.',
        },
        source: {
          name: 'Visual Capitalist article table',
          url: 'https://www.visualcapitalist.com/the-entire-sp-500-in-2026-in-one-chart/',
        },
        totalMarketCap: '$57.62T',
        sectors: orderedSectors,
      }
    }
  } catch {
    // Fall back to the live approximation path when the local HTML is not available.
  }

  return buildFallbackPayload()
}

const payload = await buildPayload()

await mkdir(outputDir, { recursive: true })
await writeFile(resolve(outputDir, 'sp500-bubbles.json'), JSON.stringify(payload, null, 2), 'utf8')
console.log(`Saved public/data/sp500-bubbles.json with ${payload.sectors.length} sectors and ${payload.sectors.reduce((sum, sector) => sum + sector.companies, 0)} companies`)
