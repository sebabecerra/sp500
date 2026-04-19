import { hierarchy, pack, type HierarchyCircularNode, type HierarchyNode } from 'd3-hierarchy'
import type { Bubble, Locale, Sector } from '../types'
import { condensedSectorCompanies } from './sectorDisplay'

type Props = {
  sectors: Sector[]
  locale: Locale
  totalMarketCap: string
}

type PackedBubble = Bubble & {
  cx: number
  cy: number
  r: number
  explicit: boolean
}

type BubbleNode = {
  bubble?: Bubble
  explicit?: boolean
  value: number
  children?: BubbleNode[]
}

const WIDTH = 1080
const HEIGHT = 1080
const CENTER_X = 540
const CENTER_Y = 540

const sectorAnchors: Record<string, Record<string, { x: number; y: number; scale?: number }>> = {
  'information-technology': {
    Nvidia: { x: -0.33, y: 0.1, scale: 1.28 },
    'Apple Inc.': { x: 0.28, y: 0.08, scale: 1.2 },
    Microsoft: { x: -0.02, y: 0.56, scale: 1.12 },
    Broadcom: { x: 0.14, y: -0.34, scale: 0.96 },
    'Micron Technology': { x: 0.46, y: -0.08, scale: 0.78 },
    Oracle: { x: -0.46, y: -0.12, scale: 0.76 },
    Cisco: { x: -0.68, y: 0.02, scale: 0.7 },
    'Advanced Micro Devices': { x: 0.6, y: 0.46, scale: 0.72 },
    Intel: { x: -0.62, y: 0.56, scale: 0.68 },
    'Palantir Technologies': { x: -0.36, y: 0.58, scale: 0.68 },
  },
  financials: {
    'Berkshire Hathaway': { x: -0.22, y: 0.08, scale: 1.06 },
    'JPMorgan Chase': { x: 0.36, y: 0.12, scale: 0.9 },
    'Visa Inc.': { x: 0.04, y: 0.64, scale: 0.9 },
    'Bank of America': { x: -0.42, y: -0.08, scale: 0.72 },
    'Goldman Sachs': { x: 0.48, y: -0.04, scale: 0.68 },
    Mastercard: { x: 0.1, y: -0.42, scale: 0.72 },
    'Wells Fargo': { x: 0.44, y: 0.46, scale: 0.62 },
    Citigroup: { x: -0.46, y: 0.46, scale: 0.62 },
    'Morgan Stanley': { x: -0.2, y: 0.64, scale: 0.62 },
    BlackRock: { x: 0.58, y: 0.58, scale: 0.6 },
  },
  'communication-services': {
    'Alphabet Inc. A': { x: -0.24, y: -0.08, scale: 1.0 },
    'Alphabet Inc. C': { x: 0.34, y: -0.06, scale: 0.96 },
    'Meta Platforms': { x: 0.04, y: 0.46, scale: 0.9 },
    Netflix: { x: 0.0, y: -0.52, scale: 0.72 },
    'T-Mobile US': { x: -0.48, y: -0.48, scale: 0.62 },
    Verizon: { x: 0.46, y: -0.46, scale: 0.62 },
    'AT&T': { x: -0.64, y: 0.14, scale: 0.6 },
    'Walt Disney Company': { x: 0.58, y: 0.14, scale: 0.58 },
  },
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`
}

function wrapSectorName(name: string) {
  return name.split(' ')
}

function toDisplayLabel(name: string, label?: string) {
  const value = label ?? name
  const custom: Record<string, string[]> = {
    'Alphabet Inc. A': ['Alphabet', '(Class A)'],
    'Alphabet Inc. C': ['Alphabet', '(Class C)'],
    'Meta Platforms': ['Meta'],
    'Berkshire Hathaway': ['Berkshire', 'Hathaway'],
    'JPMorgan Chase': ['JPMorgan', 'Chase'],
    'Bank of America': ['Bank of', 'America'],
    'Walt Disney Company': ['Disney'],
    'T-Mobile US': ['T-Mobile'],
    'Tesla, Inc.': ['Tesla'],
    'Apple Inc.': ['Apple'],
    'Visa Inc.': ['VISA'],
    Mastercard: ['Mastercard'],
  }
  if (custom[value]) return custom[value]

  const cleaned = value.replace(/\b(Inc\.?|Corporation|Company|Technologies|Group|Holdings)\b/gi, '').replace(/\s+/g, ' ').trim()
  const words = cleaned.split(' ')
  if (words.length >= 3 && cleaned.length > 16) {
    const midpoint = Math.ceil(words.length / 2)
    return [words.slice(0, midpoint).join(' '), words.slice(midpoint).join(' ')]
  }
  return cleaned.split('\n')
}

function buildBubbleSet(sector: Sector, locale: Locale): Array<Bubble & { explicit: boolean }> {
  const explicit = [...condensedSectorCompanies(sector, locale), ...(sector.others ?? [])].map((bubble) => ({
    ...bubble,
    explicit: true,
  }))
  const remainingCount = Math.max(0, sector.companies - explicit.length)
  const explicitWeight = explicit.reduce((sum, bubble) => sum + bubble.weight, 0)
  const residualWeight = Math.max(0.2, sector.weight - explicitWeight)
  const generated = Array.from({ length: remainingCount }, (_, index) => ({
    name: `${sector.key}-other-${index + 1}`,
    label: '',
    weight: residualWeight / Math.max(remainingCount, 1),
    explicit: false,
  }))
  return [...explicit, ...generated]
}

function placeBubble(placed: PackedBubble[], candidateR: number, limitR: number, angleOffset = 0) {
  if (placed.length === 0) return { cx: 0, cy: 0 }

  const stepRadius = 3.2
  for (let radius = 6; radius <= limitR - candidateR; radius += stepRadius) {
    const turns = Math.max(18, Math.floor((Math.PI * 2 * radius) / 10))
    for (let i = 0; i < turns; i += 1) {
      const angle = angleOffset + (Math.PI * 2 * i) / turns + radius * 0.02
      const cx = Math.cos(angle) * radius
      const cy = Math.sin(angle) * radius
      const withinBoundary = Math.hypot(cx, cy) + candidateR <= limitR - 2
      if (!withinBoundary) continue
      const collision = placed.some((bubble) => Math.hypot(cx - bubble.cx, cy - bubble.cy) < candidateR + bubble.r + 2.5)
      if (!collision) return { cx, cy }
    }
  }

  const fallbackAngle = angleOffset + placed.length * 0.33
  const fallbackRadius = Math.max(0, limitR - candidateR - 4)
  return { cx: Math.cos(fallbackAngle) * fallbackRadius, cy: Math.sin(fallbackAngle) * fallbackRadius }
}

function packSectorBubblesForLocale(sector: Sector, locale: Locale): PackedBubble[] {
  const nodes = buildBubbleSet(sector, locale)
    .slice()
    .sort((a, b) => b.weight - a.weight)

  const anchors = sectorAnchors[sector.key]
  if (anchors) {
    return packAnchoredSectorBubbles(sector, nodes, anchors)
  }

  const root = hierarchy<BubbleNode>({
    value: sector.weight,
    children: nodes.map((bubble) => ({
      bubble,
      explicit: bubble.explicit,
      value: Math.max(bubble.weight, 0.01),
    })),
  })
    .sum((node: BubbleNode) => node.value)
    .sort((a: HierarchyNode<BubbleNode>, b: HierarchyNode<BubbleNode>) => (b.value ?? 0) - (a.value ?? 0))

  const size = sector.r * 1.72
  const layout = pack<BubbleNode>()
    .size([size, size])
    .padding(4)

  const packedRoot = layout(root)
  const offsetX = sector.x - size / 2
  const offsetY = sector.y - size / 2

  return (packedRoot.children ?? [])
    .filter((node: HierarchyCircularNode<BubbleNode>) => node.data.bubble)
    .map((node: HierarchyCircularNode<BubbleNode>) => ({
      ...(node.data.bubble as Bubble),
      explicit: Boolean(node.data.explicit),
      cx: offsetX + node.x,
      cy: offsetY + node.y,
      r: node.r,
    }))
}

function packAnchoredSectorBubbles(
  sector: Sector,
  nodes: Array<Bubble & { explicit: boolean }>,
  anchors: Record<string, { x: number; y: number; scale?: number }>,
): PackedBubble[] {
  const limitR = sector.r * 0.88
  const anchored: PackedBubble[] = []
  const leftovers: Array<Bubble & { explicit: boolean }> = []

  for (const bubble of nodes) {
    const anchor = anchors[bubble.label ?? bubble.name]
    if (!anchor) {
      leftovers.push(bubble)
      continue
    }

    const base = Math.sqrt(Math.max(bubble.weight, 0.01) / sector.weight)
    const r = Math.max(10, Math.min(limitR * 0.44, base * sector.r * 1.42 * (anchor.scale ?? 1)))
    anchored.push({
      ...bubble,
      cx: sector.x + sector.r * anchor.x,
      cy: sector.y + sector.r * anchor.y,
      r,
    })
  }

  const packed = [...anchored]
  for (const [index, bubble] of leftovers.entries()) {
    const base = Math.sqrt(Math.max(bubble.weight, 0.01) / sector.weight)
    const candidateR = bubble.explicit
      ? Math.max(7, Math.min(limitR * 0.14, base * sector.r * 0.98))
      : Math.max(4, Math.min(limitR * 0.085, base * sector.r * 0.65))
    const anchor = placeBubble(
      packed,
      candidateR,
      limitR,
      -Math.PI / 2 + index * 0.23,
    )
    packed.push({
      ...bubble,
      cx: sector.x + anchor.cx,
      cy: sector.y + anchor.cy,
      r: candidateR,
    })
  }

  return packed
}

function bubbleNameSize(r: number) {
  if (r >= 84) return 16
  if (r >= 58) return 13
  if (r >= 42) return 11
  if (r >= 30) return 9
  if (r >= 20) return 7.5
  return 0
}

function bubbleWeightSize(r: number) {
  if (r >= 84) return 18
  if (r >= 58) return 15
  if (r >= 42) return 12
  if (r >= 30) return 10
  if (r >= 20) return 8
  return 0
}

function shouldShowLabel(bubble: PackedBubble) {
  return bubble.explicit && bubbleNameSize(bubble.r) > 0
}

export default function BubbleChart({ sectors, locale, totalMarketCap }: Props) {
  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="bubbles-svg" role="img" aria-label="S&P 500 sector bubbles">
      <rect x="0" y="0" width={WIDTH} height={HEIGHT} fill="#141110" rx="18" />

      <g transform={`translate(${CENTER_X}, ${CENTER_Y})`}>
        <text className="center-small" textAnchor="middle" y="-36">{locale === 'es' ? 'Todo el' : 'The Entire'}</text>
        <text className="center-sp" textAnchor="middle" y="18">S&amp;P</text>
        <text className="center-500" textAnchor="middle" y="134">500</text>
        <rect x="-96" y="176" width="192" height="92" rx="14" className="center-card" />
        <text className="center-card-caption" textAnchor="middle" y="208">{locale === 'es' ? 'CAPITALIZACION' : 'TOTAL MARKET CAP'}</text>
        <text className="center-card-value" textAnchor="middle" y="244">{totalMarketCap}</text>
      </g>

      {sectors.map((sector) => {
        const bubbles = packSectorBubblesForLocale(sector, locale)
        return (
          <g key={sector.key}>
            <circle
              cx={sector.x}
              cy={sector.y}
              r={sector.r}
              fill={sector.color}
              fillOpacity="0.95"
              stroke="rgba(255,255,255,0.16)"
              strokeWidth="2.6"
            />

            <text x={sector.x} y={sector.y - sector.r - 20} textAnchor="middle" className="sector-label">
              {wrapSectorName(sector.name[locale]).map((line, idx) => (
                <tspan key={idx} x={sector.x} dy={idx === 0 ? 0 : 14}>{line}</tspan>
              ))}
            </text>
            <text x={sector.x + sector.r * 0.62} y={sector.y - sector.r - 12} textAnchor="middle" className="sector-weight">
              {formatPercent(sector.weight)}
            </text>
            <text x={sector.x + sector.r * 0.8} y={sector.y - sector.r + 4} textAnchor="middle" className="sector-companies">
              {sector.companies} {locale === 'es' ? 'compañías' : 'companies'}
            </text>

            {bubbles.map((bubble, index) => {
              const nameSize = bubbleNameSize(bubble.r)
              const weightSize = bubbleWeightSize(bubble.r)
              const lines = toDisplayLabel(bubble.name, bubble.label)
              const showText = shouldShowLabel(bubble)

              return (
                <g key={`${bubble.name}-${index}`}>
                  <circle
                    cx={bubble.cx}
                    cy={bubble.cy}
                    r={bubble.r}
                    fill={bubble.explicit ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.18)'}
                    stroke={bubble.explicit ? 'rgba(255,255,255,0.58)' : 'rgba(255,255,255,0.3)'}
                    strokeWidth={bubble.explicit ? 1.8 : 0.8}
                  />

                  {showText ? (
                    <>
                      <text
                        x={bubble.cx}
                        y={bubble.cy - (weightSize > 0 ? 6 : 0)}
                        textAnchor="middle"
                        className="bubble-name"
                        style={{ fontSize: `${nameSize}px` }}
                      >
                        {lines.map((line, idx) => (
                          <tspan key={idx} x={bubble.cx} dy={idx === 0 ? 0 : nameSize * 1.02}>{line}</tspan>
                        ))}
                      </text>
                      {weightSize > 0 ? (
                        <text
                          x={bubble.cx}
                          y={bubble.cy + lines.length * (nameSize * 0.72) + 9}
                          textAnchor="middle"
                          className="bubble-weight"
                          style={{ fontSize: `${weightSize}px` }}
                        >
                          {bubble.weight.toFixed(1)}%
                        </text>
                      ) : null}
                    </>
                  ) : bubble.explicit && bubble.r >= 18 && bubble.weight >= 0.1 ? (
                    <text
                      x={bubble.cx}
                      y={bubble.cy + 2}
                      textAnchor="middle"
                      className="bubble-micro"
                      style={{ fontSize: `${Math.max(6, bubble.r * 0.34)}px` }}
                    >
                      {toDisplayLabel(bubble.name, bubble.label)[0]}
                    </text>
                  ) : null}
                </g>
              )
            })}
          </g>
        )
      })}

      <text x="32" y="1046" className="source-line">Source: Visual Capitalist article table, reconstructed into a packed-bubbles poster.</text>
    </svg>
  )
}
