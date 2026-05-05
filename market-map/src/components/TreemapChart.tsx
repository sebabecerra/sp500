import type { Locale, Sector } from '../types'
import { condensedSectorCompanies } from './sectorDisplay'

type Props = {
  sectors: Sector[]
  locale: Locale
}

type Rect = {
  x: number
  y: number
  w: number
  h: number
}

const WIDTH = 1080
const HEIGHT = 1080
const PAD = 26
const GAP = 6
const HEADER = 24

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`
}

function normalizeCompanyName(name: string) {
  return name
    .replace(/\b(Inc\.?|Corporation|Company|Group|Holdings|Technologies)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function worstRatio(values: number[], side: number) {
  if (!values.length) return Infinity
  const sum = values.reduce((a, b) => a + b, 0)
  const max = Math.max(...values)
  const min = Math.min(...values)
  return Math.max((side * side * max) / (sum * sum), (sum * sum) / (side * side * min))
}

function squarify<T extends { weight: number }>(items: T[], rect: Rect) {
  const total = items.reduce((sum, item) => sum + item.weight, 0) || 1
  const area = rect.w * rect.h
  const nodes = items.map((item) => ({
    item,
    area: (item.weight / total) * area,
  }))

  const result: Array<{ item: T; rect: Rect }> = []
  let row: Array<{ item: T; area: number }> = []
  let x = rect.x
  let y = rect.y
  let w = rect.w
  let h = rect.h
  let remaining = [...nodes]

  while (remaining.length > 0) {
    const side = Math.min(w, h)
    const next = remaining[0]
    const testRow = [...row, next]
    const currentValues = row.map((n) => n.area)
    const testValues = testRow.map((n) => n.area)

    if (row.length === 0 || worstRatio(testValues, side) <= worstRatio(currentValues, side)) {
      row = testRow
      remaining.shift()
      continue
    }

    layoutRow(row)
    row = []
  }

  if (row.length > 0) layoutRow(row)

  return result

  function layoutRow(currentRow: Array<{ item: T; area: number }>) {
    const rowArea = currentRow.reduce((sum, n) => sum + n.area, 0)
    const horizontal = w >= h

    if (horizontal) {
      const rowH = rowArea / w
      let rowX = x
      for (const node of currentRow) {
        const cellW = node.area / rowH
        result.push({ item: node.item, rect: { x: rowX, y, w: cellW, h: rowH } })
        rowX += cellW
      }
      y += rowH
      h -= rowH
    } else {
      const rowW = rowArea / h
      let rowY = y
      for (const node of currentRow) {
        const cellH = node.area / rowW
        result.push({ item: node.item, rect: { x, y: rowY, w: rowW, h: cellH } })
        rowY += cellH
      }
      x += rowW
      w -= rowW
    }
  }
}

export default function TreemapChart({ sectors, locale }: Props) {
  const sectorRects = squarify(
    sectors.map((sector) => ({ ...sector, weight: sector.weight })),
    { x: PAD, y: PAD, w: WIDTH - PAD * 2, h: HEIGHT - PAD * 2 },
  )

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="bubbles-svg" role="img" aria-label="S&P 500 treemap">
      <rect x="0" y="0" width={WIDTH} height={HEIGHT} fill="#141110" rx="18" />

      {sectorRects.map(({ item: sector, rect }) => {
        const inner = {
          x: rect.x + 1,
          y: rect.y + HEADER + 1,
          w: Math.max(0, rect.w - 2),
          h: Math.max(0, rect.h - HEADER - 2),
        }
        const companyRects = squarify(condensedSectorCompanies(sector, locale), inner)

        return (
          <g key={sector.key}>
            <rect x={rect.x} y={rect.y} width={rect.w} height={rect.h} rx="10" fill={sector.color} fillOpacity="0.14" stroke="rgba(255,255,255,0.18)" />
            <text x={rect.x + 8} y={rect.y + 14} className="treemap-sector">
              {sector.name[locale].toUpperCase()}
            </text>
            <text x={rect.x + 8} y={rect.y + 26} className="treemap-sector-count">
              {sector.companies} {locale === 'es' ? 'COMPAÑÍAS' : 'COMPANIES'}
            </text>
            <text x={rect.x + rect.w - 8} y={rect.y + 18} textAnchor="end" className="treemap-sector-weight">
              {formatPercent(sector.weight)}
            </text>

            {companyRects.map(({ item, rect: box }, index) => {
              const w = Math.max(0, box.w - GAP)
              const h = Math.max(0, box.h - GAP)
              const x = box.x + GAP / 2
              const y = box.y + GAP / 2
              const large = w > 120 && h > 72
              const medium = w > 72 && h > 36
              const small = w > 42 && h > 22

              return (
                <g key={`${sector.key}-${item.name}-${index}`}>
                  <rect
                    x={x}
                    y={y}
                    width={w}
                    height={h}
                    rx="6"
                    fill={sector.color}
                    fillOpacity={large ? 0.82 : medium ? 0.68 : 0.54}
                    stroke="rgba(255,255,255,0.24)"
                  />

                  {large ? (
                    <>
                      <text x={x + 8} y={y + 18} className="treemap-company">
                        {normalizeCompanyName(item.name)}
                      </text>
                      <text x={x + 8} y={y + 38} className="treemap-company-weight">
                        {formatPercent(item.weight)}
                      </text>
                    </>
                  ) : medium ? (
                    <text x={x + 6} y={y + 16} className="treemap-micro">
                      {normalizeCompanyName(item.name)}
                    </text>
                  ) : small ? (
                    <text x={x + 5} y={y + 14} className="treemap-tiny">
                      {item.weight.toFixed(1)}%
                    </text>
                  ) : null}
                </g>
              )
            })}
          </g>
        )
      })}
    </svg>
  )
}
