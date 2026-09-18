import test from "node:test";
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../..");
const dataRoot = resolve(root, "public/data");

async function json(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

test("publishes all 26 analytical NBU dataset views", async () => {
  const manifest = await json(resolve(dataRoot, "dataroom/manifest.json"));
  assert.equal(manifest.meta.datasetCount, 26);
  assert.equal(manifest.meta.liveDatasetCount, 26);
  assert.equal(manifest.failures.length, 0);
  assert.equal(manifest.datasets.length, 26);
  assert.ok(
    !manifest.datasets.some((dataset) => dataset.id === "government-securities"),
  );

  for (const dataset of manifest.datasets) {
    assert.ok(dataset.rowCount > 0, `${dataset.id} must contain live rows`);
    assert.ok(dataset.fieldCount > 0, `${dataset.id} must expose its schema`);
    const summary = await json(
      resolve(dataRoot, `dataroom/${dataset.id}/summary.json`),
    );
    assert.equal(summary.id, dataset.id);
    assert.ok(summary.description.length > 40);
    assert.ok(summary.question.endsWith("?"));
    assert.ok(summary.schema.length > 0);
    assert.ok(summary.coverage.length > 0);
    assert.ok(
      summary.coverage.every((source) => source.status === "included"),
    );
    assert.ok(summary.exports.jsonChunks.length > 0);
    assert.ok(summary.exports.jsonChunks[0].rows <= 1_000);
    await access(
      resolve(
        dataRoot,
        summary.exports.jsonChunks[0].url.replace(/^\/data\//, ""),
      ),
    );
  }
});

test("documents every API source family and includes labour", async () => {
  const coverage = await json(
    resolve(dataRoot, "dataroom/coverage-report.json"),
  );
  assert.equal(coverage.datasetCount, 26);
  assert.ok(coverage.sourceCount >= 48);
  assert.equal(coverage.datasets.length, 26);

  const macro = await json(
    resolve(dataRoot, "dataroom/macro-indicators/summary.json"),
  );
  assert.deepEqual(
    macro.coverage.map((source) => source.id),
    [
      "prices-monthly",
      "prices-annual",
      "activity-monthly",
      "activity-quarterly",
      "activity-annual",
      "labor-monthly",
      "labor-quarterly",
      "budget-monthly",
      "budget-annual",
    ],
  );
  assert.ok(
    macro.indicators.some(
      (indicator) => indicator.idApi === "lmss_fund_pay_wage",
    ),
  );
  assert.ok(
    macro.indicators.some(
      (indicator) => indicator.idApi === "lmss_actnas_up1570ap_",
    ),
  );
  await access(resolve(dataRoot, "dataroom/coverage-report.md"));
});

test("labels gaps, partial years, and cumulative observations", async () => {
  const macro = await json(
    resolve(dataRoot, "dataroom/macro-indicators/summary.json"),
  );
  const wage = macro.indicators.find(
    (indicator) => indicator.idApi === "lmss_fund_pay_wage",
  );
  const realWage = macro.indicators.find(
    (indicator) => indicator.idApi === "lmss_fund_pay_realwage",
  );
  const cumulative = macro.indicators.find((indicator) =>
    indicator.title.includes("кумулятивно з початку року"),
  );
  const currentPartialPoints = macro.indicators.flatMap((indicator) =>
    indicator.series.filter(
      (point) => point.partial && point.date.startsWith("2026"),
    ),
  );

  assert.ok(wage.value > 0);
  assert.equal(wage.unit, "грн");
  assert.ok(wage.series.some((point) => point.gapBefore));
  assert.ok(wage.series.every((point) => point.value !== 0));
  assert.ok(realWage.series.every((point) => point.value !== 0));
  assert.equal(realWage.series.at(-1).date, "2021-12-31");
  assert.ok(
    wage.notes.some((note) => note.includes("без заповнення прогалин")),
  );
  assert.ok(
    cumulative.notes.some((note) => note.includes("кумулятивне значення")),
  );
  assert.ok(currentPartialPoints.length > 0);
  assert.ok(
    currentPartialPoints.every((point) => point.date !== "2026-12-31"),
  );
  assert.ok(
    macro.indicators
      .flatMap((indicator) => indicator.notes)
      .some((note) => note.includes("не фінальний річний підсумок")),
  );

  const income = await json(
    resolve(dataRoot, "dataroom/bank-income-expenses/summary.json"),
  );
  assert.ok(
    income.indicators.every((indicator) =>
      indicator.notes.some((note) => note.includes("кумулятивне значення")),
    ),
  );
});

test("publishes lightweight regional indexes for map-ready datasets", async () => {
  const manifest = await json(resolve(dataRoot, "dataroom/manifest.json"));
  const regional = manifest.datasets.filter(
    (dataset) => dataset.regional.available,
  );

  assert.equal(manifest.meta.regionalDatasetCount, 4);
  assert.deepEqual(
    regional.map((dataset) => dataset.id).sort(),
    ["bank-interest-rates", "deposits", "loans", "macro-indicators"],
  );

  for (const dataset of regional) {
    assert.ok(dataset.regional.regionCount >= 25);
    const summary = await json(
      resolve(dataRoot, `dataroom/${dataset.id}/summary.json`),
    );
    assert.ok(summary.regionalPerspective.available);
    assert.ok(summary.regionalPerspective.rowCount > 0);
    assert.ok(summary.exports.regionsJson);
    const regions = await json(
      resolve(
        dataRoot,
        summary.exports.regionsJson.replace(/^\/data\//, ""),
      ),
    );
    assert.equal(
      regions.regionCount,
      summary.regionalPerspective.regionCount,
    );
    assert.ok(regions.dataFiles.length > 0);
  }
});

test("publishes annual, monthly, and daily sample reports", async () => {
  const reports = await json(resolve(dataRoot, "reports/manifest.json"));
  assert.deepEqual(
    reports.map((report) => report.period),
    ["annual", "monthly", "daily"],
  );
  for (const report of reports) {
    assert.ok(Number.isFinite(report.lead.current));
    assert.ok(Number.isFinite(report.lead.previous));
    assert.ok(report.deck.length <= 200);
    assert.ok(report.brief.length <= 200);
    assert.ok(report.lead.insight.length <= 200);
    await access(
      resolve(dataRoot, report.markdown.replace(/^\/data\//, "")),
    );
  }
});

test("preserves raw USD scale for currency-market volumes", async () => {
  const summary = await json(
    resolve(dataRoot, "dataroom/fx-market/summary.json"),
  );
  const monthlyUsdVolume = summary.indicators.find(
    (indicator) => indicator.idApi === "TotalCliBuyPerM",
  );

  assert.equal(monthlyUsdVolume.unit, "USD");
  assert.ok(monthlyUsdVolume.value > 1_000_000_000);
  assert.ok(monthlyUsdVolume.value < 100_000_000_000);
});
