import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../../", import.meta.url);

async function readJson(relativePath) {
  return JSON.parse(await readFile(new URL(relativePath, root), "utf8"));
}

test("RI import keeps original graph identity and explicit source lineage", async () => {
  const [manifest, audit, investment, recovery, steel, electricity] = await Promise.all([
    readJson("public/data/industrial/dataroom/manifest.json"),
    readJson("public/data/industrial/dataroom/RI-AUDIT.json"),
    readJson("public/data/industrial/dataroom/ri09-b4-g24/summary.json"),
    readJson(
      "public/data/industrial/dataroom/ri08-a0_g02_recovery_index/summary.json",
    ),
    readJson("public/data/industrial/dataroom/ri08-a1-g02/summary.json"),
    readJson("public/data/industrial/dataroom/ri09-a2-g10/summary.json"),
  ]);

  assert.equal(manifest.datasets.length, 155);
  assert.equal(audit.importedDatasets, 222);
  assert.equal(manifest.failures.length, 67);
  assert.ok(
    manifest.failures.every((failure) =>
      failure.error.startsWith("excluded-no-temporal-series"),
    ),
  );
  assert.equal(audit.graphCards, 134);
  assert.equal(audit.lineage.native, 153);
  assert.equal(audit.lineage.connected, 69);
  assert.equal(audit.unmatchedGraphCards.length, 20);
  assert.equal(audit.excludedOperationalTables.length, 17);
  assert.equal(audit.blocksWithoutTwoObservations.length, 15);
  assert.deepEqual(audit.fragmentedIndicatorLabels, []);

  assert.equal(investment.lineage.originalId, "RI-09:B4-G24");
  assert.equal(
    investment.titleOriginal,
    "Валові інвестиції в основний капітал: Україна проти світу.",
  );
  assert.equal(investment.graphCodeBase, "UA-RI-0190");
  assert.deepEqual(
    investment.indicators.map(({ title, graphCode }) => ({ title, graphCode })),
    [
      { title: "World", graphCode: "UA-RI-0190-G01" },
      { title: "Ukraine", graphCode: "UA-RI-0190-G02" },
    ],
  );
  assert.ok(
    investment.lineage.connections.some(
      (connection) =>
        connection.corner === "wb" &&
        connection.datasetId === "ne-gdi-ftot-cd" &&
        connection.relation === "duplicate-series",
    ),
  );
  assert.ok(
    recovery.indicators[0].title === "Частка до бази, %" &&
    recovery.indicators[0].series.length >= 5 &&
    recovery.indicators[0].series.every(
      (point) => point.label && point.value >= 0 && point.value <= 100,
    ),
  );
  assert.ok(
    !manifest.datasets.some(
      (dataset) => dataset.id === "ri08-a0_g07_readiness_matrix",
    ),
  );
  assert.equal(steel.indicators[0].date, "2025-12-31");
  assert.equal(steel.indicators[0].value, 7.41);
  assert.equal(steel.indicators[0].series.length, 34);
  assert.equal(electricity.indicators.length, 1);
  assert.equal(electricity.indicators[0].title, "Значення");
  assert.equal(electricity.indicators[0].series.length, 13);
  assert.deepEqual(
    electricity.indicators[0].series.map(({ year, value }) => ({ year, value })),
    [
      { year: 1990, value: 298.8 },
      { year: 1991, value: 296 },
      { year: 1992, value: 252.5 },
      { year: 1995, value: 194 },
      { year: 1999, value: 171 },
      { year: 2005, value: 186 },
      { year: 2007, value: 195 },
      { year: 2010, value: 188 },
      { year: 2013, value: 193 },
      { year: 2015, value: 146 },
      { year: 2021, value: 156 },
      { year: 2022, value: 113 },
      { year: 2023, value: 102 },
    ],
  );
});

test("RI connection registry is copied into both RI frontend roots", async () => {
  const registry = await readJson(
    "public/data/industrial/dataroom/ri-connections.json",
  );
  const [publicCopy, siteCopy] = await Promise.all([
    readJson("../ri-web/public/data/ukraine-dataroom-connections.json"),
    readJson("../ri-web/site/public/data/ukraine-dataroom-connections.json"),
  ]);

  assert.equal(registry.datasets.length, 222);
  assert.deepEqual(publicCopy, registry);
  assert.deepEqual(siteCopy, registry);
});
