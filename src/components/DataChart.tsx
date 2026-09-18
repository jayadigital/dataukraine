import { useRef, useState } from "react";
import type { SheetData } from "write-excel-file/browser";
import type { SeriesPoint } from "../types";
import { LineChart } from "./LineChart";
import { MultiLineChart, type ComparisonSeries } from "./MultiLineChart";

type View = "line" | "column" | "area" | "table" | "pie" | "mekko";

type Props = {
  id: string;
  title: string;
  subtitle?: string;
  data: SeriesPoint[];
  color: string;
  unit: string;
  formatter: (value: number, compact?: boolean) => string;
  locale?: "uk" | "en";
  sourceLabel?: string;
  sourceUrl?: string;
  annualCsvUrl?: string;
  markdownUrl?: string;
  featured?: boolean;
  categorical?: boolean;
  graphCode?: string;
  comparisonSeries?: ComparisonSeries[];
  comparisonLabel?: string;
  sharePath?: string;
  compact?: boolean;
};

const labels = {
  uk: {
    line: "Лінія",
    column: "Стовпці",
    area: "Площа",
    table: "Таблиця",
    pie: "Коло",
    mekko: "Mekko",
    png: "PNG",
    pdf: "PDF",
    md: "MD",
    csv: "CSV",
    xlsx: "XLSX",
    share: "Поділитися",
    copiedButton: "Скопійовано",
    unavailablePie: "Коло потребує категорій одного періоду",
    unavailableMekko: "Mekko потребує двох категоріальних вимірів",
    copied: "Посилання скопійовано",
    downloadError: "Не вдалося створити файл",
    date: "Період",
    value: "Значення",
    status: "Статус",
    forecast: "Прогноз",
    observed: "Факт / оцінка",
    series: "Країна",
    countries: "Країни",
  },
  en: {
    line: "Line",
    column: "Columns",
    area: "Area",
    table: "Table",
    pie: "Pie",
    mekko: "Mekko",
    png: "PNG",
    pdf: "PDF",
    md: "MD",
    csv: "CSV",
    xlsx: "XLSX",
    share: "Share",
    copiedButton: "Copied",
    unavailablePie: "Pie needs categories from one period",
    unavailableMekko: "Mekko needs two categorical dimensions",
    copied: "Link copied",
    downloadError: "Could not create the file",
    date: "Period",
    value: "Value",
    status: "Status",
    forecast: "Forecast",
    observed: "Observed / estimate",
    series: "Country",
    countries: "Countries",
  },
};

function slug(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[^\w]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 80) || "protofund-chart";
}

function downloadBlob(blob: Blob, filename: string) {
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(href);
}

