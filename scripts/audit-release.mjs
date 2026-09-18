import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const roots = [
  { kind: "api", path: join(root, "public/data") },
  { kind: "static", path: join(root, "public/uc") },
];

const findings = [];
const graphCodes = new Map();
const counts = {
  datasetViews: 0,
  datasets: 0,
  indicators: 0,
  points: 0,
  facts: 0,
  graphReadyDatasets: 0,
  factOnlyDatasets: 0,
  categoricalSnapshotGroups: 0,
};
const byRootCorner = [];

function addFinding(severity, type, location, message, evidence = {}) {
  findings.push({ severity, type, location, message, evidence });
}

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

function isValidDate(value) {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/u.test(value) &&
    !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
  );
}

async function localExportExists(datasetDir, url) {
  if (typeof url !== "string" || !url) return false;
  const name = url.split("/").pop();
  return Boolean(name) && exists(join(datasetDir, name));
}

function exportUrls(exports = {}) {
  return [
    ...(Array.isArray(exports.jsonChunks) ? exports.jsonChunks : []),
    ...(Array.isArray(exports.csvChunks) ? exports.csvChunks : []),
    ...(exports.annualCsv ? [{ url: exports.annualCsv }] : []),
  ].map((entry) => (typeof entry === "string" ? entry : entry?.url));
}

async function inspectDataset({ kind, corner, dataset, datasetDir }) {
  counts.datasets += 1;
  const location = `${kind}/${corner}/${dataset.id}`;
  const requiredBilingual = ["titleUa", "titleEn", "readerGuide"];
  for (const field of requiredBilingual) {
    if (!dataset[field] || (field === "readerGuide" && !dataset[field]?.ua?.what)) {
      addFinding("high", "missing-metadata", location, `Missing ${field}.`);
    }
  }
  if (!dataset.graphCodeBase) {
    addFinding("high", "missing-graph-code", location, "Dataset has no stable graph code.");
  } else {
    const graphLocation = `${kind}/${corner}/${dataset.graphCodeBase}`;
    if (graphCodes.has(graphLocation)) {
      addFinding(
        "medium",
        "duplicate-graph-code",
        location,
        "Graph code is reused within the same published view.",
        { previous: graphCodes.get(graphLocation) },
      );
    } else {
      graphCodes.set(graphLocation, location);
    }
  }

  const summaryPath = join(datasetDir, "summary.json");
  if (!(await exists(summaryPath))) {
    addFinding("high", "missing-summary", location, "Dataset manifest entry has no summary.json.");
    return;
  }

  const summary = await readJson(summaryPath);
  if (summary.id !== dataset.id) {
    addFinding("high", "id-mismatch", location, "Manifest and summary dataset IDs differ.", {
      manifestId: dataset.id,
      summaryId: summary.id,
    });
  }

  const indicators = Array.isArray(summary.indicators) ? summary.indicators : [];
  const facts = Array.isArray(summary.fallbackFacts) ? summary.fallbackFacts : [];
  counts.indicators += indicators.length;
  counts.facts += facts.length;
  if (indicators.length === 0 && facts.length === 0) {
    addFinding("high", "no-published-output", location, "Dataset has neither chart indicators nor fallback facts.");
  } else if (indicators.length === 0 && facts.length > 0) {
    counts.factOnlyDatasets += 1;
  }

  let hasChartPoints = false;
  for (const indicator of indicators) {
    const series = Array.isArray(indicator.series) ? indicator.series : [];
    if (series.length === 0) {
      addFinding("high", "empty-series", `${location}/${indicator.id}`, "Indicator is published without chartable points.");
      continue;
    }
    hasChartPoints = true;
    const pointsByDate = new Map();
    for (const point of series) {
      counts.points += 1;
      const date = point?.date;
      if (!isValidDate(date)) {
        addFinding("high", "invalid-date", `${location}/${indicator.id}`, "Series contains a non-ISO or invalid date.", {
          date,
        });
      }
      if (
        Number.isInteger(point?.year) &&
        isValidDate(date) &&
        point.year !== Number(date.slice(0, 4))
      ) {
        addFinding("high", "year-date-mismatch", `${location}/${indicator.id}`, "Point year does not match its ISO date.", {
          date,
          year: point.year,
        });
      }
      if (typeof point?.value !== "number" || !Number.isFinite(point.value)) {
        addFinding("high", "invalid-value", `${location}/${indicator.id}`, "Series contains a non-finite numeric value.", {
          date,
          value: point?.value,
        });
      }

      const carrierText =
        indicator.observationStatus === "carrier-text" ||
        (Array.isArray(point?.qualityFlags) && point.qualityFlags.includes("carrier-text"));
      if (
        carrierText &&
        Number.isInteger(point?.value) &&
        point.value >= -2100 &&
        point.value <= -1900
      ) {
        addFinding(
          "critical",
          "negative-year-artifact",
          `${location}/${indicator.id}`,
          "Carrier text was converted into a negative numeric year-like value.",
          { date, value: point.value },
        );
      }

      const pointsForDate = pointsByDate.get(date) ?? [];
      pointsForDate.push(point);
      pointsByDate.set(date, pointsForDate);
    }
    for (const [date, pointsForDate] of pointsByDate) {
      if (pointsForDate.length > 1) {
        const values = pointsForDate.map((point) => point?.value);
        const labels = pointsForDate.map((point) =>
          typeof point?.label === "string" ? point.label.trim() : "",
        );
        if (labels.every(Boolean) && new Set(labels).size === labels.length) {
          counts.categoricalSnapshotGroups += 1;
          continue;
        }
        const uniqueValues = new Set(values.map((value) => JSON.stringify(value)));
        addFinding(
          uniqueValues.size === 1 ? "medium" : "high",
          uniqueValues.size === 1 ? "duplicate-point" : "duplicate-period-values",
          `${location}/${indicator.id}`,
          uniqueValues.size === 1
            ? "The same date and value occur more than once in one normalized series."
            : "More than one value occurs for the same date in one normalized series.",
          { date, values },
        );
      }
    }
  }
  if (hasChartPoints) counts.graphReadyDatasets += 1;

  const urls = exportUrls(summary.exports);
  for (const url of urls) {
    if (!(await localExportExists(datasetDir, url))) {
      addFinding("high", "missing-export", location, "Published export is listed but its local release file is missing.", {
        url,
      });
    }
  }
  if (hasChartPoints && urls.filter(Boolean).length === 0) {
    addFinding("high", "missing-chart-export", location, "Chart-ready dataset has no JSON or CSV export listed.");
  }
}

