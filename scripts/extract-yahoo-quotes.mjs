import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  YAHOO_QUOTE_URL,
  chunkArray,
  downloadJson,
  sleep,
} from './lib/data-sources.mjs'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const root = resolve(scriptDir, '..')
const wikipediaDir = resolve(root, 'data/extracted/wikipedia')
const yahooDir = resolve(root, 'data/extracted/yahoo')

function fetchYahooQuotesBatch(symbols) {
  const url = `${YAHOO_QUOTE_URL}${encodeURIComponent(symbols.join(','))}`
  let lastError

  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const json = downloadJson(url)
      return json?.quoteResponse?.result ?? []
    } catch (error) {
      lastError = error
      sleep(700 * (attempt + 1))
    }
  }

  throw lastError
}

const constituents = JSON.parse(
  await readFile(resolve(wikipediaDir, 'constituents.json'), 'utf8'),
)

const quoteChunks = chunkArray(
  constituents.map((row) => row.ticker),
  10,
)

const quoteResults = []
for (const chunk of quoteChunks) {
  quoteResults.push(...fetchYahooQuotesBatch(chunk))
  sleep(250)
}

await mkdir(yahooDir, { recursive: true })
await writeFile(resolve(yahooDir, 'quotes.json'), JSON.stringify(quoteResults, null, 2), 'utf8')

console.log(`Saved Yahoo quotes snapshot with ${quoteResults.length} quote rows`)
