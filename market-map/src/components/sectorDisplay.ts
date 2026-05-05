import type { Bubble, Locale, Sector } from '../types'

export function condensedSectorCompanies(sector: Sector, locale: Locale): Bubble[] {
  const threshold = sector.weight * 0.5
  const companies = [...sector.top].sort((a, b) => b.weight - a.weight)

  let cumulative = 0
  const featured: Bubble[] = []

  for (const company of companies) {
    if (cumulative < threshold || featured.length === 0) {
      featured.push(company)
      cumulative += company.weight
    } else {
      break
    }
  }

  const residual = Math.max(0, sector.weight - cumulative)
  if (residual > 0.001) {
    featured.push({
      name: locale === 'es' ? 'Otros' : 'Others',
      label: locale === 'es' ? 'Otros' : 'Others',
      weight: Number(residual.toFixed(1)),
    })
  }

  return featured
}
