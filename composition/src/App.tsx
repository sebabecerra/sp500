import { useEffect, useRef, useState } from 'react'
import { toBlob } from 'html-to-image'
import BubbleChart from './components/BubbleChart'
import MarimekkoChart from './components/MarimekkoChart'
import TreemapChart from './components/TreemapChart'
import type { Locale, Payload } from './types'

const copy = {
  en: {
    title: 'The Entire S&P 500',
    downloadPng: 'Download PNG',
    source: 'Source',
    note: 'Note',
    bubbles: 'Bubbles',
    treemap: 'Treemap',
    marimekko: 'Marimekko',
    loading: 'Loading chart...',
    error: 'Could not load generated data.',
    generated: 'Updated',
  },
  es: {
    title: 'Todo el S&P 500',
    downloadPng: 'Descargar PNG',
    source: 'Fuente',
    note: 'Nota',
    bubbles: 'Burbujas',
    treemap: 'Treemap',
    marimekko: 'Marimekko',
    loading: 'Cargando gráfico...',
    error: 'No se pudo cargar la data generada.',
    generated: 'Actualizado',
  },
} as const

function withBaseUrl(path: string) {
  const base = import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL}/`
  return `${base}${path.replace(/^\//, '')}`
}

function formatDate(date: string, locale: Locale) {
  return new Date(date).toLocaleString(locale === 'es' ? 'es-CL' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function App() {
  const [locale, setLocale] = useState<Locale>('en')
  const [view, setView] = useState<'bubbles' | 'treemap' | 'marimekko'>('marimekko')
  const [data, setData] = useState<Payload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const cardRef = useRef<HTMLElement | null>(null)
  const labels = copy[locale]

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch(withBaseUrl('data/sp500-bubbles.json'))
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const payload = (await response.json()) as Payload
        setData(payload)
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      }
    }
    void load()
  }, [])

  const handleDownload = async () => {
    if (!cardRef.current) return
    const blob = await toBlob(cardRef.current, {
      cacheBust: true,
      pixelRatio: 2,
      backgroundColor: '#141110',
    })
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'sp500-bubbles.png'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <main className="app-shell">
      <section className="panel chart-card" ref={cardRef}>
        <div className="topbar">
          <div>
            <h1>{data ? data.title[locale] : labels.title}</h1>
            <p>{data ? data.subtitle[locale] : labels.loading}</p>
          </div>
          <div className="controls">
            <button className={`button small ${view === 'bubbles' ? 'active' : ''}`} onClick={() => setView('bubbles')}>{labels.bubbles}</button>
            <button className={`button small ${view === 'treemap' ? 'active' : ''}`} onClick={() => setView('treemap')}>{labels.treemap}</button>
            <button className={`button small ${view === 'marimekko' ? 'active' : ''}`} onClick={() => setView('marimekko')}>{labels.marimekko}</button>
            <button className="button" onClick={() => void handleDownload()}>{labels.downloadPng}</button>
            <button className={`button small ${locale === 'es' ? 'active' : ''}`} onClick={() => setLocale('es')}>ES</button>
            <button className={`button small ${locale === 'en' ? 'active' : ''}`} onClick={() => setLocale('en')}>EN</button>
          </div>
        </div>

        {error ? <div className="state">{labels.error} {error}</div> : null}
        {!data && !error ? <div className="state">{labels.loading}</div> : null}

        {data ? (
          <>
            {view === 'bubbles' ? (
              <BubbleChart sectors={data.sectors} locale={locale} totalMarketCap={data.totalMarketCap} />
            ) : view === 'marimekko' ? (
              <MarimekkoChart sectors={data.sectors} locale={locale} />
            ) : (
              <TreemapChart sectors={data.sectors} locale={locale} />
            )}
            <div className="footer-note">
              <div><strong>{labels.note}:</strong> {data.note[locale]}</div>
              <div><strong>{labels.source}:</strong> <a href={data.source.url} target="_blank" rel="noreferrer">{data.source.name}</a></div>
              <div><strong>{labels.generated}:</strong> {formatDate(data.generatedAt, locale)}</div>
            </div>
          </>
        ) : null}
      </section>
    </main>
  )
}
