export type Locale = 'en' | 'es'

export type Bubble = {
  name: string
  weight: number
  label?: string
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
  sectors: Sector[]
}
