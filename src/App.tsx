import { useEffect, useRef, useState, type ReactNode } from 'react'
import { toBlob } from 'html-to-image'
import MarketMapPro from './components/MarketMapPro'
import SectorReturnsChart from './components/SectorReturnsChart'
import type { Locale, Payload, SectorReturnsPayload, ViewMode } from './types'

type ReturnMode = Exclude<ViewMode, 'weight'>

function mathFormula(kind: 'index' | 'weight' | 'return'): ReactNode {
  if (kind === 'index') {
    return (
      <>
        <span className="math-var">Index</span>
        <sub>t</sub>
        {' = '}
        <span className="math-frac">
          <span className="math-num">
            ∑
            <span className="math-var">P</span>
            <sub>i,t</sub>
            {' × '}
            <span className="math-var">Shares</span>
            <sup>float</sup>
            <sub>i,t</sub>
          </span>
          <span className="math-den">
            <span className="math-var">Divisor</span>
            <sub>t</sub>
          </span>
        </span>
      </>
    )
  }

  if (kind === 'weight') {
    return (
      <>
        <span className="math-var">w</span>
        <sub>i</sub>
        {' = '}
        <span className="math-frac">
          <span className="math-num">
            <span className="math-var">marketCap</span>
            <sub>i</sub>
          </span>
          <span className="math-den">
            ∑
            <span className="math-var">marketCap</span>
            <sub>j</sub>
          </span>
        </span>
      </>
    )
  }

  return (
    <>
      <span className="math-var">R</span>
      <sup>(h)</sup>
      <sub>i,t</sub>
      {' = '}
      <span className="math-frac">
        <span className="math-num">
          <span className="math-var">price</span>
          <sub>i,t</sub>
        </span>
        <span className="math-den">
          <span className="math-var">price</span>
          <sub>i,t-h</sub>
        </span>
      </span>
      {' − 1'}
    </>
  )
}