async function inspectCorner(kind, corner, rootPath) {
  const cornerPath = join(rootPath, corner);
  const manifestPath = join(cornerPath, "dataroom/manifest.json");
  const result = {
    kind,
    corner,
    datasets: 0,
    indicators: 0,
    points: 0,
    facts: 0,
    graphReadyDatasets: 0,
    factOnlyDatasets: 0,
    categoricalSnapshotGroups: 0,
  };
  if (!(await exists(manifestPath))) {
    addFinding("high", "missing-manifest", `${kind}/${corner}`, "Published corner has no dataroom manifest.");
    return result;
  }

  const manifest = await readJson(manifestPath);
  const datasets = Array.isArray(manifest.datasets) ? manifest.datasets : [];
  counts.datasetViews += datasets.length;
  result.datasets = datasets.length;
  if (Number.isInteger(manifest.meta?.datasetCount) && manifest.meta.datasetCount !== datasets.length) {
    addFinding("medium", "manifest-count-mismatch", `${kind}/${corner}`, "Manifest meta.datasetCount differs from the number of dataset entries.", {
      declared: manifest.meta.datasetCount,
      actual: datasets.length,
    });
  }
  const before = { ...counts };
  for (const dataset of datasets) {
    if (!dataset?.id) {
      addFinding("high", "missing-dataset-id", `${kind}/${corner}`, "Manifest contains a dataset without an ID.");
      continue;
    }
    await inspectDataset({
      kind,
      corner,
      dataset,
      datasetDir: join(cornerPath, "dataroom", dataset.id),
    });
  }
  result.indicators = counts.indicators - before.indicators;
  result.points = counts.points - before.points;
  result.facts = counts.facts - before.facts;
  result.graphReadyDatasets = counts.graphReadyDatasets - before.graphReadyDatasets;
  result.factOnlyDatasets = counts.factOnlyDatasets - before.factOnlyDatasets;
  result.categoricalSnapshotGroups =
    counts.categoricalSnapshotGroups - before.categoricalSnapshotGroups;
  byRootCorner.push(result);
  return result;
}

for (const { kind, path } of roots) {
  if (!(await exists(path))) continue;
  const entries = await readdir(path, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) await inspectCorner(kind, entry.name, path);
  }
}

