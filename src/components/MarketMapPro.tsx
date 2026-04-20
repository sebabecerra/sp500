'use client'

import { useMemo, useRef, useState } from 'react'
import { hierarchy, treemap, type HierarchyRectangularNode } from 'd3-hierarchy'
import type { Bubble, Locale, Sector, ViewMode } from '../types'
import MarketToolbar from './MarketToolbar'

type Props = {
  sectors: Sector[]
  locale: Locale
  viewMode: ViewMode
  availableModes: ViewMode[]
  onViewModeChange: (mode: ViewMode) => void
}

type CompanyNode = Bubble & {
  kind: 'company'
  sectorKey: string
  sectorName: string
}
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
const TOOLTIP_WIDTH = 220
const TOOLTIP_HEIGHT = 148
const TOOLTIP_OFFSET = 16
const TOOLTIP_MARGIN = 12

function groupBy<T>(items: T[], getKey: (item: T) => string) {
  return items.reduce<Record<string, T[]>>((acc, item) => {
    const key = getKey(item)
    if (!acc[key]) acc[key] = []
    acc[key].push(item)
    return acc
  }, {})
}

function getPerformanceColor(value: number | undefined, sectorColor: string, viewMode: ViewMode) {
  if (viewMode === 'weight') {
    return sectorColor
  }

  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 'rgba(148, 163, 184, 0.48)'
  }

  const scale = viewMode === '1d' ? 8 : viewMode === 'ytd' ? 35 : viewMode === '1y' ? 60 : viewMode === '5y' ? 150 : 250
  const magnitude = Math.min(Math.abs(value) / scale, 1)

  if (value > 0) {
    const alpha = 0.68 + magnitude * 0.32
    return `rgba(0, 255, 102, ${alpha})`
  }

  if (value < 0) {
    const alpha = 0.68 + magnitude * 0.32
    return `rgba(255, 38, 38, ${alpha})`
  }

  return 'rgba(148, 163, 184, 0.72)'
}