const copy = {
  en: {
    fallbackTitle: 'What Does the S&P 500 Really Tell You?',
    byline: 'by Sebastian Becerra',
    introParagraph:
      'The S&P 500 is one of the most widely used equity indices in the world and serves as the main benchmark for tracking the U.S. stock market. In broad terms, it groups 500 large companies listed on exchanges such as the NYSE and Nasdaq, and its evolution is often interpreted as a proxy for overall market performance.',
    downloadPng: 'Download PNG',
    source: 'Source',
    note: 'Note',
    loading: 'Loading chart...',
    error: 'Could not load generated data.',
    updated: 'Updated',
    quickGuideTitle: 'How to read this chart',
    returnsGuideTitle: 'How to read the returns map',
    quickGuideItems: [
      'Box size shows each company’s current participation in the S&P 500.',
      'All percentages shown for both companies and sectors are shares of the total index, not shares of each sector.',
      'Sectors and industries group firms inside the index structure.',
      'This first chart is the composition view, so box size is the main signal.',
    ],
    returnsGuideItems: [
      'Box size still reflects each company’s weight in the full index.',
      'Color now reflects return: green is positive, red is negative, and darker tones are closer to zero.',
      'Use 1D, YTD, 1Y, 5Y, and 10Y to switch the return horizon without changing company size.',
    ],
    sectorSeriesTitle: 'Sector Return Time Series: Methodology and Interpretation',
    sectorSeriesParagraphs: [
      'The sector chart answers a different question than the treemap. Instead of showing the cross-section of the index at one point in time, it follows the path of each sector through time. Each line represents a chained return series built from the companies that currently belong to that sector in the public replica dataset.',
      'The daily sector return is computed as a weighted average of daily constituent returns, using the current company weights available in the project data. Those daily sector returns are then chained into an index-like series and rebased to 100 at the start of the selected window. That means the y-axis is not a raw percent scale. It is a normalized index level whose starting point is always 100 for the visible period.',
      'This also means the chart is designed for comparison of paths rather than direct comparison with an official S&P sector total return series. The methodology is transparent and reproducible, but it uses the current constituent set and current weights as the analytical base.',
    ],
    sectorSeriesFormulaTitle: 'Sector Return Formula',
    sectorSeriesFormulaNote:
      'The first expression computes the daily sector return as the weighted average of daily company returns inside that sector. The second expression chains those daily returns and rebases the visible window to 100 at its starting date.',
    sectorSeriesXAxisNote:
      'The x-axis is calendar time. The y-axis is a rebased sector index level, so 100 always marks the beginning of the selected window.',
    leadTitle: 'The S&P 500 Is Not 500 Equal Stocks',
    leadParagraphs: [
      'The S&P 500 is a market-cap-weighted index. That means the biggest companies carry the biggest influence. Apple, Microsoft, Nvidia, Amazon, and other mega-caps occupy far more of the index than smaller constituents, so a move in a handful of giant firms can drive a large share of the benchmark.',
      'This market map makes that concentration visible immediately. Each rectangle is sized by current participation in the index, so the chart is not just a list of companies. It is a visual statement about where weight, influence, and concentration sit inside the S&P 500 today.',
    ],
    articleTitle: 'S&P 500 Market Map: Structure, Data, and Project Logic',
    articleDeck:
      'The S&P 500 is usually shown as a single time series, but that representation hides its internal structure. This project starts from that limitation and proposes a different lens: the index as a weighted system of companies with unequal size, influence, and performance.',
    sections: [
      {
        title: 'What Makes This Market Map Different',
        paragraphs: [
          'That conventional reading is incomplete. The S&P 500 is usually represented as a single time series, but that view hides its internal structure. In practice, the index is not a simple average of companies. It is an aggregation in which each firm carries a different weight. This project starts from that limitation and proposes another lens: the index as a system of companies with unequal relevance rather than a single aggregate indicator.',
          'The reason for that heterogeneity is that the S&P 500 is market-cap weighted. The largest companies therefore exert disproportionate influence on the index. Firms such as Apple, Microsoft, Nvidia, and Amazon account for a significant share of the benchmark, so moves in a small set of mega-caps can explain a large part of its overall behavior.',
          'From that perspective, the S&P 500 cannot be read as 500 equal stocks. It is a highly concentrated structure in which each company’s relative weight determines its contribution to the benchmark. Ignoring that feature can lead to misleading interpretations of what is actually happening inside the market.',
          'This market map is designed to make that structure visible. Through a hierarchical representation, each company appears as a rectangle whose size is proportional to its participation in the index. The chart is therefore more than a list of firms: it shows where weight is concentrated, how it is distributed across sectors, and which companies dominate the S&P 500 at a given moment.',
          'In that sense, the graphic changes the way the index is observed: instead of a single aggregate number, it becomes a structure in which concentration, heterogeneity, and unequal influence coexist.',
        ],
      },
      {
        title: 'Index Construction and Weighting Logic',
        paragraphs: [
          'The official S&P 500 is a float-adjusted market-cap-weighted index. In formal terms, its value depends on the aggregate market value of its constituents, adjusted by free float and scaled by a divisor that preserves continuity across corporate actions. That means the contribution of each company is not uniform. It is proportional to its relative size inside the index.',
          'In practical terms, a small group of mega-cap firms explains a very large share of the benchmark’s total movement. Any analysis that ignores this structure risks treating the S&P 500 as a simple average, when in reality it is a highly concentrated aggregation. The project takes that concentration as its starting point.',
        ],
        formula: mathFormula('index'),
        formulaNote:
          'P_i,t is the price of company i at time t, Shares_i,t^float represents tradable float, and Divisor_t is the adjustment factor used to keep the series continuous through index changes.',
      },
      {
        title: 'Structural Representation: The Hierarchical Treemap',
        paragraphs: [
          'To make that concentration visible, the project constructs a treemap in which each company appears as a rectangle whose area is proportional to its relative participation in the index. In the implementation used here, participation is approximated with public market capitalization data and normalized as a share of the total market capitalization of the current constituent set.',
          'This point matters for interpretation: a company shown at 7.0% means 7.0% of the full S&P 500, not 7.0% of its sector. Sector labels follow the same base. A sector shown at 32.0% means that all companies inside that sector, when summed, account for roughly 32.0% of the total index.',
          'The hierarchy is organized in three levels: sectors, industries, and companies. That structure makes it possible to observe not only firm-level concentration but also how index weight is distributed across broader segments of the market. The visual goal is simple: to turn a single benchmark number into a readable structural map.',
        ],
        formula: mathFormula('weight'),
        formulaNote:
          'In the public replica, company weight is computed as its reported market capitalization divided by the total market capitalization of the current constituent universe. Sector weight is the sum of the company weights that belong to that sector, so company and sector percentages always use the same denominator: the full index.',
      },
      {
        title: 'Performance Measurement with Adjusted Returns',
        paragraphs: [
          'A second analytical layer is added on top of the weight structure: company performance. Returns are calculated with adjusted close prices so that the series are more suitable for multi-period comparison than raw closes. The notebook and app expose several horizons, including 1 day, year-to-date, 1 year, 5 years, and 10 years.',
          'These returns are then encoded with color. The size of each box stays fixed to its structural importance, while the color reflects performance. Positive values are shown in bright green, negative values in bright red, and darker tones sit closer to zero. This separation between size and color makes it possible to analyze structure and performance simultaneously.',
        ],
        formula: mathFormula('return'),
        formulaNote:
          'The horizon h changes across views: 1 day, YTD, 1 year, 5 years, and 10 years. Adjusted prices are used to incorporate splits and similar corporate actions more consistently.',
      },
      {
        title: 'Joint Interpretation: Structure Versus Performance',
        paragraphs: [
          'The main analytical contribution of the market map comes from combining those two dimensions. By holding box area constant and changing only the color scale, the visualization makes it possible to see whether index performance is broad-based or dominated by a narrow set of large firms.',
          'That creates a richer reading than the index level alone. A positive benchmark return, for example, can be driven by a handful of giant companies while much of the rest of the market remains flat or negative. In that setting, the market map reveals dispersion that a single headline number hides.',
        ],
      },
      {
        title: 'Data Pipeline and Reproducibility',
        paragraphs: [
          'The project is built on a transparent pipeline that uses public data sources. Constituent classification comes from the current S&P 500 table on Wikipedia. Market capitalization and historical prices come from Yahoo Finance via yfinance and related extraction steps. From there, the pipeline calculates normalized company weights, computes return horizons, and builds the hierarchical structure needed for the visualization.',
          'This design keeps the process reproducible and auditable without relying on proprietary vendor terminals or licensed point-in-time index files. The notebook replica and the Node application are intended to follow the same logic so that the published chart and the public methodology remain aligned.',
        ],
      },
      {
        title: 'Methodological Decisions and Limitations',
        paragraphs: [
          'A central design choice is to use the current composition of the S&P 500 throughout the historical analysis. In other words, the project does not reconstruct the exact membership of the index on every historical date. Instead, it looks backward through time using the firms that belong to the index today.',
          'That simplification makes the pipeline easier to reproduce and keeps the data structure consistent, but it also means the result should not be interpreted as a point-in-time reconstruction of index history. The chart is best understood as a tool for analyzing the current structure of the index and the historical behavior of its present constituents.',
        ],
      },
      {
        title: 'Analytical Scope of the Market Map',
        paragraphs: [
          'The value of the project lies in changing the way the index is observed. Instead of focusing only on its aggregate level, the market map decomposes the S&P 500 into its fundamental components and makes visible which firms, sectors, and industries account for the benchmark’s structure and movement.',
          'That makes it easier to ask better questions: which companies explain the index’s return, how concentrated that contribution is, and how performance is distributed across sectors and industries. The result is a more structural reading of the S&P 500, where weight and performance interact in ways that are not obvious in a single time series.',
        ],
      },
    ],
  },
  es: {
    fallbackTitle: '¿Qué te dice realmente el S&P 500?',
    byline: 'by Sebastian Becerra',
    introParagraph:
      'El S&P 500 es uno de los índices bursátiles más utilizados a nivel global y funciona como la principal referencia para seguir el mercado accionario estadounidense. En términos generales, agrupa a 500 grandes compañías que cotizan en bolsas como NYSE y Nasdaq, y su evolución suele interpretarse como un reflejo del desempeño del mercado.',
    downloadPng: 'Descargar PNG',
    source: 'Fuente',
    note: 'Nota',
    loading: 'Cargando gráfico...',
    error: 'No se pudo cargar la data generada.',
    updated: 'Actualizado',
    quickGuideTitle: 'Cómo leer este gráfico',
    returnsGuideTitle: 'Cómo leer el mapa de retornos',
    quickGuideItems: [
      'El tamaño de cada caja muestra la participación actual de la empresa dentro del S&P 500.',
      'Todos los porcentajes de empresas y sectores se expresan sobre el índice total, no sobre cada sector por separado.',
      'Sectores e industrias agrupan a las compañías dentro de la estructura del índice.',
      'Este primer gráfico es la vista de composición, así que el tamaño de las cajas es la señal principal.',
    ],
    returnsGuideItems: [
      'El tamaño de cada caja sigue mostrando el peso de la empresa dentro del índice total.',
      'El color ahora muestra retorno: verde es positivo, rojo es negativo y los tonos más oscuros quedan más cerca de cero.',
      'Usa 1D, YTD, 1Y, 5Y y 10Y para cambiar el horizonte de retorno sin cambiar el tamaño de las empresas.',
    ],
    sectorSeriesTitle: 'Serie de Tiempo de Retornos por Sector: metodología e interpretación',
    sectorSeriesParagraphs: [
      'El gráfico sectorial responde una pregunta distinta al treemap. En lugar de mostrar la foto transversal del índice en un momento puntual, sigue la trayectoria de cada sector en el tiempo. Cada línea representa una serie encadenada de retornos construida a partir de las empresas que hoy pertenecen a ese sector dentro del dataset público de réplica.',
      'El retorno diario sectorial se calcula como un promedio ponderado de los retornos diarios de sus constituyentes, usando los pesos actuales de las empresas disponibles en la data del proyecto. Luego esos retornos diarios se encadenan en una serie tipo índice y se rebasean a 100 al inicio de la ventana seleccionada. Por eso el eje vertical no es un porcentaje bruto: es un nivel normalizado cuyo punto de partida siempre es 100 dentro del tramo visible.',
      'Eso también implica que el gráfico está pensado para comparar trayectorias más que para replicar exactamente una serie oficial de total return sectorial de S&P. La metodología es transparente y reproducible, pero usa como base analítica el conjunto actual de empresas y los pesos actuales.',
    ],
    sectorSeriesFormulaTitle: 'Fórmulas del retorno sectorial',
    sectorSeriesFormulaNote:
      'La primera expresión calcula el retorno diario del sector como promedio ponderado de los retornos diarios de sus empresas. La segunda encadena esos retornos diarios y rebasea la ventana visible a 100 en la fecha inicial.',
    sectorSeriesXAxisNote:
      'El eje X es tiempo calendario. El eje Y es un nivel sectorial rebaseado, por eso el 100 siempre marca el inicio de la ventana seleccionada.',
    sections: [
      {
        title: 'Qué hace distinto a este market map',
        paragraphs: [
          'Sin embargo, esta lectura es incompleta. El S&P 500 suele representarse como una única serie de tiempo —un número que sube o baja—, pero esa forma de verlo oculta su estructura interna. En realidad, el índice no es un promedio simple de empresas, sino una agregación donde cada compañía tiene un peso distinto. Este proyecto parte de esa limitación y propone una alternativa: entender el índice como un sistema compuesto por empresas con diferente relevancia, en lugar de un indicador agregado.',
          'La razón de esta heterogeneidad es que el S&P 500 es un índice ponderado por capitalización bursátil. Esto implica que las empresas más grandes tienen una influencia desproporcionada sobre su comportamiento. Compañías como Apple, Microsoft, Nvidia o Amazon concentran una fracción significativa del índice, por lo que variaciones en este grupo reducido pueden explicar una parte importante de su dinámica total.',
          'Desde esta perspectiva, el S&P 500 no puede interpretarse como “500 acciones iguales”. Por el contrario, se trata de una estructura altamente concentrada, donde el peso relativo de cada empresa determina su impacto en el índice. Ignorar esta característica puede llevar a interpretaciones erróneas sobre lo que realmente está ocurriendo en el mercado.',
          'Este market map busca precisamente hacer visible esa estructura. A través de una representación jerárquica, cada empresa se muestra como un rectángulo cuyo tamaño es proporcional a su participación dentro del índice. De esta forma, la visualización no solo lista compañías, sino que permite observar directamente dónde se concentra el peso, cómo se distribuye entre sectores y qué empresas dominan la dinámica del S&P 500 en un momento dado.',
          'En este sentido, el gráfico transforma la forma de observar el índice: deja de ser una cifra agregada y pasa a entenderse como una estructura donde coexisten concentración, heterogeneidad y distintos niveles de influencia.',
        ],
      },
      {
        title: 'Construcción del índice y lógica de ponderación',
        paragraphs: [
          'El S&P 500 oficial es un índice ponderado por capitalización bursátil ajustada por free float. Formalmente, su valor depende de la suma del valor de mercado de sus componentes, ajustada por flotación y escalada por un divisor que mantiene la continuidad del índice frente a eventos corporativos. Eso implica que la contribución de cada empresa no es uniforme, sino proporcional a su tamaño relativo.',
          'En la práctica, un grupo pequeño de mega-caps explica una fracción muy relevante de la variación total del benchmark. Cualquier análisis que ignore esa estructura corre el riesgo de interpretar el S&P 500 como un promedio simple, cuando en realidad se trata de una agregación altamente concentrada. El proyecto toma esa concentración como punto de partida.',
        ],
        formula: mathFormula('index'),
        formulaNote:
          'P_i,t es el precio de la empresa i en el tiempo t, Shares_i,t^float representa el float transable y Divisor_t es el factor de ajuste que mantiene la continuidad del índice.',
      },
      {
        title: 'Representación estructural: el treemap jerárquico',
        paragraphs: [
          'Para hacer visible esa concentración, el proyecto construye una visualización tipo treemap en la que cada empresa aparece como un rectángulo cuya área es proporcional a su participación relativa dentro del índice. En esta implementación, esa participación se aproxima usando capitalización bursátil pública y normalizándola respecto del total del conjunto actual de constituyentes.',
          'Este punto es clave para leer bien los números: si una empresa aparece con 7.0%, ese 7.0% corresponde al S&P 500 completo, no a su sector. Lo mismo vale para los sectores. Si un sector aparece con 32.0%, eso significa que la suma de todas las empresas dentro de ese sector representa aproximadamente 32.0% del índice total.',
          'La jerarquía se organiza en tres niveles: sectores, industrias y empresas. Esa descomposición permite observar no solo la concentración a nivel de firmas individuales, sino también cómo se distribuye el peso entre distintos segmentos del mercado. El objetivo visual es transformar una sola cifra de referencia en un mapa estructural legible.',
        ],
        formula: mathFormula('weight'),
        formulaNote:
          'En la réplica pública, el peso de cada empresa se calcula como su market cap reportado dividido por la suma del market cap del universo actual de constituyentes. El peso de un sector se obtiene sumando los pesos de las empresas que lo componen. Por eso, los porcentajes de empresas y sectores usan siempre el mismo denominador: el índice completo.',
      },
      {
        title: 'Medición del desempeño: retornos ajustados',
        paragraphs: [
          'Sobre la estructura de pesos se agrega una segunda dimensión: el desempeño. Los retornos se calculan con precios ajustados, lo que permite comparaciones más consistentes entre períodos que una serie de cierres sin ajustar. El proyecto expone varios horizontes, incluyendo 1 día, acumulado del año, 1 año, 5 años y 10 años.',
          'Esos retornos se codifican mediante color. El tamaño de cada caja permanece fijo y refleja importancia estructural, mientras el color refleja desempeño. Los valores positivos aparecen en verde brillante, los negativos en rojo brillante y los tonos más oscuros quedan más cerca de cero. Esa separación entre tamaño y color permite leer simultáneamente estructura y performance.',
        ],
        formula: mathFormula('return'),
        formulaNote:
          'El horizonte h cambia según la vista: 1 día, YTD, 1 año, 5 años y 10 años. Se usan precios ajustados para incorporar splits y otros eventos corporativos con mayor consistencia.',
      },
      {
        title: 'Interpretación conjunta: estructura versus desempeño',
        paragraphs: [
          'El principal aporte analítico del market map surge de la combinación de esas dos dimensiones. Al mantener constante el área de las empresas y variar únicamente la escala de color, la visualización permite identificar si el rendimiento del índice es amplio o si está concentrado en un número reducido de firmas de gran tamaño.',
          'Eso hace posible una lectura más rica que la del nivel agregado del índice. Por ejemplo, un benchmark positivo puede estar siendo impulsado por unas pocas compañías gigantes mientras una parte importante del resto del mercado permanece plana o negativa. En ese escenario, el market map hace visible una dispersión que una sola cifra no muestra.',
        ],
      },
      {
        title: 'Pipeline de datos y reproducibilidad',
        paragraphs: [
          'El proyecto se construye sobre un pipeline transparente basado en fuentes públicas. La clasificación de constituyentes proviene de la tabla actual del S&P 500 en Wikipedia. La capitalización bursátil y la historia de precios provienen de Yahoo Finance vía yfinance y pasos de extracción relacionados. A partir de esa base, el pipeline calcula pesos relativos, construye los retornos para distintos horizontes y arma la estructura jerárquica necesaria para la visualización.',
          'Este enfoque permite mantener un proceso reproducible y auditable sin depender de terminales propietarias ni de archivos licenciados point-in-time. La idea es que el notebook de réplica y la aplicación Node sigan la misma lógica para que el gráfico publicado y la metodología pública permanezcan alineados.',
        ],
      },
      {
        title: 'Decisiones metodológicas y limitaciones',
        paragraphs: [
          'Una decisión central del proyecto es usar la composición actual del S&P 500 para todo el análisis histórico. Es decir, no se reconstruye la membresía exacta del índice en cada fecha pasada. En cambio, se mira hacia atrás usando las empresas que integran hoy el índice.',
          'Esa simplificación facilita mucho la reproducibilidad del pipeline y mantiene consistencia en la estructura de datos, pero también significa que el resultado no debe interpretarse como una reconstrucción point-in-time exacta. La visualización debe leerse más bien como una herramienta para analizar la estructura actual del índice y el comportamiento histórico de sus constituyentes presentes.',
        ],
      },
      {
        title: 'Alcance analítico del market map',
        paragraphs: [
          'El valor del proyecto radica en cambiar la forma en que se observa el índice. En lugar de enfocarse únicamente en su nivel agregado, el market map descompone el S&P 500 en sus componentes fundamentales y hace visible qué empresas, sectores e industrias explican su estructura y su movimiento.',
          'Eso permite formular preguntas mejores: qué compañías explican el rendimiento del índice, qué tan concentrado está ese rendimiento y cómo se distribuye entre sectores e industrias. El resultado es una lectura más estructural del S&P 500, donde peso y desempeño interactúan de maneras que no son evidentes en una sola serie de tiempo.',
        ],
      },
    ],
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
  const [data, setData] = useState<Payload | null>(null)
  const [sectorReturnsData, setSectorReturnsData] = useState<SectorReturnsPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [returnViewMode, setReturnViewMode] = useState<ReturnMode>('1d')
  const cardRef = useRef<HTMLElement | null>(null)
  const compositionChartRef = useRef<HTMLElement | null>(null)
  const returnsChartRef = useRef<HTMLElement | null>(null)
  const labels = copy[locale]
  const articleSectionsBeforeChart = labels.sections.slice(0, 3)
  const articleSectionsBeforeReturnsChart = labels.sections.slice(3, 4)
  const articleSectionsAfterChart = labels.sections.slice(4)

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch(withBaseUrl('data/sp500-market-map.json'))
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const payload = (await response.json()) as Payload
        setData(payload)
        const sectorReturnsResponse = await fetch(withBaseUrl('data/sp500-sector-returns.json'))
        if (sectorReturnsResponse.ok) {
          const sectorReturnsPayload = (await sectorReturnsResponse.json()) as SectorReturnsPayload
          setSectorReturnsData(sectorReturnsPayload)
        }
        const availableModes = payload.availableModes ?? ['weight']
        const availableReturnModes = availableModes.filter(
          (mode): mode is ReturnMode => mode !== 'weight',
        )
        if (availableReturnModes.length) {
          setReturnViewMode((current) => (availableReturnModes.includes(current) ? current : availableReturnModes[0]))
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      }
    }
    void load()
  }, [])

  const availableReturnModes = (data?.availableModes ?? ['weight']).filter(
    (mode): mode is ReturnMode => mode !== 'weight',
  )

  const scrollToCompositionChart = () => {
    compositionChartRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const scrollToReturnsChart = () => {
    returnsChartRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

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
    a.download = 'sp500-market-map.png'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <main className="app-shell">
      <section className="panel intro-card">
        <div className="topbar">
          <div>
            <h1>{labels.fallbackTitle}</h1>
            <div className="byline">{labels.byline}</div>
          </div>
          <div className="controls">
            <button className="button" onClick={() => void handleDownload()}>{labels.downloadPng}</button>
            <button className={`button small ${locale === 'es' ? 'active' : ''}`} onClick={() => setLocale('es')}>ES</button>
            <button className={`button small ${locale === 'en' ? 'active' : ''}`} onClick={() => setLocale('en')}>EN</button>
          </div>
        </div>

        {error ? <div className="state">{labels.error} {error}</div> : null}
        {!data && !error ? <div className="state">{labels.loading}</div> : null}
      </section>

      <section className="panel article-card">
        <p className="article-intro">{labels.introParagraph}</p>

        <div className="article-sections">
          {articleSectionsBeforeChart.map((section) => (
            <section key={section.title} className="article-section">
              <h3>{section.title}</h3>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
              {'formula' in section && section.formula ? (
                <div className="formula-block">
                  <div className="formula-expression">{section.formula}</div>
                  <div className="formula-note">{section.formulaNote}</div>
                </div>
              ) : null}
            </section>
          ))}
        </div>
      </section>

      <section
        className="panel chart-card"
        ref={(node) => {
          cardRef.current = node
          compositionChartRef.current = node
        }}
      >
        {data ? (
          <>
            <div className="quick-guide">
              <div className="quick-guide-title">{labels.quickGuideTitle}</div>
              <div className="quick-guide-items">
                {labels.quickGuideItems.map((item) => (
                  <div key={item} className="quick-guide-item">{item}</div>
                ))}
              </div>
            </div>
            <div className="chart-inner">
              <MarketMapPro
                sectors={data.sectors}
                locale={locale}
                viewMode="weight"
                availableModes={['weight']}
                onViewModeChange={() => {}}
                visibleModes={['weight']}
                modeOverrides={{
                  weight: {
                    label: locale === 'es' ? 'Retorno' : 'Return',
                    enabled: true,
                    active: false,
                    onClick: scrollToReturnsChart,
                  },
                }}
              />
            </div>
            <div className="footer-note">
              <div><strong>{labels.note}:</strong> {data.note[locale]}</div>
              <div><strong>{labels.source}:</strong> <a href={data.source.url} target="_blank" rel="noreferrer">{data.source.name}</a></div>
              <div><strong>{labels.updated}:</strong> {formatDate(data.generatedAt, locale)}</div>
            </div>
          </>
        ) : null}
      </section>

      <section className="panel article-card">
        <div className="article-sections">
          {articleSectionsBeforeReturnsChart.map((section) => (
            <section key={section.title} className="article-section">
              <h3>{section.title}</h3>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
              {'formula' in section && section.formula ? (
                <div className="formula-block">
                  <div className="formula-expression">{section.formula}</div>
                  <div className="formula-note">{section.formulaNote}</div>
                </div>
              ) : null}
            </section>
          ))}
        </div>
      </section>

      {data && availableReturnModes.length ? (
        <section className="panel chart-card" ref={returnsChartRef}>
          <div className="quick-guide">
            <div className="quick-guide-title">{labels.returnsGuideTitle}</div>
            <div className="quick-guide-items">
              {labels.returnsGuideItems.map((item) => (
                <div key={item} className="quick-guide-item">{item}</div>
              ))}
            </div>
          </div>
          <div className="chart-inner">
            <MarketMapPro
              sectors={data.sectors}
              locale={locale}
              viewMode={returnViewMode}
              availableModes={availableReturnModes}
              onViewModeChange={(mode) => {
                if (mode !== 'weight') {
                  setReturnViewMode(mode)
                }
              }}
              visibleModes={['weight', ...availableReturnModes]}
              modeOverrides={{
                weight: {
                  label: locale === 'es' ? 'Peso' : 'Weight',
                  enabled: true,
                  active: false,
                  onClick: scrollToCompositionChart,
                },
              }}
            />
          </div>
          <div className="footer-note">
            <div>
              <strong>{labels.note}:</strong>{' '}
              {locale === 'es'
                ? 'En este segundo gráfico el tamaño sigue mostrando el peso de cada empresa dentro del índice, mientras el color muestra el retorno individual para el horizonte seleccionado.'
                : 'In this second chart, box size still shows each company’s weight in the index, while color shows the individual return for the selected horizon.'}
            </div>
            <div><strong>{labels.source}:</strong> <a href={data.source.url} target="_blank" rel="noreferrer">{data.source.name}</a></div>
            <div><strong>{labels.updated}:</strong> {formatDate(data.generatedAt, locale)}</div>
          </div>
        </section>
      ) : null}

      {sectorReturnsData ? (
        <>
          <section className="panel article-card">
            <section className="article-section">
              <h3>{labels.sectorSeriesTitle}</h3>
              {labels.sectorSeriesParagraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
              <div className="formula-block">
                <div className="formula-expression">
                  <span className="math-var">r</span>
                  <sub>sector,t</sub>
                  {' = '}
                  <span className="math-frac">
                    <span className="math-num">
                      ∑
                      <span className="math-var">w</span>
                      <sub>i</sub>
                      <span className="math-var">r</span>
                      <sub>i,t</sub>
                    </span>
                    <span className="math-den">
                      ∑
                      <span className="math-var">w</span>
                      <sub>i</sub>
                    </span>
                  </span>
                  {'   ·   '}
                  <span className="math-var">Index</span>
                  <sub>sector,t</sub>
                  {' = 100 × ∏(1 + '}
                  <span className="math-var">r</span>
                  <sub>sector,τ</sub>
                  {')'}
                </div>
                <div className="formula-note">{labels.sectorSeriesFormulaNote}</div>
              </div>
              <p>{labels.sectorSeriesXAxisNote}</p>
            </section>
          </section>

          <section className="panel chart-card">
            <SectorReturnsChart data={sectorReturnsData} locale={locale} />
            <div className="footer-note">
              <div>
                <strong>{labels.note}:</strong>{' '}
                {locale === 'es'
                  ? 'La serie sectorial encadena retornos diarios ponderados de los constituyentes actuales y rebasea cada ventana a 100. No corresponde a una serie oficial point-in-time de S&P.'
                  : 'The sector series chains weighted daily returns of current constituents and rebases each window to 100. It is not an official point-in-time S&P sector return series.'}
              </div>
              <div>
                <strong>{labels.source}:</strong>{' '}
                <a href={data?.source.url ?? '#'} target="_blank" rel="noreferrer">{data?.source.name ?? sectorReturnsData.source.weights}</a>
                {' · '}
                <span>{sectorReturnsData.source.prices}</span>
              </div>
              <div><strong>{labels.updated}:</strong> {formatDate(sectorReturnsData.generatedAt, locale)}</div>
            </div>
          </section>
        </>
      ) : null}

      <section className="panel article-card">
        <div className="article-sections">
          {articleSectionsAfterChart.map((section) => (
            <section key={section.title} className="article-section">
              <h3>{section.title}</h3>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
              {'formula' in section && section.formula ? (
                <div className="formula-block">
                  <div className="formula-expression">{section.formula}</div>
                  <div className="formula-note">{section.formulaNote}</div>
                </div>
              ) : null}
            </section>
          ))}
        </div>
      </section>
    </main>
  )
}
