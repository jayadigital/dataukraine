import { useId, useState } from "react";
import type { SeriesPoint } from "../types";

type Props = {
  data: SeriesPoint[];
  color: string;
  unit: string;
  formatter: (value: number, compact?: boolean) => string;
  view?: "line" | "area" | "column";
  locale?: "uk" | "en";
};

const WIDTH = 760;
const HEIGHT = 290;
const BASE_PAD = { top: 20, right: 26, bottom: 40, left: 84 };

export function LineChart({
  data,
  color,
  unit,
  formatter,
  view = "line",
  locale = "uk",
}: Props) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const reactId = useId();

  if (data.length < 2 && view !== "column") {
    return (
      <div className="chart-empty">
        {locale === "uk" ? "Недостатньо точок для динаміки" : "Not enough points for a trend"}
      </div>
    );
  }

  const values = data.map((point) => point.value);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const spread = rawMax - rawMin || Math.max(Math.abs(rawMax) * 0.1, 1);
  const min =
    rawMin < 0 ? rawMin - spread * 0.12 : Math.max(0, rawMin - spread * 0.12);
  const max = rawMax + spread * 0.12;
  const widestTick = Math.max(
    ...[0, 0.25, 0.5, 0.75, 1].map((ratio) =>
      formatter(max - (max - min) * ratio, true).length,
    ),
  );
  const PAD = {
    ...BASE_PAD,
    left: Math.min(150, Math.max(BASE_PAD.left, widestTick * 7.5 + 20)),
  };
  const plotWidth = WIDTH - PAD.left - PAD.right;
  const plotHeight = HEIGHT - PAD.top - PAD.bottom;
  const x = (index: number) =>
    data.length === 1
      ? PAD.left + plotWidth / 2
      : PAD.left + (index / Math.max(data.length - 1, 1)) * plotWidth;
  const y = (value: number) =>
    PAD.top + ((max - value) / Math.max(max - min, 1)) * plotHeight;
  // Keep the baseline inside the plot when every value is negative or positive.
  // Otherwise a negative one-point series would stretch its column to an
  // off-screen zero and make the chart look like a full-height bar.
  const baselineValue = rawMin < 0 && rawMax <= 0
    ? max
    : rawMin >= 0
      ? min
      : 0;
  const segments: Array<{
    points: Array<{ point: SeriesPoint; index: number }>;
    forecast: boolean;
  }> = [];
  for (const [index, point] of data.entries()) {
    const forecast = Boolean(point.forecast);
    const current = segments.at(-1);
    if (!current || point.gapBefore) {
      segments.push({ points: [{ point, index }], forecast });
      continue;
    }
    if (current.forecast !== forecast) {
      const previous = data[index - 1];
      segments.push({
        points: previous
          ? [
              { point: previous, index: index - 1 },
              { point, index },
            ]
          : [{ point, index }],
        forecast,
      });
      continue;
    }
    current.points.push({ point, index });
  }
  const paths = segments.map((segment) => {
    const line = segment.points
      .map(
        ({ point, index }, segmentIndex) =>
          `${segmentIndex === 0 ? "M" : "L"} ${x(index).toFixed(2)} ${y(point.value).toFixed(2)}`,
      )
      .join(" ");
    const first = segment.points[0];
    const last = segment.points.at(-1);
    return {
      line,
      forecast: segment.forecast,
      area:
        segment.points.length > 1 && first && last
          ? `${line} L ${x(last.index)} ${HEIGHT - PAD.bottom} L ${x(first.index)} ${HEIGHT - PAD.bottom} Z`
          : null,
    };
  });
  const labelIndexes = Array.from(
    new Set([0, Math.floor((data.length - 1) / 2), data.length - 1]),
  );
  const gradientId = `area-${reactId.replace(/[^a-zA-Z0-9]/g, "")}`;
  const hasForecast = data.some((point) => point.forecast);
  const activePoint = activeIndex === null ? null : data[activeIndex];
  const activeX = activeIndex === null ? 0 : x(activeIndex);
  const tooltipX = Math.min(
    Math.max(activeX - 72, PAD.left),
    WIDTH - PAD.right - 144,
  );
  const yearCounts = data.reduce((counts, point) => {
    if (point.year) counts.set(point.year, (counts.get(point.year) ?? 0) + 1);
    return counts;
  }, new Map<number, number>());
  const dateLabel = (point: SeriesPoint) => {
    if (point.label && !/^(carrier|text)$/iu.test(point.label)) return point.label;
    if (point.year && yearCounts.get(point.year) === 1) {
      return `${point.year}${point.partial ? "*" : ""}`;
    }
    const date = new Date(point.date);
    return Number.isNaN(date.valueOf())
      ? point.date
      : new Intl.DateTimeFormat(locale === "uk" ? "uk-UA" : "en-GB", {
          month: "short",
          year: "numeric",
        }).format(date);
  };

  return (
    <svg
      className="line-chart"
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      role="img"
      aria-label={`${locale === "uk" ? "Динаміка показника" : "Indicator trend"}, ${unit}`}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>

      {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
        const tickValue = max - (max - min) * ratio;
        const tickY = PAD.top + plotHeight * ratio;
        return (
          <g key={ratio}>
            <line
              x1={PAD.left}
              x2={WIDTH - PAD.right}
              y1={tickY}
              y2={tickY}
              className="chart-grid"
            />
            <text
              x={PAD.left - 12}
              y={tickY + 4}
              textAnchor="end"
              className="chart-tick chart-tick-value"
            >
              {formatter(tickValue, true)}
            </text>
          </g>
        );
      })}

      {view === "area" &&
        paths.map(
          (path, index) =>
            path.area && (
            <path
              key={`area-${index}`}
              d={path.area}
              fill={`url(#${gradientId})`}
            />
          ),
        )}
      {view === "column" &&
        data.map((point, index) => {
          const zeroY = y(baselineValue);
          const pointY = y(point.value);
          const availableWidth = plotWidth / data.length;
          const width = Math.max(4, Math.min(34, availableWidth * 0.66));
          return (
            <rect
              key={`column-${point.date}-${index}`}
              x={x(index) - width / 2}
              y={Math.min(pointY, zeroY)}
              width={width}
              height={Math.max(1, Math.abs(zeroY - pointY))}
              rx={2}
              fill={color}
              opacity={point.forecast ? 0.48 : 0.92}
              className={point.forecast ? "chart-column-forecast" : undefined}
            />
          );
        })}
      {view !== "column" &&
        paths.map((path, index) => (
          <path
            key={`line-${index}`}
            d={path.line}
            fill="none"
            stroke={color}
            className={`chart-line${path.forecast ? " chart-line-forecast" : ""}`}
          />
        ))}

      {data.map((point, index) => (
        <circle
          key={`${point.date}-${point.label ?? ""}-${point.value}`}
          cx={x(index)}
          cy={y(point.value)}
          r={index === data.length - 1 ? 5 : 2.5}
          fill={point.partial || point.forecast ? "var(--paper)" : color}
          stroke={color}
          strokeWidth={point.partial || point.forecast ? 3 : 1}
          className="chart-point"
        >
          <title>
            {dateLabel(point)}: {formatter(point.value)}
            {point.forecast ? (locale === "uk" ? " · прогноз" : " · forecast") : ""}
          </title>
        </circle>
      ))}

      {labelIndexes.map((index) => (
        <text
          key={index}
          x={x(index)}
          y={HEIGHT - 12}
          textAnchor={
            index === 0
              ? "start"
              : index === data.length - 1
                ? "end"
                : "middle"
          }
          className="chart-tick"
        >
          {dateLabel(data[index])}
        </text>
      ))}

      <text
        x={WIDTH - PAD.right}
        y={PAD.top + 2}
        textAnchor="end"
        className="chart-unit"
      >
        {unit}
      </text>

      {hasForecast && (
        <g className="chart-forecast-key" aria-hidden="true">
          <line
            x1={PAD.left}
            x2={PAD.left + 24}
            y1={PAD.top + 2}
            y2={PAD.top + 2}
          />
          <text x={PAD.left + 31} y={PAD.top + 6}>
            {locale === "uk" ? "прогноз" : "forecast"}
          </text>
        </g>
      )}

      {activePoint && (
        <g className="chart-tooltip" aria-hidden="true">
          <line
            x1={activeX}
            x2={activeX}
            y1={PAD.top}
            y2={HEIGHT - PAD.bottom}
          />
          <circle
            cx={activeX}
            cy={y(activePoint.value)}
            r={6}
            fill={color}
            stroke="var(--paper)"
            strokeWidth={3}
          />
          <rect x={tooltipX} y={PAD.top + 8} width={144} height={52} rx={2} />
          <text x={tooltipX + 10} y={PAD.top + 28}>
            {dateLabel(activePoint)}
          </text>
          <text x={tooltipX + 10} y={PAD.top + 47}>
            {formatter(activePoint.value)}
            {activePoint.forecast ? (locale === "uk" ? " · прогноз" : " · forecast") : ""}
          </text>
        </g>
      )}

      <rect
        x={PAD.left}
        y={PAD.top}
        width={plotWidth}
        height={plotHeight}
        fill="transparent"
        className="chart-hit-area"
        onPointerMove={(event) => {
          const bounds = event.currentTarget.getBoundingClientRect();
          const ratio = Math.min(
            1,
            Math.max(0, (event.clientX - bounds.left) / bounds.width),
          );
          setActiveIndex(Math.round(ratio * (data.length - 1)));
        }}
        onPointerLeave={() => setActiveIndex(null)}
      />
    </svg>
  );
}
