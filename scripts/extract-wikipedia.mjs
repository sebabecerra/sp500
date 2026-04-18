import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  WIKIPEDIA_SP500_URL,
  downloadText,
  parseWikipediaRows,
} from './lib/data-sources.mjs'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const root = resolve(scriptDir, '..')
const wikipediaDir = resolve(root, 'data/extracted/wikipedia')

const html = downloadText(WIKIPEDIA_SP500_URL)
const rows = parseWikipediaRows(html)

await mkdir(wikipediaDir, { recursive: true })
await writeFile(resolve(wikipediaDir, 'constituents.html'), html, 'utf8')
await writeFile(resolve(wikipediaDir, 'constituents.json'), JSON.stringify(rows, null, 2), 'utf8')

console.log(`Saved Wikipedia constituents snapshot with ${rows.length} rows`)
