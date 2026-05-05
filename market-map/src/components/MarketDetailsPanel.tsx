'use client'

import type { CSSProperties } from 'react'
import type { Bubble } from '../types'

type Props = {
  company: Bubble | null
  sectorName?: string | null
}

export default function MarketDetailsPanel({ company, sectorName }: Props) {
  return (
    <aside
      style={{
        background: '#0d0f12',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 14,
        padding: 12,
        minHeight: 0,
      }}
    >
      {!company ? (
        <div>
          <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.9)', fontWeight: 700 }}>
            Details
          </div>
          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13, lineHeight: 1.5 }}>
            Hover or click a company tile to inspect ticker, industry, and index participation.
          </p>
        </div>
      ) : (
        <div>
          <div
            style={{
              fontSize: 28,
              fontWeight: 800,
              color: 'white',
              marginBottom: 4,
            }}
          >
            {company.ticker || company.label || company.name}
          </div>

          <div
            style={{
              color: 'rgba(255,255,255,0.82)',
              fontSize: 14,
              fontWeight: 600,
              marginBottom: 12,
            }}
          >
            {company.name}
          </div>

          <div style={rowStyle}>
            <span style={labelStyle}>Weight</span>
            <span style={plainValueStyle}>{company.weight.toFixed(2)}%</span>
          </div>

          <div style={rowStyle}>
            <span style={labelStyle}>Industry</span>
            <span style={plainValueStyle}>{company.industry ?? '—'}</span>
          </div>

          <div style={rowStyle}>
            <span style={labelStyle}>Sector</span>
            <span style={plainValueStyle}>{sectorName ?? '—'}</span>
          </div>
        </div>
      )}
    </aside>
  )
}

const rowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 10,
  marginBottom: 10,
  paddingBottom: 10,
  borderBottom: '1px solid rgba(255,255,255,0.06)',
}

const labelStyle: CSSProperties = {
  color: 'rgba(255,255,255,0.55)',
  fontSize: 13,
}

const plainValueStyle: CSSProperties = {
  color: 'white',
  fontSize: 13,
  textAlign: 'right',
}