function csvCell(value: unknown) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function drawWrappedText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines = 2,
) {
  const words = text.split(/\s+/u);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (context.measureText(candidate).width <= maxWidth || !line) {
      line = candidate;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  lines.slice(0, maxLines).forEach((value, index) => {
    const clipped =
      index === maxLines - 1 && lines.length > maxLines ? `${value}…` : value;
    context.fillText(clipped, x, y + index * lineHeight);
  });
}

async function chartCanvas(
  container: HTMLDivElement,
  metadata: {
    title: string;
    subtitle?: string;
    source: string;
    unit: string;
    graphCode: string;
  },
) {
  const svg = container.querySelector("svg");
  if (!svg) throw new Error("Chart SVG not found");
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", "1520");
  clone.setAttribute("height", "580");
  const sourceNodes = [svg, ...svg.querySelectorAll("*")];
  const cloneNodes = [clone, ...clone.querySelectorAll("*")];
  sourceNodes.forEach((node, index) => {
    const target = cloneNodes[index] as SVGElement | undefined;
    if (!target) return;
    const computed = getComputedStyle(node);
    target.style.fontFamily = computed.fontFamily;
    target.style.fontSize = computed.fontSize;
    target.style.fontWeight = computed.fontWeight;
    target.style.opacity = computed.opacity;
    target.style.strokeWidth = computed.strokeWidth;
    target.style.strokeDasharray = computed.strokeDasharray;
    if (target.tagName.toLowerCase() === "text") {
      target.style.fill = "#111820";
      target.style.stroke = "none";
    } else if (target.classList.contains("chart-grid")) {
      target.style.stroke = "#d8dee3";
    } else {
      if (computed.fill && computed.fill !== "none") target.style.fill = computed.fill;
      if (computed.stroke && computed.stroke !== "none") target.style.stroke = computed.stroke;
    }
    if (target.getAttribute("fill")?.includes("var(--paper)")) {
      target.setAttribute("fill", "#ffffff");
      target.style.fill = "#ffffff";
    }
    if (target.getAttribute("stroke")?.includes("var(--paper)")) {
      target.setAttribute("stroke", "#ffffff");
      target.style.stroke = "#ffffff";
    }
  });
  const source = new XMLSerializer().serializeToString(clone);
  const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
  const objectUrl = URL.createObjectURL(blob);
  const image = new Image();
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("Chart image could not be rendered"));
    image.src = objectUrl;
  });
  const canvas = document.createElement("canvas");
  canvas.width = 1600;
  canvas.height = 900;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is unavailable");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#111820";
  context.font = "700 24px 'IBM Plex Mono', monospace";
  context.fillText(metadata.graphCode, 48, 58);
  context.font = "700 50px 'PT Serif', Georgia, serif";
  drawWrappedText(context, metadata.title, 48, 120, 1504, 56, 2);
  if (metadata.subtitle) {
    context.fillStyle = "#4d5961";
    context.font = "400 22px 'IBM Plex Sans', sans-serif";
    drawWrappedText(context, metadata.subtitle, 48, 206, 1504, 30, 2);
  }
  context.drawImage(image, 40, 250, 1520, 580);
  context.fillStyle = "#4d5961";
  context.font = "500 19px 'IBM Plex Sans', sans-serif";
  context.fillText(`${metadata.source} · ${metadata.unit}`, 48, 868);
  URL.revokeObjectURL(objectUrl);
  return canvas;
}

