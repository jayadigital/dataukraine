import type { SeriesPoint } from "../types";

type Props = {
  data: SeriesPoint[];
  color?: string;
};

export function MiniChart({ data, color = "#0057b8" }: Props) {
  if (!data.length) {
    return <div className="mini-chart-empty" aria-hidden="true" />;
  }
  const width = 300;
  const height = 72;
  if (data.length === 1) {
    const point = data[0];
    return (
      <svg
        className="mini-chart mini-chart-single"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <line x1="0" x2={width} y1="58" y2="58" className="mini-chart-baseline" />
        <line x1={width / 2} x2={width / 2} y1="58" y2="22" stroke={color} strokeWidth="3" />
        <circle cx={width / 2} cy="22" r="5" fill={color}>
          <title>{`${point.label ?? point.date}: ${point.value}`}</title>
        </circle>
      </svg>
    );
  }
  const values = data.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const spread = max - min || Math.max(Math.abs(max) * 0.1, 1);
  const x = (index: number) => (index / (data.length - 1)) * width;
  const y = (value: number) =>
    8 + ((max - value) / spread) * (height - 16);
  const line = data
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"} ${x(index).toFixed(2)} ${y(point.value).toFixed(2)}`,
    )
    .join(" ");
  const area = `${line} L ${width} ${height} L 0 ${height} Z`;

  return (
    <svg
      className="mini-chart"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path d={area} fill={color} opacity={0.08} />
      <path d={line} fill="none" stroke={color} strokeWidth={2.5} />
    </svg>
  );
}
