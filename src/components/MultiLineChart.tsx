import { useState } from "react";
import type { SeriesPoint } from "../types";

export type ComparisonSeries = {
  id: string;
  label: string;
  color: string;
  data: SeriesPoint[];
};

type Props = {
  series: ComparisonSeries[];
  unit: string;
  formatter: (value: number, compact?: boolean) => string;
  locale: "uk" | "en";
};

const WIDTH = 760;
const HEIGHT = 310;

export function MultiLineChart({ series, unit, formatter, locale }: Props) {
  const [activeDate, setActiveDate] = useState<string | null>(null);
  const dates = [...new Set(series.flatMap((item) => item.data.map((point) => point.date)))].sort();
  const values = series.flatMap((item) => item.data.map((point) => point.value));
  if (dates.length < 2 || !values.length) {
    return <div className="chart-empty">{locale === "uk" ? "Недостатньо точок для порівняння" : "Not enough points to compare"}</div>;
  }
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const spread = rawMax - rawMin || Math.max(Math.abs(rawMax) * 0.1, 1);
  const min = rawMin < 0 ? rawMin - spread * 0.12 : Math.max(0, rawMin - spread * 0.12);
  const max = rawMax + spread * 0.12;
  const widestTick = Math.max(...[0, 0.25, 0.5, 0.75, 1].map((ratio) => formatter(max - (max - min) * ratio, true).length));
  const pad = { top: 22, right: 26, bottom: 44, left: Math.min(150, Math.max(84, widestTick * 7.5 + 20)) };
  const plotWidth = WIDTH - pad.left - pad.right;
  const plotHeight = HEIGHT - pad.top - pad.bottom;
  const x = (date: string) => pad.left + (dates.indexOf(date) / Math.max(dates.length - 1, 1)) * plotWidth;
  const y = (value: number) => pad.top + ((max - value) / Math.max(max - min, 1)) * plotHeight;
  const dateLabel = (date: string) => {
    const parsed = new Date(date);
    if (Number.isNaN(parsed.valueOf())) return date;
    return new Intl.DateTimeFormat(locale === "uk" ? "uk-UA" : "en-GB", {
      month: date.endsWith("12-31") ? undefined : "short",
      year: "numeric",
    }).format(parsed);
  };
  const activeValues = activeDate
    ? series.map((item) => ({ item, point: item.data.find((point) => point.date === activeDate) })).filter((entry) => entry.point)
    : [];
  const activeX = activeDate ? x(activeDate) : 0;
  const tooltipWidth = 214;
  const tooltipHeight = 34 + activeValues.length * 20;
  const tooltipX = Math.min(Math.max(activeX - tooltipWidth / 2, pad.left), WIDTH - pad.right - tooltipWidth);

  return (
    <svg className="line-chart multi-line-chart" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={`${locale === "uk" ? "Порівняння країн" : "Country comparison"}, ${unit}`}>
      {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
        const tickValue = max - (max - min) * ratio;
        const tickY = pad.top + plotHeight * ratio;
        return <g key={ratio}>
          <line x1={pad.left} x2={WIDTH - pad.right} y1={tickY} y2={tickY} className="chart-grid" />
          <text x={pad.left - 12} y={tickY + 4} textAnchor="end" className="chart-tick chart-tick-value">{formatter(tickValue, true)}</text>
        </g>;
      })}
      {series.map((item) => {
        const points = item.data.filter((point) => dates.includes(point.date)).sort((a, b) => a.date.localeCompare(b.date));
        const path = points.map((point, index) => `${index ? "L" : "M"} ${x(point.date).toFixed(2)} ${y(point.value).toFixed(2)}`).join(" ");
        return <g key={item.id}>
          <path d={path} fill="none" stroke={item.color} className="chart-line comparison-line" />
          {points.map((point) => <circle key={`${item.id}-${point.date}`} cx={x(point.date)} cy={y(point.value)} r={point.date === points.at(-1)?.date ? 4 : 2.2} fill={item.color} stroke="#fff" strokeWidth="1"><title>{item.label} · {dateLabel(point.date)}: {formatter(point.value)}</title></circle>)}
        </g>;
      })}
      {[dates[0], dates[Math.floor((dates.length - 1) / 2)], dates.at(-1)!].filter((value, index, all) => all.indexOf(value) === index).map((date, index, labels) => <text key={date} x={x(date)} y={HEIGHT - 12} textAnchor={index === 0 ? "start" : index === labels.length - 1 ? "end" : "middle"} className="chart-tick">{dateLabel(date)}</text>)}
      <text x={WIDTH - pad.right} y={pad.top + 2} textAnchor="end" className="chart-unit">{unit}</text>
      {activeDate && <g className="chart-tooltip" aria-hidden="true">
        <line x1={activeX} x2={activeX} y1={pad.top} y2={HEIGHT - pad.bottom} />
        <rect x={tooltipX} y={pad.top + 8} width={tooltipWidth} height={tooltipHeight} rx={2} />
        <text x={tooltipX + 10} y={pad.top + 28}>{dateLabel(activeDate)}</text>
        {activeValues.map(({ item, point }, index) => <text key={item.id} x={tooltipX + 10} y={pad.top + 49 + index * 20} fill={item.color}>{item.label}: {formatter(point!.value)}</text>)}
      </g>}
      <rect x={pad.left} y={pad.top} width={plotWidth} height={plotHeight} fill="transparent" className="chart-hit-area" onPointerMove={(event) => {
        const bounds = event.currentTarget.getBoundingClientRect();
        const ratio = Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width));
        setActiveDate(dates[Math.round(ratio * (dates.length - 1))]);
      }} onPointerLeave={() => setActiveDate(null)} />
    </svg>
  );
}