const blockingFindings = findings.filter((finding) => ["critical", "high"].includes(finding.severity));
const status = blockingFindings.length === 0 ? "pass" : "attention";
const generatedAt = new Date().toISOString();
const report = {
  auditVersion: 1,
  generatedAt,
  status,
  scope: "Published local release files under public/data and public/uc.",
  counts,
  findings,
  blockingFindings: blockingFindings.length,
  byRootCorner,
  rules: [
    "Duplicate dates are evaluated inside one normalized indicator series, not across separate dimensional series.",
    "Negative values are valid in signed measures. A negative year-like value is flagged only when the point is explicitly carrier text.",
    "Fact-only datasets are valid when fallbackFacts are present; they are not forced into an empty chart.",
    "A chart-ready indicator must contain finite values, valid ISO dates, and at least one listed JSON or CSV export.",
    "Several labeled values on one snapshot date are treated as a categorical snapshot, not as duplicate time-series observations.",
  ],
  interpretation: {
    signedValues: "Negative observations in measures such as net foreign-investment flows or energy-balance exports are retained as source values and are not treated as parser errors.",
    uconomicsCarrierText: "Qualitative year ranges remain fallback facts and must not become numeric observations.",
    deliveryViews: "The API and static views of a corner are counted separately when both are present; this is a delivery representation, not a duplicate observation claim.",
  },
};

const auditJson = join(root, "public/uc/data-quality-audit.json");
const auditMd = join(root, "public/uc/data-quality-audit.md");
await mkdir(dirname(auditJson), { recursive: true });
await writeFile(auditJson, `${JSON.stringify(report, null, 2)}\n`);

const bySeverity = Object.fromEntries(
  ["critical", "high", "medium", "low"].map((severity) => [
    severity,
    findings.filter((finding) => finding.severity === severity).length,
  ]),
);
const lines = [
  "# Ukraine Dataroom release audit",
  "",
  `Generated: ${generatedAt}`,
  `Status: ${status.toUpperCase()}`,
  "",
  "## Coverage",
  "",
  `- Dataset views scanned: ${counts.datasetViews}`,
  `- Dataset entries scanned: ${counts.datasets}`,
  `- Indicators scanned: ${counts.indicators}`,
  `- Numeric points scanned: ${counts.points}`,
  `- Fallback facts scanned: ${counts.facts}`,
  `- Chart-ready datasets: ${counts.graphReadyDatasets}`,
  `- Fact-only datasets: ${counts.factOnlyDatasets}`,
  `- Labeled categorical snapshot groups reviewed: ${counts.categoricalSnapshotGroups}`,
  "",
  "## Findings",
  "",
  `- Critical: ${bySeverity.critical}`,
  `- High: ${bySeverity.high}`,
  `- Medium: ${bySeverity.medium}`,
  `- Low: ${bySeverity.low}`,
  "",
  blockingFindings.length === 0
    ? "No blocking data-quality findings were found in the published release."
    : "Blocking findings require correction before publication.",
  "",
  "Negative observations in signed measures are retained. They are not classified as year corruption unless the normalized point is explicitly marked as carrier text. This protects valid net-flow and balance measures from automatic deletion.",
  "",
  "## Corner coverage",
  "",
  "| Delivery | Corner | Datasets | Indicators | Points | Facts | Chart-ready | Fact-only | Snapshot groups |",
  "|---|---|---:|---:|---:|---:|---:|---:|---:|",
  ...byRootCorner.map((item) =>
    `| ${item.kind} | ${item.corner} | ${item.datasets} | ${item.indicators} | ${item.points} | ${item.facts} | ${item.graphReadyDatasets} | ${item.factOnlyDatasets} | ${item.categoricalSnapshotGroups} |`,
  ),
  "",
  "## Findings detail",
  "",
];
if (findings.length === 0) {
  lines.push("None.");
} else {
  for (const finding of findings) {
    lines.push(`- **${finding.severity}** \`${finding.type}\` at \`${finding.location}\`: ${finding.message}`);
  }
}
lines.push("", "Machine-readable report: `/uc/data-quality-audit.json`.", "");
await writeFile(auditMd, `${lines.join("\n")}\n`);

console.log(
  `Release audit: ${status}; ${counts.datasets} datasets, ${counts.points} points, ${findings.length} findings (${blockingFindings.length} blocking).`,
);
