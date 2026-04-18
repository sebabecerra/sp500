import { hierarchy, treemap, type HierarchyRectangularNode } from 'd3-hierarchy'
import type { Bubble, Locale, Sector } from '../types'

type Props = {
  sectors: Sector[]
  locale: Locale
}

type CompanyNode = Bubble & { kind: 'company' }
type IndustryNode = {
  name: string
  kind: 'industry'
  children: CompanyNode[]
}
type SectorNode = {
  key: string
  name: string
  kind: 'sector'
  color: string
  children: IndustryNode[]
}
type RootNode = {
  name: string
  kind: 'root'
  children: SectorNode[]
}

const WIDTH = 1440
const HEIGHT = 900
const PAD = 12

function groupBy<T>(arr: T[], fn: (x: T) => string) {
  return arr.reduce<Record<string, T[]>>((acc, item) => {
    const key = fn(item)
    if (!acc[key]) acc[key] = []
    acc[key].push(item)
    return acc
  }, {})
}

function formatPercent(value: number | undefined) {
  if (typeof value !== 'number') return ''
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`
}

function formatWeight(value: number | undefined) {
  if (typeof value !== 'number') return ''
  return `${value.toFixed(1)}%`
}

function companyLabel(company: Bubble) {
  return company.ticker || company.label || company.name
}

function getColor(change: number | undefined, sectorColor: string) {
  if (typeof change !== 'number' || Number.isNaN(change) || change === 0) {
    return sectorColor
  }

  const intensity = Math.min(Math.abs(change) / 10, 1)

  if (change > 0) {
    return `rgba(0, 180, 0, ${0.4 + intensity * 0.6})`
  }
  return `rgba(200, 0, 0, ${0.4 + intensity * 0.6})`
}

function buildTree(sectors: Sector[], locale: Locale): RootNode {
  return {
    name: 'root',
    kind: 'root',
    children: sectors.map((sector) => {
      const grouped = groupBy(sector.top, (company) => company.industry || 'Other')

      return {
        key: sector.key,
        name: sector.name[locale],
        kind: 'sector',
        color: sector.color,
        children: Object.entries(grouped).map(([industry, companies]) => ({
          name: industry,
          kind: 'industry' as const,
          children: companies.map((company) => ({
            ...company,
            kind: 'company' as const,
          })),
        })),
      }
    }),
  }
}

export default function MarketMapChart({ sectors, locale }: Props) {
  const data = buildTree(sectors, locale)

  const root = hierarchy<RootNode | SectorNode | IndustryNode | CompanyNode>(data)
    .sum((node) => (node.kind === 'company' ? node.weight : 0))
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))

  treemap<RootNode | SectorNode | IndustryNode | CompanyNode>()
    .size([WIDTH - PAD * 2, HEIGHT - PAD * 2])
    .paddingOuter(0)
    .paddingInner(1)
    .paddingTop((node) => (node.depth === 1 ? 22 : node.depth === 2 ? 16 : 0))
    .round(true)(root)

  const layout = root as HierarchyRectangularNode<RootNode | SectorNode | IndustryNode | CompanyNode>

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} style={{ background: '#0b0b0b', borderRadius: 12 }}>
      <g transform={`translate(${PAD}, ${PAD})`}>
        {(layout.children ?? []).map((sectorNode) => {
          const sector = sectorNode.data as SectorNode
          const w = sectorNode.x1 - sectorNode.x0
          const h = sectorNode.y1 - sectorNode.y0

          return (
            <g key={sector.key} transform={`translate(${sectorNode.x0}, ${sectorNode.y0})`}>
              <rect width={w} height={h} fill={sector.color} fillOpacity={0.12} />

              <text x={6} y={16} fill="white" fontSize={12} fontWeight="bold">
                {sector.name}
              </text>

              {(sectorNode.children ?? []).map((industryNode) => {
                const industry = industryNode.data as IndustryNode
                const iw = industryNode.x1 - industryNode.x0
                const ih = industryNode.y1 - industryNode.y0

                return (
                  <g
                    key={industry.name}
                    transform={`translate(${industryNode.x0 - sectorNode.x0}, ${industryNode.y0 - sectorNode.y0})`}
                  >
                    <rect width={iw} height={ih} fill="rgba(255,255,255,0.03)" />

                    {iw > 80 && ih > 40 && (
                      <text x={4} y={14} fill="rgba(255,255,255,0.6)" fontSize={10}>
                        {industry.name}
                      </text>
                    )}

                    {(industryNode.children ?? []).map((companyNode) => {
                      const company = companyNode.data as CompanyNode
                      const x = companyNode.x0 - industryNode.x0
                      const y = companyNode.y0 - industryNode.y0
                      const cw = companyNode.x1 - companyNode.x0
                      const ch = companyNode.y1 - companyNode.y0

                      const giant = cw > 120 && ch > 80
                      const large = cw > 70 && ch > 40
                      const medium = cw > 40 && ch > 20

                      return (
                        <g key={company.ticker || company.name} transform={`translate(${x}, ${y})`}>
                          <rect width={cw} height={ch} fill={getColor(company.change, sector.color)} />

                          {giant && (
                            <>
                              <text x={6} y={24} fill="white" fontSize={18} fontWeight="bold">
                                {companyLabel(company)}
                              </text>
                              <text x={6} y={42} fill="white" fontSize={14} fontWeight="bold">
                                {formatWeight(company.weight)}
                              </text>
                              {typeof company.change === 'number' ? (
                                <text x={6} y={58} fill="white" fontSize={12}>
                                  {formatPercent(company.change)}
                                </text>
                              ) : null}
                            </>
                          )}

                          {large && !giant && (
                            <>
                              <text x={4} y={18} fill="white" fontSize={12}>
                                {companyLabel(company)}
                              </text>
                              <text x={4} y={30} fill="white" fontSize={10} fontWeight="bold">
                                {formatWeight(company.weight)}
                              </text>
                              {typeof company.change === 'number' ? (
                                <text x={4} y={42} fill="white" fontSize={9}>
                                  {formatPercent(company.change)}
                                </text>
                              ) : null}
                            </>
                          )}

                          {medium && !large && (
                            <>
                              <text x={3} y={13} fill="white" fontSize={9}>
                                {companyLabel(company)}
                              </text>
                              <text x={3} y={23} fill="white" fontSize={8} fontWeight="bold">
                                {formatWeight(company.weight)}
                              </text>
                            </>
                          )}
                        </g>
                      )
                    })}
                  </g>
                )
              })}
            </g>
          )
        })}
      </g>
    </svg>
  )
}
