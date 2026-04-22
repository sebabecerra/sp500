import type { AnnualReturnsPayload } from "../../types";

function roundDown(value: number, step: number) {
  return Math.floor(value / step) * step;
}

function roundUp(value: number, step: number) {
  return Math.ceil(value / step) * step;
}

function quantile(values: number[], q: number) {
  if (values.length === 0) return 0;
  const sorted = values.slice().sort((a, b) => a - b);
  const index = (sorted.length - 1) * q;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  const weight = index - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

export function IndexForecastChart({ data }: { data: AnnualReturnsPayload }) {
  const chart = data.indexForecastChart;
  if (!chart) return null;
  const actual = chart.actualSeries;
  const backtest = chart.backtestSeries;
  const values = [...actual.map((point) => point.level), ...backtest.map((point) => point.forecastLevel), chart.latestForecast?.forecastLevel ?? 0];
  const minY = roundDown(Math.min(...values), 500);
  const maxY = roundUp(Math.max(...values), 500);
  const plotWidth = 1180;
  const plotHeight = 620;
  const inset = { top: 34, right: 32, bottom: 58, left: 86 };
  const innerWidth = plotWidth - inset.left - inset.right;
  const innerHeight = plotHeight - inset.top - inset.bottom;
  const minTime = new Date(actual[0]?.date ?? "2017-01-01").getTime();
  const latestTargetDate = chart.latestForecast?.targetDate ?? actual.at(-1)?.date ?? "2025-12-31";
  const maxTime = new Date(latestTargetDate).getTime();
  const scaleX = (date: string) => inset.left + ((new Date(date).getTime() - minTime) / (maxTime - minTime || 1)) * innerWidth;
  const scaleY = (value: number) => inset.top + innerHeight - ((value - minY) / (maxY - minY || 1)) * innerHeight;
  const yearTicks = [];
  for (let year = 2017; year <= 2026; year += 1) yearTicks.push(`${year}-01-01`);
  const yTicks = [];
  for (let tick = minY; tick <= maxY; tick += 500) yTicks.push(tick);
  const actualPath = actual
    .map((point, index) => `${index === 0 ? "M" : "L"} ${scaleX(point.date).toFixed(2)} ${scaleY(point.level).toFixed(2)}`)
    .join(" ");
  const latestForecast = chart.latestForecast;
  const errorPcts = backtest
    .map((point) => ((point.targetLevel - point.forecastLevel) / point.forecastLevel) * 100)
    .filter((value) => Number.isFinite(value));
  const fan = latestForecast
    ? {
        low80: latestForecast.forecastLevel * (1 + quantile(errorPcts, 0.1) / 100),
        high80: latestForecast.forecastLevel * (1 + quantile(errorPcts, 0.9) / 100),
        low50: latestForecast.forecastLevel * (1 + quantile(errorPcts, 0.25) / 100),
        high50: latestForecast.forecastLevel * (1 + quantile(errorPcts, 0.75) / 100),
      }
    : null;

  return (
    <div style={{ background: "#000", color: "#fff", minHeight: "100vh", padding: "28px 30px 42px" }}>
      <div style={{ width: "fit-content", margin: "0 auto" }}>
        <div style={{ color: "#ff5b32", fontSize: 42, fontWeight: 700, lineHeight: 1, marginBottom: 8 }}>
          S&amp;P 500 Index Forecasts
        </div>
        <div style={{ color: "#efe5bf", fontSize: 18, fontFamily: "Georgia, 'Times New Roman', serif", marginBottom: 6 }}>
          Daily S&amp;P 500 index and daily one-year-ahead forecasts from daily index + daily VIX
        </div>
        <div style={{ color: "#efe5bf", fontSize: 15, fontFamily: "Georgia, 'Times New Roman', serif", marginBottom: 16, opacity: 0.9 }}>
          Horizon: {chart.horizonTradingDays} trading days | average level forecast error: {chart.averageAbsError?.toFixed(1)}%
        </div>

        <svg width={plotWidth} height={plotHeight} viewBox={`0 0 ${plotWidth} ${plotHeight}`}>
          <rect width={plotWidth} height={plotHeight} fill="#000" />
          <rect x={inset.left} y={inset.top} width={innerWidth} height={innerHeight} fill="#050505" stroke="rgba(255,255,255,0.3)" strokeWidth={1.5} />

          {yearTicks.map((date) => {
            const x = scaleX(date);
            const year = date.slice(0, 4);
            return (
              <g key={date}>
                <line x1={x} x2={x} y1={inset.top} y2={inset.top + innerHeight} stroke="rgba(255,255,255,0.10)" strokeWidth={1} />
                <text x={x} y={plotHeight - 18} fill="#efe5bf" fontSize={16} fontFamily="Georgia, 'Times New Roman', serif" textAnchor="middle">
                  {year}
                </text>
              </g>
            );
          })}

          {yTicks.map((tick) => {
            const y = scaleY(tick);
            return (
              <g key={tick}>
                <line x1={inset.left} x2={inset.left + innerWidth} y1={y} y2={y} stroke="rgba(255,255,255,0.10)" strokeWidth={1} />
                <text x={inset.left - 16} y={y + 5} fill="#efe5bf" fontSize={16} fontFamily="Georgia, 'Times New Roman', serif" textAnchor="end">
                  {tick.toLocaleString("en-US")}
                </text>
              </g>
            );
          })}

          {backtest.length > 1 && (
            <path
              d={backtest.map((point, index) => `${index === 0 ? "M" : "L"} ${scaleX(point.targetDate).toFixed(2)} ${scaleY(point.forecastLevel).toFixed(2)}`).join(" ")}
              fill="none"
              stroke="#6ea8ff"
              strokeWidth={2}
              strokeDasharray="7 5"
              opacity={0.9}
            />
          )}

          <path d={actualPath} fill="none" stroke="#2f62ff" strokeWidth={2.8} />
          {actual.filter((_, index) => index % 22 === 0).map((point) => (
            <circle key={point.date} cx={scaleX(point.date)} cy={scaleY(point.level)} r={2.2} fill="#2f62ff" />
          ))}

          {latestForecast && (
            <g>
              {fan && (
                <>
                  <polygon
                    points={[
                      `${scaleX(latestForecast.issueDate)},${scaleY(latestForecast.issueLevel)}`,
                      `${scaleX(latestForecast.targetDate)},${scaleY(fan.high80)}`,
                      `${scaleX(latestForecast.targetDate)},${scaleY(fan.low80)}`,
                    ].join(" ")}
                    fill="rgba(182,212,255,0.14)"
                  />
                  <polygon
                    points={[
                      `${scaleX(latestForecast.issueDate)},${scaleY(latestForecast.issueLevel)}`,
                      `${scaleX(latestForecast.targetDate)},${scaleY(fan.high50)}`,
                      `${scaleX(latestForecast.targetDate)},${scaleY(fan.low50)}`,
                    ].join(" ")}
                    fill="rgba(182,212,255,0.26)"
                  />
                </>
              )}
              <path
                d={`M ${scaleX(latestForecast.issueDate).toFixed(2)} ${scaleY(latestForecast.issueLevel).toFixed(2)} L ${scaleX(latestForecast.targetDate).toFixed(2)} ${scaleY(latestForecast.forecastLevel).toFixed(2)}`}
                fill="none"
                stroke="#b6d4ff"
                strokeWidth={2.8}
                strokeDasharray="8 6"
              />
              <circle cx={scaleX(latestForecast.targetDate)} cy={scaleY(latestForecast.forecastLevel)} r={5.5} fill="#000" stroke="#b6d4ff" strokeWidth={2.5} />
              <text x={scaleX(latestForecast.targetDate) - 8} y={scaleY(latestForecast.forecastLevel) - 12} fill="#efe5bf" fontSize={16} fontWeight={700} textAnchor="end">
                Latest daily forecast {latestForecast.forecastLevel.toLocaleString("en-US", { maximumFractionDigits: 0 })}
              </text>
              <text x={scaleX(latestForecast.targetDate) - 8} y={scaleY(latestForecast.forecastLevel) + 18} fill="rgba(239,229,191,0.82)" fontSize={13} textAnchor="end">
                50% / 80% fan from historical daily errors
              </text>
            </g>
          )}
        </svg>
      </div>
    </div>
  );
}
