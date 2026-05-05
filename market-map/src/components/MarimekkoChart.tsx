import type { Locale, Sector } from '../types'
import { condensedSectorCompanies } from './sectorDisplay'

type Props = {
  sectors: Sector[]
  locale: Locale
}

const WIDTH = 1080
const HEIGHT = 1080
const PAD_X = 26
const PAD_TOP = 26
const PAD_BOTTOM = 82
const SECTOR_GAP = 8
const COMPANY_GAP = 3
const HEADER_H = 26

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`
}

function shortName(name: string) {
  return name
    .replace(/\b(Inc\.?|Corporation|Company|Group|Holdings|Technologies)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export default function MarimekkoChart({ sectors, locale }: Props) {
  const totalWeight = sectors.reduce((sum, sector) => sum + sector.weight, 0) || 1
  const usableWidth = WIDTH - PAD_X * 2
  const usableHeight = HEIGHT - PAD_TOP - PAD_BOTTOM - SECTOR_GAP * (sectors.length - 1)

  let currentY = PAD_TOP

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="bubbles-svg" role="img" aria-label="S&P 500 marimekko">
      <rect x="0" y="0" width={WIDTH} height={HEIGHT} fill="#141110" rx="18" />

      {sectors.map((sector, sectorIndex) => {
        const companies = condensedSectorCompanies(sector, locale)
        const sectorHeight =
          sectorIndex === sectors.length - 1
            ? HEIGHT - PAD_BOTTOM - currentY
            : Math.max(38, (sector.weight / totalWeight) * usableHeight)

        const bodyX = PAD_X
        const bodyY = currentY + HEADER_H
        const bodyHeight = sectorHeight - HEADER_H
        const totalCompanyWeight = companies.reduce((sum, company) => sum + company.weight, 0) || 1

        let currentX = bodyX

        const group = (
          <g key={sector.key}>
            <rect
              x={PAD_X}
              y={currentY}
              width={usableWidth}
              height={sectorHeight}
              rx="10"
              fill={sector.color}
              fillOpacity="0.12"
              stroke="rgba(255,255,255,0.18)"
            />

            <text x={PAD_X + 8} y={currentY + 14} className="mekko-sector">
              {sector.name[locale].toUpperCase()}
            </text>
            <text x={PAD_X + 8} y={currentY + 26} className="mekko-sector-count">
              {sector.companies} {locale === 'es' ? 'COMPAÑÍAS' : 'COMPANIES'}
            </text>
            <text x={PAD_X + usableWidth - 8} y={currentY + 18} textAnchor="end" className="mekko-sector-weight">
              {formatPercent(sector.weight)}
            </text>

            {companies.map((company, index) => {
              const isLast = index === companies.length - 1
              const companyWidth = isLast
                ? bodyX + usableWidth - currentX
                : Math.max(4, (company.weight / totalCompanyWeight) * usableWidth - COMPANY_GAP)

              const rect = (
                <g key={`${sector.key}-${company.name}-${index}`}>
                  <rect
                    x={currentX}
                    y={bodyY + 2}
                    width={Math.max(0, companyWidth)}
                    height={Math.max(0, bodyHeight - 4)}
                    rx="4"
                    fill={sector.color}
                    fillOpacity={index < 3 ? 0.86 : index < 8 ? 0.7 : 0.54}
                    stroke="rgba(255,255,255,0.18)"
                  />

                  {companyWidth > 86 && bodyHeight > 48 ? (
                    <>
                      <text x={currentX + 8} y={bodyY + 18} className="mekko-company">
                        {shortName(company.name)}
                      </text>
                      <text x={currentX + 8} y={bodyY + 36} className="mekko-company-weight">
                        {formatPercent(company.weight)}
                      </text>
                    </>
                  ) : companyWidth > 74 && bodyHeight > 20 ? (
                    <text x={currentX + 6} y={bodyY + 16} className="mekko-micro">
                      {formatPercent(company.weight)}
                    </text>
                  ) : null}
                </g>
              )

              currentX += companyWidth + COMPANY_GAP
              return rect
            })}
          </g>
        )

        currentY += sectorHeight + SECTOR_GAP
        return group
      })}
    </svg>
  )
}
