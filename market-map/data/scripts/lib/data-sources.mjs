import { execFileSync } from 'node:child_process'

export const WIKIPEDIA_SP500_URL = 'https://en.wikipedia.org/wiki/List_of_S%26P_500_companies'
export const YAHOO_QUOTE_URL = 'https://query1.finance.yahoo.com/v7/finance/quote?symbols='

export const sectorConfig = {
  'Information Technology': { key: 'information-technology', es: 'Tecnologia', color: '#78b9ff' },
  Financials: { key: 'financials', es: 'Financieras', color: '#22c55e' },
  'Communication Services': { key: 'communication-services', es: 'Servicios de comunicación', color: '#b793ff' },
  'Consumer Discretionary': { key: 'consumer-discretionary', es: 'Consumo discrecional', color: '#8395ff' },
  'Health Care': { key: 'health-care', es: 'Salud', color: '#e7e3ff' },
  Industrials: { key: 'industrials', es: 'Industriales', color: '#ff9cbc' },
  'Consumer Staples': { key: 'consumer-staples', es: 'Consumo básico', color: '#ff985f' },
  Energy: { key: 'energy', es: 'Energía', color: '#f4c84d' },
  Utilities: { key: 'utilities', es: 'Utilities', color: '#d8df53' },
  Materials: { key: 'materials', es: 'Materiales', color: '#ff6767' },
  'Real Estate': { key: 'real-estate', es: 'Real Estate', color: '#b7ece0' },
}

export function downloadText(url) {
  return execFileSync(
    'curl',
    [
      '-L',
      '-A',
      'Mozilla/5.0',
      '-H',
      'Accept: text/html,application/json;q=0.9,*/*;q=0.8',
      url,
    ],
    { encoding: 'utf8' },
  )
}

export function downloadJson(url) {
  return JSON.parse(downloadText(url))
}

export function decodeHtml(value) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&#8211;|&ndash;/g, '–')
    .replace(/&#8217;|&rsquo;/g, '’')
    .replace(/&#8220;|&#8221;|&quot;/g, '"')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/\[[^\]]+\]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function cleanCompanyName(name) {
  return name
    .replace(/\s+\(The\)$/i, '')
    .replace(/\s+\(Class A\)$/i, ' A')
    .replace(/\s+\(Class B\)$/i, ' B')
    .replace(/\s+\(Class C\)$/i, ' C')
    .trim()
}

function extractWikipediaConstituentsTable(html) {
  const tableMatch =
    html.match(/<table[^>]*id="constituents"[\s\S]*?<\/table>/i) ??
    html.match(/<table[^>]*class="[^"]*wikitable[^"]*"[\s\S]*?<\/table>/i)

  if (!tableMatch) {
    throw new Error('Could not find Wikipedia constituents table')
  }

  return tableMatch[0]
}

export function parseWikipediaRows(html) {
  const tableHtml = extractWikipediaConstituentsTable(html)
  const rowRegex = /<tr[\s\S]*?<\/tr>/gi
  const cellRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi
  const rows = []

  for (const rowMatch of tableHtml.matchAll(rowRegex)) {
    const cells = [...rowMatch[0].matchAll(cellRegex)].map((match) => decodeHtml(match[1]))
    if (cells.length < 4 || cells[0] === 'Symbol') continue

    rows.push({
      ticker: cells[0].replace(/\./g, '-'),
      name: cleanCompanyName(cells[1]),
      sector: cells[2],
      industry: cells[3],
    })
  }

  return rows
}

export function isFinitePositive(value) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

export function formatTrillions(value) {
  return `$${(value / 1e12).toFixed(2)}T`
}