function formatChange(value: number) {
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`
}

function getMetricValue(company: Bubble, mode: ViewMode) {
  switch (mode) {
    case '1d':
      return company.return1d ?? company.change
    case 'ytd':
      return company.returnYtd
    case '1y':
      return company.return1y
    case '5y':
      return company.return5y
    case '10y':
      return company.return10y
    default:
      return company.weight
  }
}

function formatMetricValue(company: Bubble, mode: ViewMode) {
  const value = getMetricValue(company, mode)
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return mode === 'weight' ? `${value.toFixed(2)}%` : formatChange(value)
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function fitFontSize(text: string, width: number, height: number, options: {
  min: number
  max: number
  widthFactor: number
  heightFactor: number
  charFactor: number
}) {
  const safeText = text.trim() || 'X'
  const byWidth = width / Math.max(safeText.length * options.charFactor, 1)
  const byHeight = height * options.heightFactor
  return clamp(Math.min(byWidth * options.widthFactor, byHeight), options.min, options.max)
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
        children: Object.entries(grouped)
          .map(([industry, companies]) => ({
            name: industry,
            kind: 'industry' as const,
            children: companies
              .slice()
              .sort((a, b) => b.weight - a.weight)
              .map((company) => ({
                ...company,
                sectorKey: sector.key,
                sectorName: sector.name[locale],
                kind: 'company' as const,
              })),
          }))
          .sort((a, b) => {
            const wa = a.children.reduce((sum, company) => sum + company.weight, 0)
            const wb = b.children.reduce((sum, company) => sum + company.weight, 0)
            return wb - wa
          }),
      }
    }),
  }
}

function filterSectors(
  sectors: Sector[],
  locale: Locale,
  search: string,
  selectedSector: string | null,
) {
  const normalizedSearch = search.trim().toLowerCase()

  let scoped = sectors

  if (selectedSector) {
    scoped = scoped.filter((sector) => sector.key === selectedSector)
  }

  const filtered = scoped
    .map((sector) => {
      const companies = sector.top.filter((company) => {
        const ticker = (company.ticker || company.label || '').toLowerCase()
        const name = company.name.toLowerCase()
        return !normalizedSearch || ticker.includes(normalizedSearch) || name.includes(normalizedSearch)
      })

      return {
        ...sector,
        top: companies,
      }
    })
    .filter((sector) => sector.top.length > 0)

  return buildTree(filtered, locale)
}

export default function MarketMapPro({ sectors, locale, viewMode, availableModes, onViewModeChange }: Props) {
  const [search, setSearch] = useState('')
  const [selectedSector, setSelectedSector] = useState<string | null>(null)
  const [hoveredCompany, setHoveredCompany] = useState<CompanyNode | null>(null)
  const chartRef = useRef<HTMLDivElement | null>(null)
  const [tooltip, setTooltip] = useState<{
    x: number
    y: number
    company: CompanyNode
  } | null>(null)

  const rootData = useMemo(
    () => filterSectors(sectors, locale, search, selectedSector),
    [sectors, locale, search, selectedSector],
  )

  const layoutRoot = useMemo(() => {
    const root = hierarchy<RootNode | SectorNode | IndustryNode | CompanyNode>(rootData)
      .sum((node) => (node.kind === 'company' ? node.weight : 0))
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))

    treemap<RootNode | SectorNode | IndustryNode | CompanyNode>()
      .size([WIDTH - PAD * 2, HEIGHT - PAD * 2])
      .paddingOuter(0)
      .paddingInner(1)
      .paddingTop((node) => {
        if (node.depth === 1) return 22
        if (node.depth === 2) return 14
        return 0
      })
      .round(true)(root)

    return root as HierarchyRectangularNode<RootNode | SectorNode | IndustryNode | CompanyNode>
  }, [rootData])

  const sectorNodes = layoutRoot.children ?? []
  const activeCompany = hoveredCompany

  const positionTooltip = (clientX: number, clientY: number, company: CompanyNode) => {
    const bounds = chartRef.current?.getBoundingClientRect()

    if (!bounds) return

    let x = clientX + TOOLTIP_OFFSET
    let y = clientY + TOOLTIP_OFFSET

    if (x + TOOLTIP_WIDTH > bounds.right - TOOLTIP_MARGIN) {
      x = clientX - TOOLTIP_WIDTH - TOOLTIP_OFFSET
    }

    if (y + TOOLTIP_HEIGHT > bounds.bottom - TOOLTIP_MARGIN) {
      y = clientY - TOOLTIP_HEIGHT - TOOLTIP_OFFSET
    }

    x = clamp(x, bounds.left + TOOLTIP_MARGIN, bounds.right - TOOLTIP_WIDTH - TOOLTIP_MARGIN)
    y = clamp(y, bounds.top + TOOLTIP_MARGIN, bounds.bottom - TOOLTIP_HEIGHT - TOOLTIP_MARGIN)

    setTooltip({ x, y, company })
  }

  return (
    <div>
      <div
        style={{
          background: '#0d0f12',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 14,
          padding: 14,
          marginBottom: 14,
        }}
      >
        <MarketToolbar
          locale={locale}
          search={search}
          onSearchChange={setSearch}
          selectedSector={selectedSector}
          onClearSector={() => setSelectedSector(null)}
          viewMode={viewMode}
          availableModes={availableModes}
          onViewModeChange={onViewModeChange}
        />
      </div>

      <div
        ref={chartRef}
        style={{
          position: 'relative',
          background: '#0b0b0b',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 14,
          overflow: 'hidden',
        }}
      >
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          style={{
            width: '100%',
            height: 'auto',
            display: 'block',
            background: '#0b0b0b',
          }}
          role="img"
          aria-label="S&P 500 market map"
        >
          <rect x="0" y="0" width={WIDTH} height={HEIGHT} fill="#0b0b0b" />

          <g transform={`translate(${PAD}, ${PAD})`}>
            {sectorNodes.map((sectorNode) => {
                const sector = sectorNode.data as SectorNode
                const w = sectorNode.x1 - sectorNode.x0
                const h = sectorNode.y1 - sectorNode.y0
                const sectorIsFocused = !selectedSector || selectedSector === sector.key

                return (
                  <g key={sector.key} transform={`translate(${sectorNode.x0}, ${sectorNode.y0})`}>
                    <rect
                      x="0"
                      y="0"
                      width={w}
                      height={h}
                      fill={sector.color}
                      fillOpacity={sectorIsFocused ? 0.2 : 0.09}
                      stroke="rgba(255,255,255,0.16)"
                      style={{ cursor: 'pointer', transition: 'all 180ms ease' }}
                      onClick={() => {
                        if (selectedSector === sector.key) {
                          setSelectedSector(null)
                        } else {
                          setSelectedSector(sector.key)
                        }
                      }}
                    />

                    <text
                      x="6"
                      y="14"
                      fill="#ffffff"
                      fontSize="12"
                      fontWeight="900"
                      style={{ pointerEvents: 'none' }}
                    >
                      {sector.name.toUpperCase()}
                    </text>

                    {(sectorNode.children ?? []).map((industryNode) => {
                      const industry = industryNode.data as IndustryNode
                      const ix = industryNode.x0 - sectorNode.x0
                      const iy = industryNode.y0 - sectorNode.y0
                      const iw = industryNode.x1 - industryNode.x0
                      const ih = industryNode.y1 - industryNode.y0

                      return (
                        <g key={`${sector.key}-${industry.name}`} transform={`translate(${ix}, ${iy})`}>
                          {iw > 72 && ih > 18 ? (
                            <text
                              x="3"
                              y="10"
                              fill="#ffffff"
                              fontSize={clamp(Math.min(iw / 18, 9), 7, 9)}
                              fontWeight="900"
                              style={{ pointerEvents: 'none' }}
                            >
                              {industry.name.toUpperCase()}
                            </text>
                          ) : null}

                          {(industryNode.children ?? []).map((companyNode) => {
                            const company = companyNode.data as CompanyNode
                            const x = companyNode.x0 - industryNode.x0
                            const y = companyNode.y0 - industryNode.y0
                            const cw = companyNode.x1 - companyNode.x0
                            const ch = companyNode.y1 - companyNode.y0
                            const label = company.ticker || company.label || company.name
                            const showPrimary = cw > 34 && ch > 16
                            const metricText = formatMetricValue(company, viewMode)
                            const showMetric = metricText !== null && cw > 58 && ch > 26
                            const isActive =
                              activeCompany?.ticker === company.ticker &&
                              activeCompany?.industry === company.industry

                            const tickerFontSize = fitFontSize(label, cw - 8, ch, {
                              min: 8,
                              max: 32,
                              widthFactor: 1.15,
                              heightFactor: 0.34,
                              charFactor: 0.72,
                            })
                            const weightFontSize = fitFontSize(metricText ?? '', cw - 8, ch, {
                              min: 8,
                              max: 16,
                              widthFactor: 1.05,
                              heightFactor: 0.18,
                              charFactor: 0.62,
                            })
                            const tickerY = 6 + tickerFontSize
                            const weightY = tickerY + Math.max(10, weightFontSize + 4)

                            return (
                              <g
                                key={`${sector.key}-${industry.name}-${company.ticker || company.name}`}
                                transform={`translate(${x}, ${y})`}
                                onMouseEnter={() => {
                                  setHoveredCompany(company)
                                }}
                                onMouseLeave={() => {
                                  setHoveredCompany((current) =>
                                    current?.ticker === company.ticker ? null : current,
                                  )
                                  setTooltip(null)
                                }}
                                onMouseMove={(event) => {
                                  positionTooltip(event.clientX, event.clientY, company)
                                }}
                          style={{
                            cursor: 'pointer',
                            transition: 'transform 140ms ease, opacity 140ms ease',
                                }}
                              >
                                <rect
                                  x="0"
                                  y="0"
                                  width={cw}
                                  height={ch}
                                  fill={getPerformanceColor(getMetricValue(company, viewMode), sector.color, viewMode)}
                                  stroke={
                                    isActive
                                      ? 'rgba(255,255,255,0.85)'
                                      : 'rgba(0,0,0,0.20)'
                                  }
                                  strokeWidth={isActive ? 2 : 1}
                                  opacity={activeCompany && !isActive ? 0.78 : 1}
                                  style={{
                                    transition:
                                      'stroke 140ms ease, opacity 140ms ease, transform 140ms ease',
                                  }}
                                />

                                {showPrimary ? (
                                  <text
                                    x="3"
                                    y={tickerY}
                                    fill="#111111"
                                    fontSize={tickerFontSize}
                                    fontWeight="900"
                                    style={{ pointerEvents: 'none' }}
                                  >
                                    {label}
                                  </text>
                                ) : null}

                                {showMetric ? (
                                  <text
                                    x="4"
                                    y={weightY}
                                    fill="#111111"
                                    fontSize={weightFontSize}
                                    fontWeight="800"
                                    style={{ pointerEvents: 'none' }}
                                  >
                                    {metricText}
                                  </text>
                                ) : null}

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

        {tooltip ? (
          <div
            style={{
              position: 'fixed',
              left: tooltip.x,
              top: tooltip.y,
              pointerEvents: 'none',
              background: 'rgba(13,15,18,0.96)',
              border: '1px solid rgba(255,255,255,0.10)',
              borderRadius: 10,
              padding: '10px 12px',
              width: TOOLTIP_WIDTH,
              boxShadow: '0 12px 28px rgba(0,0,0,0.28)',
              zIndex: 9999,
            }}
          >
            <div style={{ color: 'white', fontWeight: 800, fontSize: 14 }}>
              {tooltip.company.ticker || tooltip.company.label || tooltip.company.name}
            </div>
            <div style={{ color: 'rgba(255,255,255,0.76)', fontSize: 12, marginBottom: 8 }}>
              {tooltip.company.name}
            </div>
            <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12 }}>
              <strong style={{ color: 'rgba(255,255,255,0.8)' }}>Sector:</strong> {tooltip.company.sectorName}
            </div>
            <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12, marginTop: 4 }}>
              <strong style={{ color: 'rgba(255,255,255,0.8)' }}>Industry:</strong> {tooltip.company.industry ?? 'Other'}
            </div>
            <div style={{ color: 'white', fontSize: 12, fontWeight: 700, marginTop: 6 }}>
              <strong>Weight:</strong> {tooltip.company.weight.toFixed(2)}%
            </div>
            {viewMode !== 'weight' && formatMetricValue(tooltip.company, viewMode) ? (
              <div
                style={{
                  color:
                    (getMetricValue(tooltip.company, viewMode) ?? 0) >= 0
                      ? 'rgb(74, 222, 128)'
                      : 'rgb(248, 113, 113)',
                  fontSize: 12,
                  fontWeight: 700,
                  marginTop: 6,
                }}
              >
                {formatMetricValue(tooltip.company, viewMode)}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}
