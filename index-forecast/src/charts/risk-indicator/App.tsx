import type { AnnualReturnsPayload } from "../../types";

function formatShortDate(date: string) {
  const [year, month] = date.split("-");
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${monthNames[Number(month) - 1]}-${year.slice(2)}`;
}

export function RiskIndicatorChart({ data }: { data: AnnualReturnsPayload }) {
  const indicator = data.riskIndicator;
  if (!indicator) return null;

  const series = indicator.series;
  const markers = indicator.markers;
  const plotWidth = 1200;
  const plotHeight = 620;
  const inset = { top: 36, right: 28, bottom: 56, left: 84 };
  const innerWidth = plotWidth - inset.left - inset.right;
  const innerHeight = plotHeight - inset.top - inset.bottom;

  const minScore = Math.min(...series.map((point) => point.score), indicator.complacencyThreshold, -2.5);
  const maxScore = Math.max(...series.map((point) => point.score), indicator.fearThreshold, 2.5);
  const minY = Math.floor((minScore - 0.5) * 2) / 2;
  const maxY = Math.ceil((maxScore + 0.5) * 2) / 2;
  const yTicks = [];
  for (let tick = minY; tick <= maxY; tick += 1) yTicks.push(Number(tick.toFixed(1)));

  const startTime = new Date(series[0].date).getTime();
  const endTime = new Date(series.at(-1)?.date ?? series[0].date).getTime();
  const yearTicks = Array.from({ length: 9 }, (_, index) => 2017 + index).map((year) => ({
    year,
    date: `${year}-01-01`,
  }));

  const scaleX = (date: string) => {
    const time = new Date(date).getTime();
    return inset.left + ((time - startTime) / (endTime - startTime || 1)) * innerWidth;
  };
  const scaleY = (value: number) => inset.top + innerHeight - ((value - minY) / (maxY - minY || 1)) * innerHeight;
  const linePath = series
    .map((point, index) => `${index === 0 ? "M" : "L"} ${scaleX(point.date).toFixed(2)} ${scaleY(point.score).toFixed(2)}`)
    .join(" ");
  const latest = indicator.latest;
  const visibleMarkers = markers
    .sort((a, b) => Math.abs(b.score) - Math.abs(a.score))
    .slice(0, 10)
    .sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div style={{ background: "#000", color: "#fff", minHeight: "100vh", padding: "28px 30px 40px" }}>
      <div style={{ width: "fit-content", margin: "0 auto" }}>
        <div style={{ color: "#ff5b32", fontSize: 42, fontWeight: 700, lineHeight: 1, marginBottom: 10 }}>
          S&amp;P 500 Qi Risk Indicator
        </div>
        <div style={{ color: "#efe5bf", fontSize: 18, marginBottom: 18, fontFamily: "Georgia, 'Times New Roman', serif" }}>
          VIX deviation from 50d MA, standardized by rolling 50d volatility ({formatShortDate(indicator.startDate)} - {formatShortDate(indicator.endDate)})
        </div>

        <svg width={plotWidth} height={plotHeight} viewBox={`0 0 ${plotWidth} ${plotHeight}`}>
          <rect width={plotWidth} height={plotHeight} fill="#000" />
          <rect x={inset.left} y={inset.top} width={innerWidth} height={innerHeight} fill="#050505" stroke="rgba(255,255,255,0.28)" strokeWidth={1.5} />

          {yearTicks.map((tick) => {
            const x = scaleX(tick.date);
            return (
              <g key={tick.year}>
                <line x1={x} x2={x} y1={inset.top} y2={inset.top + innerHeight} stroke="rgba(255,255,255,0.10)" strokeWidth={1} />
                <text x={x} y={plotHeight - 16} fill="#efe5bf" fontSize={16} fontFamily="Georgia, 'Times New Roman', serif" textAnchor="middle">
                  Jan-{String(tick.year).slice(2)}
                </text>
              </g>
            );
          })}

          {yTicks.map((tick) => {
            const y = scaleY(tick);
            return (
              <g key={tick}>
                <line x1={inset.left} x2={inset.left + innerWidth} y1={y} y2={y} stroke="rgba(255,255,255,0.10)" strokeWidth={1} />
                <text x={inset.left - 20} y={y + 6} fill="#efe5bf" fontSize={16} fontFamily="Georgia, 'Times New Roman', serif" textAnchor="end">
                  {tick.toFixed(0)}
                </text>
              </g>
            );
          })}

          <line x1={inset.left} x2={inset.left + innerWidth} y1={scaleY(indicator.fearThreshold)} y2={scaleY(indicator.fearThreshold)} stroke="#ff3b30" strokeWidth={2} />
          <line x1={inset.left} x2={inset.left + innerWidth} y1={scaleY(indicator.complacencyThreshold)} y2={scaleY(indicator.complacencyThreshold)} stroke="#ff3b30" strokeWidth={2} />
          <text x={inset.left + innerWidth / 2} y={scaleY(indicator.fearThreshold) - 8} fill="#ff3b30" fontSize={16} fontWeight={700} textAnchor="middle">MACRO FEAR</text>
          <text x={inset.left + innerWidth / 2} y={scaleY(indicator.complacencyThreshold) + 22} fill="#ff3b30" fontSize={16} fontWeight={700} textAnchor="middle">MACRO COMPLACENCY</text>
          <path d={linePath} fill="none" stroke="#2d6f90" strokeWidth={2.2} />

          {visibleMarkers.map((marker) => {
            const x = scaleX(marker.date);
            const y = scaleY(marker.score);
            const labelY = marker.score >= indicator.fearThreshold ? y - 36 : y + 28;
            const up = marker.score >= indicator.fearThreshold;
            return (
              <g key={marker.date}>
                <circle cx={x} cy={y} r={3.5} fill={up ? "#14c870" : "#ff453a"} />
                <line x1={x} x2={x - 14} y1={y} y2={labelY + (up ? 8 : -8)} stroke={up ? "#14c870" : "#ff453a"} strokeWidth={1.5} />
                <text x={x - 18} y={labelY} fill={up ? "#14c870" : "#ff453a"} fontSize={13} fontWeight={700} textAnchor="end">
                  {formatShortDate(marker.date)}
                </text>
              </g>
            );
          })}

          {latest && (
            <g>
              <circle cx={scaleX(latest.date)} cy={scaleY(latest.score)} r={6} fill="#000" stroke="#f5f0d6" strokeWidth={2.5} />
              <text x={scaleX(latest.date) + 12} y={scaleY(latest.score) - 10} fill="#f5f0d6" fontSize={16} fontWeight={700}>
                {formatShortDate(latest.date)}
              </text>
            </g>
          )}
        </svg>
      </div>
    </div>
  );
}