export function DataChart({
  id,
  title,
  subtitle,
  data,
  color,
  unit,
  formatter,
  locale = "uk",
  sourceLabel,
  sourceUrl,
  annualCsvUrl,
  markdownUrl,
  featured = false,
  categorical = false,
  graphCode,
  comparisonSeries = [],
  comparisonLabel,
  sharePath,
  compact = false,
}: Props) {
  const [view, setView] = useState<View>(() =>
    comparisonSeries.length
      ? "line"
      : categorical || data.length < 2 ? "column" : "line",
  );
  const [selectedSeries, setSelectedSeries] = useState(() => comparisonSeries.map((item) => item.id));
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);
  const visualRef = useRef<HTMLDivElement>(null);
  const text = labels[locale];
  const filename = slug(`${sourceLabel ?? "protofund"}-${title}`);
  const stableGraphCode = graphCode ?? id.toLocaleUpperCase();
  const activeComparison = comparisonSeries.filter((item) => selectedSeries.includes(item.id));
  const hasComparison = comparisonSeries.length > 1;
  // Period labels such as "2026 Jan–Jul annualized" are still time-series
  // labels. Only callers with an explicit category layout should disable trends.
  const isCategorical = categorical;
  const canTrend = hasComparison
    ? activeComparison.some((item) => item.data.length > 1)
    : !isCategorical && data.length > 1;
  const canPie = isCategorical && data.length >= 2 && data.length <= 12 && data.every((point) => point.value >= 0);
  const views: Array<{ id: View; enabled: boolean; reason?: string }> = [
    { id: "line", enabled: canTrend },
    { id: "column", enabled: !hasComparison && data.length > 0 },
    { id: "area", enabled: !hasComparison && canTrend },
    { id: "table", enabled: data.length > 0 },
    { id: "pie", enabled: !hasComparison && canPie, reason: text.unavailablePie },
    { id: "mekko", enabled: false, reason: text.unavailableMekko },
  ];

  const yearCounts = data.reduce((counts, point) => {
    if (point.year) counts.set(point.year, (counts.get(point.year) ?? 0) + 1);
    return counts;
  }, new Map<number, number>());
  const pointRow = (point: SeriesPoint, series = "") => ({
    series,
    period: isCategorical && point.label
      ? `${point.year ?? point.date.slice(0, 4)} · ${point.label}`
      : point.label
      ? point.label
      : point.year && yearCounts.get(point.year) === 1
      ? String(point.year)
      : new Intl.DateTimeFormat(locale === "uk" ? "uk-UA" : "en-GB", {
          month: "short",
          year: "numeric",
        }).format(new Date(point.date)),
    value: point.value,
    unit,
    status: point.forecast ? text.forecast : text.observed,
  });
  const rows = hasComparison
    ? activeComparison.flatMap((item) => item.data.map((point) => pointRow(point, item.label)))
    : data.map((point) => pointRow(point));

  function flash(value: string) {
    setMessage(value);
    window.setTimeout(() => setMessage(""), 2200);
  }

  async function exportPng() {
    try {
      if (!visualRef.current) return;
      const canvas = await chartCanvas(visualRef.current, {
        title,
        subtitle,
        source: sourceLabel ?? "Ukraine Dataroom",
        unit,
        graphCode: stableGraphCode,
      });
      canvas.toBlob((blob) => blob && downloadBlob(blob, `${filename}.png`), "image/png");
    } catch {
      flash(text.downloadError);
    }
  }

  async function exportPdf() {
    try {
      if (!visualRef.current) return;
      const canvas = await chartCanvas(visualRef.current, {
        title,
        subtitle,
        source: sourceLabel ?? "Ukraine Dataroom",
        unit,
        graphCode: stableGraphCode,
      });
      const { jsPDF } = await import("jspdf");
      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      pdf.addImage(canvas.toDataURL("image/png"), "PNG", 12, 10, 273, 154);
      pdf.setFontSize(9);
      pdf.setTextColor(70);
      pdf.text(`${stableGraphCode} · ${sourceLabel ?? "Ukraine Dataroom"} · ${unit}`, 12, 174);
      pdf.save(`${filename}.pdf`);
    } catch {
      flash(text.downloadError);
    }
  }

  async function exportXlsx() {
    try {
      const { default: writeXlsxFile } = await import("write-excel-file/browser");
      const sheet: SheetData = [
        [
          ...(hasComparison ? [{ value: text.series, fontWeight: "bold" as const }] : []),
          { value: text.date, fontWeight: "bold" },
          { value: text.value, fontWeight: "bold" },
          { value: "Unit", fontWeight: "bold" },
          { value: text.status, fontWeight: "bold" },
        ],
        ...rows.map((row) => [
          ...(hasComparison ? [{ value: row.series }] : []),
          { value: row.period },
          { value: row.value, type: Number },
          { value: row.unit },
          { value: row.status },
        ]),
      ];
      await writeXlsxFile(sheet, {
        sheet: "Data",
        columns: hasComparison
          ? [{ width: 18 }, { width: 18 }, { width: 16 }, { width: 14 }, { width: 22 }]
          : [{ width: 18 }, { width: 16 }, { width: 14 }, { width: 22 }],
      }).toFile(`${filename}.xlsx`);
    } catch {
      flash(text.downloadError);
    }
  }

  function exportCsv() {
    if (annualCsvUrl) {
      const anchor = document.createElement("a");
      anchor.href = annualCsvUrl;
      anchor.download = `${filename}.csv`;
      anchor.click();
      return;
    }
    const body = [
      [...(hasComparison ? ["series"] : []), "period", "value", "unit", "status"],
      ...rows.map((row) => [...(hasComparison ? [row.series] : []), row.period, row.value, row.unit, row.status]),
    ].map((row) => row.map(csvCell).join(",")).join("\n");
    downloadBlob(new Blob([body], { type: "text/csv;charset=utf-8" }), `${filename}.csv`);
  }

  function exportMarkdown() {
    if (markdownUrl) {
      const anchor = document.createElement("a");
      anchor.href = markdownUrl;
      anchor.download = `${filename}.md`;
      anchor.click();
      return;
    }
    const body = [
      `# ${title}`,
      "",
      subtitle ?? "",
      "",
      `| ${hasComparison ? `${text.series} | ` : ""}${text.date} | ${text.value} | Unit | ${text.status} |`,
      `|${hasComparison ? "---|" : ""}---|---:|---|---|`,
      ...rows.map((row) => `| ${hasComparison ? `${row.series} | ` : ""}${row.period} | ${row.value} | ${row.unit} | ${row.status} |`),
      "",
      sourceUrl ? `Source: ${sourceUrl}` : "",
    ].join("\n");
    downloadBlob(new Blob([body], { type: "text/markdown;charset=utf-8" }), `${filename}.md`);
  }

  function share() {
    const shareUrl = new URL(
      sharePath ?? `${window.location.pathname}${window.location.search}`,
      "https://ukraine.proto.fund",
    );
    shareUrl.searchParams.delete("chart");
    shareUrl.hash = stableGraphCode.toLocaleLowerCase();
    const markCopied = () => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    };
    const input = document.createElement("textarea");
    input.value = shareUrl.toString();
    input.setAttribute("readonly", "");
    input.style.position = "fixed";
    input.style.opacity = "0";
    document.body.append(input);
    input.select();
    const copiedSynchronously = document.execCommand("copy");
    input.remove();
    if (copiedSynchronously) {
      markCopied();
      return;
    }
    if (navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(shareUrl.toString()).then(markCopied).catch(() => {
        flash(text.downloadError);
      });
      return;
    }
    flash(text.downloadError);
  }

  return (
    <article
      className={`chart-card data-chart ${featured ? "chart-card-featured" : ""}`}
      id={id}
      style={{ "--chart-color": color } as React.CSSProperties}
    >
      <div className="chart-workbench-head">
        <div>
          <span className="chart-identity">
            <code>{stableGraphCode}</code>
          </span>
          <h3>{title}</h3>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {!isCategorical && data.at(-1) && <strong>{formatter(data.at(-1)!.value)}</strong>}
      </div>
      <div className="chart-view-switcher" aria-label={locale === "uk" ? "Тип графіка" : "Chart type"}>
        {views.map((item) => (
          <button
            type="button"
            key={item.id}
            disabled={!item.enabled}
            className={view === item.id ? "active" : ""}
            onClick={() => item.enabled && setView(item.id)}
            title={item.enabled ? undefined : item.reason}
          >
            {text[item.id]}
          </button>
        ))}
      </div>
      {hasComparison && (
        <div className="country-series-picker" aria-label={comparisonLabel ?? text.countries}>
          <span>{comparisonLabel ?? text.countries}</span>
          {comparisonSeries.map((item) => {
            const selected = selectedSeries.includes(item.id);
            return (
              <button
                type="button"
                key={item.id}
                aria-pressed={selected}
                className={selected ? "active" : ""}
                style={{ "--series-color": item.color } as React.CSSProperties}
                onClick={() => setSelectedSeries((current) => {
                  if (current.includes(item.id)) {
                    return current.length === 1 ? current : current.filter((id) => id !== item.id);
                  }
                  return [...current, item.id];
                })}
              >
                <i />{item.label}
              </button>
            );
          })}
        </div>
      )}
      <div className="chart-visual" ref={visualRef}>
        {view === "table" ? (
          <div className="chart-table-wrap">
            <table className="chart-data-table">
              <thead>
                <tr>
                  {hasComparison && <th>{text.series}</th>}
                  <th>{text.date}</th>
                  <th>{text.value}</th>
                  <th>{text.status}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={`${row.series}-${row.period}`}>
                    {hasComparison && <td>{row.series}</td>}
                    <td>{row.period}</td>
                    <td>{formatter(row.value)}</td>
                    <td>{row.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          hasComparison ? (
            <MultiLineChart series={activeComparison} unit={unit} formatter={formatter} locale={locale} />
          ) : (
            <LineChart
              data={data}
              color={color}
              unit={unit}
              formatter={formatter}
              view={view === "pie" || view === "mekko" ? "column" : view}
              locale={locale}
            />
          )
        )}
      </div>
      {!compact && (
        <div className="chart-export-bar">
          <span>{locale === "uk" ? "Експорт" : "Export"}</span>
          <button type="button" onClick={exportPng}>{text.png}</button>
          <button type="button" onClick={exportPdf}>{text.pdf}</button>
          <button type="button" onClick={exportMarkdown}>{text.md}</button>
          <button type="button" onClick={exportCsv}>{text.csv}</button>
          <button type="button" onClick={exportXlsx}>{text.xlsx}</button>
          <button
            type="button"
            className={`chart-share${copied ? " is-copied" : ""}`}
            onClick={share}
            aria-live="polite"
          >
            <span>{copied ? text.copiedButton : text.share}</span>
          </button>
          {sourceUrl && <a href={sourceUrl} target="_blank" rel="noreferrer">Source ↗</a>}
          {message && <output>{message}</output>}
        </div>
      )}
    </article>
  );
}
