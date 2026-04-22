import { useMemo, useRef, useState } from 'react'
import type { Locale, SectorReturnsPayload } from '../types'

type Period = 'ytd' | '1y' | '5y' | '10y' | 'max'

type Props = {
  data: SectorReturnsPayload
  locale: Locale
}

type PreparedSector = SectorReturnsPayload['sectors'][number] & {
  rebased: Array<{ date: string; t: number; value: number }>
  latest: number
}

const WIDTH = 1180
const HEIGHT = 520
const MARGIN = { top: 28, right: 26, bottom: 38, left: 56 }

export default function SectorReturnsChart({ data, locale }: Props) {
  const [period, setPeriod] = useState<Period>('5y')
  const [activeKey, setActiveKey] = useState<string | null>(null)
  const [hoveredKey, setHoveredKey] = useState<string | null>(null)
  const [hoverInfo, setHoverInfo] = useState<{
    x: number
    y: number
    sector: PreparedSector
    point: PreparedSector['rebased'][number]
    coverage: number
  } | null>(null)
  const chartWrapRef = useRef<HTMLDivElement | null>(null)

  const labels = {
    en: {
      title: 'Sector Return Time Series',
      subtitle: 'Each line is rebased to 100 at the beginning of the selected window. Sector performance is chained from weighted daily constituent returns.',
      periods: { ytd: 'YTD', '1y': '1Y', '5y': '5Y', '10y': '10Y', max: 'MAX' },
      latest: 'Latest',
      xAxis: 'Date',
      yAxis: 'Rebased level',
      baseLine: 'Base 100',
      hoverDate: 'Date',
      hoverValue: 'Level',
      hoverCoverage: 'Coverage',
    },
    es: {
      title: 'Serie de Tiempo de Retornos por Sector',
      subtitle: 'Cada línea se rebasea a 100 al inicio de la ventana seleccionada. El desempeño sectorial se encadena desde retornos diarios ponderados de sus constituyentes.',
      periods: { ytd: 'YTD', '1y': '1A', '5y': '5A', '10y': '10A', max: 'MAX' },
      latest: 'Último',
      xAxis: 'Fecha',
      yAxis: 'Nivel rebaseado',
      baseLine: 'Base 100',
      hoverDate: 'Fecha',
      hoverValue: 'Nivel',
      hoverCoverage: 'Cobertura',
    },
  }[locale]

  const prepared = useMemo(() => {
    const now = new Date(data.generatedAt)

    const cutoff = (() => {
      if (period === 'max') return null
      if (period === 'ytd') return new Date(now.getFullYear(), 0, 1)
      const years = period === '1y' ? 1 : period === '5y' ? 5 : 10
      return new Date(now.getFullYear() - years, now.getMonth(), now.getDate())
    })()

    const sectors = data.sectors
      .map((sector) => {
        const visible = sector.series.filter((point) => {
          if (!cutoff) return true
          return new Date(point.date) >= cutoff
        })

        if (!visible.length) return null

        const base = visible[0].value
        const rebased = visible.map((point) => ({
          date: point.date,
          t: new Date(point.date).getTime(),
          value: Number(((point.value / base) * 100).toFixed(4)),
        }))

        return {
          ...sector,
          rebased,
          latest: rebased[rebased.length - 1]?.value ?? 100,
        }
      })
      .filter((sector): sector is PreparedSector => sector !== null)
      .sort((a, b) => b.weight - a.weight)

    const focusSectors =
      activeKey && sectors.some((sector) => sector.key === activeKey)
        ? sectors.filter((sector) => sector.key === activeKey)
        : sectors

    const allPoints = focusSectors.flatMap((sector) => sector.rebased)
    const minX = Math.min(...allPoints.map((point) => point.t))
    const maxX = Math.max(...allPoints.map((point) => point.t))
    const minY = Math.min(100, ...allPoints.map((point) => point.value))
    const maxY = Math.max(100, ...allPoints.map((point) => point.value))

    const yRange = Math.max(maxY - minY, 2)
    const yPadding = Math.max(yRange * 0.08, 1)

    return {
      sectors,
      xDomain: [minX, maxX] as const,
      yDomain: [Math.floor(minY - yPadding), Math.ceil(maxY + yPadding)] as const,
    }
  }, [activeKey, data, period])

  const innerWidth = WIDTH - MARGIN.left - MARGIN.right
  const innerHeight = HEIGHT - MARGIN.top - MARGIN.bottom

  const xScale = (value: number) => {
    const [minX, maxX] = prepared.xDomain
    if (maxX === minX) return MARGIN.left
    return MARGIN.left + ((value - minX) / (maxX - minX)) * innerWidth
  }

  const yScale = (value: number) => {
    const [minY, maxY] = prepared.yDomain
    if (maxY === minY) return MARGIN.top + innerHeight / 2
    return MARGIN.top + innerHeight - ((value - minY) / (maxY - minY)) * innerHeight
  }

  const yTicks = 5
  const tickValues = Array.from({ length: yTicks }, (_, i) => {
    const [minY, maxY] = prepared.yDomain
    return minY + ((maxY - minY) / (yTicks - 1)) * i
  })
  const normalizedTickValues = [...new Set([...tickValues.map((tick) => Number(tick.toFixed(2))), 100])].sort(
    (a, b) => a - b,
  )

  const xTicks = Array.from({ length: 5 }, (_, i) => {
    const [minX, maxX] = prepared.xDomain
    return minX + ((maxX - minX) / 4) * i
  })

  const formatTickDate = (value: number) =>
    new Date(value).toLocaleDateString(locale === 'es' ? 'es-CL' : 'en-US', {
      year: 'numeric',
      month: 'short',
    })

  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        <div style={{ color: '#ffcc57', fontWeight: 800, fontSize: '1rem', marginBottom: 6 }}>
          {labels.title}
        </div>
        <div style={{ color: 'rgba(255,255,255,0.72)', fontSize: '0.94rem', lineHeight: 1.6 }}>
          {labels.subtitle}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        {(['ytd', '1y', '5y', '10y', 'max'] as Period[]).map((value) => (
          <button
            key={value}
            onClick={() => setPeriod(value)}
            style={{
              background: period === value ? 'rgba(255,255,255,0.14)' : '#111214',
              color: 'white',
              border: '1px solid rgba(255,255,255,0.10)',
              borderRadius: 10,
              padding: '10px 14px',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            {labels.periods[value]}
          </button>
        ))}
      </div>

      <div ref={chartWrapRef} style={{ overflowX: 'auto', position: 'relative' }}>
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
          <rect x="0" y="0" width={WIDTH} height={HEIGHT} fill="#0b0b0b" rx="14" />

          {normalizedTickValues.map((tick) => {
            const y = yScale(tick)
            return (
              <g key={tick}>
                <line
                  x1={MARGIN.left}
                  x2={WIDTH - MARGIN.right}
                  y1={y}
                  y2={y}
                  stroke="rgba(255,255,255,0.08)"
                  strokeWidth="1"
                />
                <text
                  x={MARGIN.left - 10}
                  y={y + 4}
                  fill={Math.abs(tick - 100) < 0.001 ? 'rgba(255,204,87,0.95)' : 'rgba(255,255,255,0.6)'}
                  fontSize="11"
                  fontWeight={Math.abs(tick - 100) < 0.001 ? 700 : 400}
                  textAnchor="end"
                >
                  {tick.toFixed(0)}
                </text>
              </g>
            )
          })}

          {xTicks.map((tick) => {
            const x = xScale(tick)
            return (
              <g key={tick}>
                <line
                  x1={x}
                  x2={x}
                  y1={MARGIN.top}
                  y2={HEIGHT - MARGIN.bottom}
                  stroke="rgba(255,255,255,0.05)"
                  strokeWidth="1"
                />
                <text
                  x={x}
                  y={HEIGHT - MARGIN.bottom + 18}
                  fill="rgba(255,255,255,0.6)"
                  fontSize="11"
                  textAnchor="middle"
                >
                  {formatTickDate(tick)}
                </text>
              </g>
            )
          })}

          <line
            x1={MARGIN.left}
            x2={WIDTH - MARGIN.right}
            y1={yScale(100)}
            y2={yScale(100)}
            stroke="rgba(255,204,87,0.4)"
            strokeWidth="1.4"
            strokeDasharray="5 5"
          />
          <text
            x={WIDTH - MARGIN.right}
            y={yScale(100) - 8}
            fill="rgba(255,204,87,0.8)"
            fontSize="11"
            textAnchor="end"
          >
            {labels.baseLine}
          </text>

          {prepared.sectors.map((sector) => {
            const strokeColor = sector.key === 'total' ? '#ffffff' : sector.color
            const path = sector.rebased
              .map((point, index) => `${index === 0 ? 'M' : 'L'} ${xScale(point.t)} ${yScale(point.value)}`)
              .join(' ')

            const active = (!activeKey || activeKey === sector.key) && (!hoveredKey || hoveredKey === sector.key)

            return (
              <path
                key={sector.key}
                d={path}
                fill="none"
                stroke={strokeColor}
                strokeWidth={sector.key === 'total' ? (active ? 3 : 2) : active ? 2.4 : 1.2}
                strokeDasharray={sector.key === 'total' ? '8 5' : undefined}
                opacity={active ? 0.95 : 0.28}
                onMouseEnter={() => setHoveredKey(sector.key)}
                onMouseLeave={() => {
                  setHoveredKey(null)
                  setHoverInfo(null)
                }}
                onMouseMove={(event) => {
                  const bounds = chartWrapRef.current?.getBoundingClientRect()
                  if (!bounds || !sector.rebased.length) return

                  const relativeX = ((event.clientX - bounds.left) / bounds.width) * WIDTH
                  const clampedX = Math.max(MARGIN.left, Math.min(WIDTH - MARGIN.right, relativeX))
                  const [minX, maxX] = prepared.xDomain
                  const targetT = minX + ((clampedX - MARGIN.left) / innerWidth) * (maxX - minX)

                  let nearest = sector.rebased[0]
                  let nearestIndex = 0
                  let bestDistance = Math.abs(nearest.t - targetT)

                  for (let i = 1; i < sector.rebased.length; i += 1) {
                    const distance = Math.abs(sector.rebased[i].t - targetT)
                    if (distance < bestDistance) {
                      nearest = sector.rebased[i]
                      nearestIndex = i
                      bestDistance = distance
                    }
                  }

                  const sourcePoint = sector.series[Math.min(nearestIndex, sector.series.length - 1)]

                  setHoverInfo({
                    x: event.clientX - bounds.left + 14,
                    y: event.clientY - bounds.top + 14,
                    sector,
                    point: nearest,
                    coverage: sourcePoint?.coverage ?? 0,
                  })
                }}
              />
            )
          })}

          {prepared.sectors.slice(0, 5).map((sector) => {
            const last = sector.rebased[sector.rebased.length - 1]
            if (!last) return null
            const color = sector.key === 'total' ? '#ffffff' : sector.color
            return (
              <text
                key={`${sector.key}-label`}
                x={Math.min(WIDTH - MARGIN.right + 4, xScale(last.t) + 6)}
                y={yScale(last.value) + 4}
                fill={color}
                fontSize="11"
                fontWeight="700"
              >
                {sector.name[locale]}
              </text>
            )
          })}

          <text
            x={(MARGIN.left + WIDTH - MARGIN.right) / 2}
            y={HEIGHT - 6}
            fill="rgba(255,255,255,0.68)"
            fontSize="12"
            textAnchor="middle"
          >
            {labels.xAxis}
          </text>
          <text
            x={16}
            y={(MARGIN.top + HEIGHT - MARGIN.bottom) / 2}
            fill="rgba(255,255,255,0.68)"
            fontSize="12"
            textAnchor="middle"
            transform={`rotate(-90 16 ${(MARGIN.top + HEIGHT - MARGIN.bottom) / 2})`}
          >
            {labels.yAxis}
          </text>
        </svg>

        {hoverInfo ? (
          <div
            style={{
              position: 'absolute',
              left: hoverInfo.x,
              top: hoverInfo.y,
              pointerEvents: 'none',
              background: 'rgba(13,15,18,0.96)',
              border: '1px solid rgba(255,255,255,0.10)',
              borderRadius: 10,
              padding: '10px 12px',
              minWidth: 190,
              boxShadow: '0 12px 28px rgba(0,0,0,0.28)',
              zIndex: 30,
            }}
          >
            <div style={{ color: 'white', fontWeight: 800, marginBottom: 6 }}>
              {hoverInfo.sector.name[locale]}
            </div>
            <div style={{ color: 'rgba(255,255,255,0.72)', fontSize: 13, lineHeight: 1.6 }}>
              {labels.hoverDate}:{' '}
              {new Date(hoverInfo.point.date).toLocaleDateString(locale === 'es' ? 'es-CL' : 'en-US')}
            </div>
            <div style={{ color: 'rgba(255,255,255,0.72)', fontSize: 13, lineHeight: 1.6 }}>
              {labels.hoverValue}: {hoverInfo.point.value.toFixed(2)}
            </div>
            <div style={{ color: 'rgba(255,255,255,0.72)', fontSize: 13, lineHeight: 1.6 }}>
              {labels.hoverCoverage}: {(hoverInfo.coverage * 100).toFixed(1)}%
            </div>
          </div>
        ) : null}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginTop: 14 }}>
        {prepared.sectors.map((sector) => {
          const active = (!activeKey || activeKey === sector.key) && (!hoveredKey || hoveredKey === sector.key)
          const dotColor = sector.key === 'total' ? '#ffffff' : sector.color
          return (
            <button
              key={sector.key}
              onMouseEnter={() => setActiveKey(sector.key)}
              onMouseLeave={() => setActiveKey(null)}
              onClick={() => setActiveKey((current) => (current === sector.key ? null : sector.key))}
              style={{
                textAlign: 'left',
                background: active ? 'rgba(255,255,255,0.08)' : '#111214',
                border: sector.key === 'total'
                  ? '1px solid rgba(255,255,255,0.22)'
                  : '1px solid rgba(255,255,255,0.08)',
                borderRadius: 12,
                padding: '10px 12px',
                cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 999,
                    background: dotColor,
                    display: 'inline-block',
                    border: sector.key === 'total' ? '1px solid rgba(0,0,0,0.35)' : 'none',
                  }}
                />
                <span style={{ color: 'white', fontSize: 13, fontWeight: 700 }}>{sector.name[locale]}</span>
              </div>
              <div style={{ color: 'rgba(255,255,255,0.64)', fontSize: 11 }}>
                {labels.latest}: {sector.latest.toFixed(1)}
              </div>
            </button>
          )
        })}
      </div>

    </div>
  )
}
