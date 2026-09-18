import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { fetchAllMetrics } from "./adapters.mjs";
import { catalogue } from "./catalog.mjs";
import { buildSignals, buildWeeklyReport } from "./signals.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../..");
const outputDirectory = resolve(root, "public/data");

function reportToMarkdown(report) {
  const highlights = report.highlights
    .map(
      (highlight) =>
        `## ${highlight.title}\n\n${highlight.body}\n\nРівень сигналу: **${highlight.level}**.`,
    )
    .join("\n\n");
  return `# ${report.title}\n\n${report.deck}\n\n${highlights}\n\n---\n\nДжерело: відкриті дані Національного банку України. Згенеровано ${report.generatedAt}.\n`;
}

console.log("RI NBU Data Corner: fetching annual histories and latest values...");
const metrics = await fetchAllMetrics();
const generatedAt = new Date().toISOString();
const signals = buildSignals(metrics);
const report = buildWeeklyReport(signals, generatedAt);
const latestDate = [...metrics]
  .map((metric) => metric.currentDate)
  .sort()
  .at(-1);

const dashboard = {
  meta: {
    generatedAt,
    source: "Національний банк України",
    sourceUrl: "https://bank.gov.ua/ua/open-data/api-dev",
    catalogueCount: catalogue.length,
    liveMetricCount: metrics.length,
    currentThrough: latestDate,
  },
  metrics,
  signals,
  catalogue,
  report,
};

await mkdir(outputDirectory, { recursive: true });
await Promise.all([
  writeFile(
    resolve(outputDirectory, "dashboard.json"),
    `${JSON.stringify(dashboard, null, 2)}\n`,
  ),
  writeFile(
    resolve(outputDirectory, "catalogue.json"),
    `${JSON.stringify(catalogue, null, 2)}\n`,
  ),
  writeFile(
    resolve(outputDirectory, "weekly-report.json"),
    `${JSON.stringify(report, null, 2)}\n`,
  ),
  writeFile(
    resolve(outputDirectory, "weekly-report.md"),
    reportToMarkdown(report),
  ),
]);

console.log(
  `Generated ${metrics.length} live metrics, ${catalogue.length} catalogue entries, and ${signals.length} signals.`,
);
console.log(`Output: ${outputDirectory}`);
