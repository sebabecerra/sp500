import type { AnnualReturnsPayload } from "../../types";

function bucketColor(bucket: number) {
  if (bucket <= -40) return "#a51d2d";
  if (bucket <= -30) return "#cf3a2f";
  if (bucket <= -20) return "#ff5a36";
  if (bucket <= -10) return "#f39c4a";
  if (bucket <= 0) return "#cfcb5d";
  if (bucket <= 10) return "#8fd07a";
  if (bucket <= 20) return "#54d49a";
  if (bucket <= 30) return "#40c8c8";
  if (bucket <= 40) return "#2b8fd8";
  return "#2563b8";
}

export function HistogramChart({ data }: { data: AnnualReturnsPayload }) {
  const columns = data.columns;
  const maxRows = Math.max(...columns.map((column) => column.items.length), 1);
  const cellW = 84;
  const cellH = 38;
  const gap = 4;
  const leftPad = 60;
  const rightPad = 36;
  const topPad = 80;
  const bottomPad = 90;
  const chartW = columns.length * cellW + (columns.length - 1) * gap;
  const chartH = maxRows * cellH + (maxRows - 1) * gap;
  const svgWidth = leftPad + chartW + rightPad;
  const svgHeight = topPad + chartH + bottomPad;

  return (
    <div style={{ background: "#000", color: "#fff", minHeight: "100vh", padding: "28px 28px 40px" }}>
      <div style={{ width: "fit-content", margin: "0 auto" }}>
        <div style={{ color: "#ff5b32", fontSize: 42, fontWeight: 700, lineHeight: 1, marginBottom: 8 }}>
          151 Years of S&amp;P 500 Returns
        </div>
        <div
          style={{
            color: "#efe5bf",
            fontSize: 18,
            fontFamily: "Georgia, 'Times New Roman', serif",
            marginBottom: 20,
          }}
        >
          Distribution of annual returns by 10-point buckets through {data.latestYear}
        </div>

        <svg width={svgWidth} height={svgHeight} viewBox={`0 0 ${svgWidth} ${svgHeight}`} role="img" aria-label="S&P 500 annual return histogram">
          <rect width={svgWidth} height={svgHeight} fill="#000" />

          {columns.map((column, columnIndex) => {
            const x = leftPad + columnIndex * (cellW + gap);
            const stackTop = topPad + (maxRows - column.items.length) * (cellH + gap);

            return column.items.map((item, rowIndex) => {
              const y = stackTop + rowIndex * (cellH + gap);
              const highlighted = item.year === data.latestYear;
              return (
                <g key={`${column.bucket}-${item.year}`}>
                  <rect
                    x={x}
                    y={y}
                    width={cellW}
                    height={cellH}
                    rx={7}
                    fill={highlighted ? "#111" : bucketColor(column.bucket)}
                    stroke={highlighted ? "#f5f0d6" : "rgba(0,0,0,0.18)"}
                    strokeWidth={highlighted ? 2.5 : 1}
                  />
                  <text
                    x={x + cellW / 2}
                    y={y + cellH / 2 + 5}
                    textAnchor="middle"
                    fontSize={highlighted ? 17 : 16}
                    fontWeight={800}
                    fill={highlighted ? "#f5f0d6" : "#111"}
                    fontFamily="'Avenir Next', 'Trebuchet MS', sans-serif"
                  >
                    {item.year}
                  </text>
                </g>
              );
            });
          })}

          {columns.map((column, columnIndex) => {
            const x = leftPad + columnIndex * (cellW + gap) + cellW / 2;
            return (
              <text
                key={`tick-${column.bucket}`}
                x={x}
                y={svgHeight - 26}
                textAnchor="middle"
                fill="#efe5bf"
                fontSize={18}
                fontFamily="Georgia, 'Times New Roman', serif"
              >
                {column.bucket}%
              </text>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
