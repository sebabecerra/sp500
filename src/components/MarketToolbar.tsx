'use client'

import type { CSSProperties } from 'react'

type Props = {
  search: string
  onSearchChange: (value: string) => void
  selectedSector: string | null
  onClearSector: () => void
}

export default function MarketToolbar({
  search,
  onSearchChange,
  selectedSector,
  onClearSector,
}: Props) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(260px, 420px) auto',
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
