'use client'

import type { CSSProperties } from 'react'
import type { Locale, ViewMode } from '../types'

type Props = {
  locale: Locale
  search: string
  onSearchChange: (value: string) => void
  selectedSector: string | null
  onClearSector: () => void
  viewMode: ViewMode
  availableModes: ViewMode[]
  onViewModeChange: (mode: ViewMode) => void
}

export default function MarketToolbar({
  locale,
  search,
  onSearchChange,
  selectedSector,
  onClearSector,
  viewMode,
  availableModes,
  onViewModeChange,
}: Props) {
  const modeLabels: Record<Locale, Record<ViewMode, string>> = {
    en: {
      weight: 'Weight',
      '1d': '1D',
      ytd: 'YTD',
      '1y': '1Y',
      '5y': '5Y',
      '10y': '10Y',
    },
    es: {
      weight: 'Peso',
      '1d': '1D',
      ytd: 'YTD',
      '1y': '1A',
      '5y': '5A',
      '10y': '10A',
    },
  }

  const modes: ViewMode[] = ['weight', '1d', 'ytd', '1y', '5y', '10y']

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(240px, 380px) minmax(0, 1fr) auto',
        gap: 14,
        alignItems: 'center',
      }}
    >
      <input
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Search ticker or company..."
        style={{
          width: '100%',
          background: '#111214',
          color: 'white',
          border: '1px solid rgba(255,255,255,0.10)',
          borderRadius: 10,
          padding: '12px 14px',
          outline: 'none',
          fontSize: 14,
        }}
      />

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
        {modes.map((mode) => {
          const enabled = availableModes.includes(mode)
          return (
            <button
              key={mode}
              onClick={() => enabled && onViewModeChange(mode)}
              disabled={!enabled}
              style={{
                ...buttonStyle(viewMode === mode),
                opacity: enabled ? 1 : 0.38,
                cursor: enabled ? 'pointer' : 'default',
              }}
            >
              {modeLabels[locale][mode]}
            </button>
          )
        })}
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        <button
          onClick={onClearSector}
          disabled={!selectedSector}
          style={{
            ...buttonStyle(Boolean(selectedSector)),
            opacity: selectedSector ? 1 : 0.45,
            cursor: selectedSector ? 'pointer' : 'default',
          }}
        >
          Reset zoom
        </button>
      </div>
    </div>
  )
}

function buttonStyle(active: boolean): CSSProperties {
  return {
    background: active ? 'rgba(255,255,255,0.14)' : '#111214',
    color: 'white',
    border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: 10,
    padding: '10px 14px',
    fontSize: 13,
    cursor: 'pointer',
    transition: 'all 160ms ease',
  }
}
