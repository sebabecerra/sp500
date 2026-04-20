export type Locale = 'en' | 'es'
export type ViewMode = 'weight' | '1d' | 'ytd' | '1y' | '5y' | '10y'

export type Bubble = {
  name: string
  weight: number
  label?: string
  industry?: string
  ticker?: string
  change?: number
  return1d?: number
  returnYtd?: number
  return1y?: number
  return5y?: number
  return10y?: number
}

export type Sector = {
  key: string
  name: { en: string; es: string }
  weight: number
  companies: number
  color: string
  x: number
  y: number
  r: number
  top: Bubble[]
  others?: Bubble[]
}

export type Payload = {
  generatedAt: string
  title: { en: string; es: string }
  subtitle: { en: string; es: string }
  note: { en: string; es: string }
  source: { name: string; url: string }
  totalMarketCap: string
  availableModes?: ViewMode[]
  sectors: Sector[]
}
