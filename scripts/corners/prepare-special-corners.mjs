import { cp, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { publicRoot, root } from "./common.mjs";
import { localizeDataset } from "./localization.mjs";

const definitions = [
  { corner: "nbu", source: resolve(root, "../nbu-data-corner/public/data") },
  { corner: "stat", source: resolve(root, "../derzhstat-data-corner/public/data") },
];

async function json(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function save(path, value) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

for (const definition of definitions) {
  const destination = resolve(publicRoot, definition.corner);
  await rm(destination, { recursive: true, force: true });
  await cp(definition.source, destination, { recursive: true });
  const manifestPath = resolve(destination, "dataroom/manifest.json");
  const manifest = await json(manifestPath);
  const ready = [];
  const excluded = [];
  for (const card of manifest.datasets ?? []) {
    const summaryPath = resolve(destination, "dataroom", card.id, "summary.json");
    const summary = localizeDataset(await json(summaryPath), definition.corner);
    const validSeries = (summary.indicators ?? []).filter(
      (indicator) => (indicator.series ?? []).filter((point) => Number.isFinite(point.value)).length >= 2,
    );
    if (!validSeries.length) {
      excluded.push({
        id: card.id,
        error: "excluded-no-temporal-series: no numeric series has at least two distinct published periods",
      });
      await rm(resolve(destination, "dataroom", card.id), { recursive: true, force: true });
      continue;
    }
    summary.indicators = validSeries.map((indicator, index) => ({
      ...indicator,
      graphCode: indicator.graphCode ?? `UA-${definition.corner.toLocaleUpperCase()}-${String(card.number).padStart(4, "0")}-G${String(index + 1).padStart(2, "0")}`,
    }));
    summary.graphCodeBase = summary.graphCodeBase ?? `UA-${definition.corner.toLocaleUpperCase()}-${String(card.number).padStart(4, "0")}`;
    await save(summaryPath, summary);
    ready.push({
      ...card,
      titleOriginal: summary.titleOriginal,
      titleUa: summary.titleUa,
      titleEn: summary.titleEn,
      descriptionUa: summary.descriptionUa,
      descriptionEn: summary.descriptionEn,
      readerGuide: summary.readerGuide,
      graphCodeBase: summary.graphCodeBase,
    });
  }
  const readyIds = new Set(ready.map((item) => item.id));
  manifest.datasets = ready;
  manifest.failures = [...(manifest.failures ?? []), ...excluded];
  manifest.meta.datasetCount = ready.length;
  manifest.meta.liveDatasetCount = ready.length;
  manifest.meta.failedDatasetCount = manifest.failures.length;
  await save(manifestPath, manifest);

  const dashboardPath = resolve(destination, "dashboard.json");
  const dashboard = await json(dashboardPath);
  dashboard.catalogue = (dashboard.catalogue ?? []).filter((item) => readyIds.has(item.id));
  dashboard.metrics = (dashboard.metrics ?? []).filter((item) => readyIds.has(item.id));
  const metricIds = new Set(dashboard.metrics.map((item) => item.id));
  dashboard.signals = (dashboard.signals ?? []).filter((item) => metricIds.has(item.metricId));
  dashboard.meta.catalogueCount = ready.length;
  dashboard.meta.liveMetricCount = dashboard.metrics.length;
  await save(dashboardPath, dashboard);
  await save(resolve(destination, "catalogue.json"), dashboard.catalogue);

  const coveragePath = resolve(destination, "dataroom/coverage-report.json");
  try {
    const coverage = await json(coveragePath);
    coverage.datasets = (coverage.datasets ?? []).filter((item) => readyIds.has(item.id));
    coverage.datasetCount = coverage.datasets.length;
    coverage.failures = [...(coverage.failures ?? []), ...excluded];
    await save(coveragePath, coverage);
  } catch {
    // The manifest remains the canonical readiness audit for legacy releases.
  }
  console.log(`${definition.corner}: ${ready.length} graph-ready, ${excluded.length} excluded`);
}
