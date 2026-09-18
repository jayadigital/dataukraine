import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../../", import.meta.url);
const corners = [
  "nbu",
  "stat",
  "budget",
  "oecd",
  "wb",
  "ilostat",
  "imf",
  "eurostat",
  "comtrade",
  "tradingeconomics",
  "industrial",
  "worldsteel",
  "owid",
];

async function readJson(relativePath) {
  return JSON.parse(await readFile(new URL(relativePath, root), "utf8"));
}

test("every public dataset has bilingual identity, reader guidance and graph codes", async () => {
  let checked = 0;
  for (const corner of corners) {
    const manifest = await readJson(
      `public/data/${corner}/dataroom/manifest.json`,
    );
    for (const dataset of manifest.datasets) {
      assert.ok(dataset.titleUa, `${corner}/${dataset.id} is missing titleUa`);
      assert.ok(dataset.titleEn, `${corner}/${dataset.id} is missing titleEn`);
      assert.match(
        dataset.graphCodeBase,
        /^UA-[A-Z]+-\d{4}$/u,
        `${corner}/${dataset.id} has an invalid graphCodeBase`,
      );
      assert.ok(
        dataset.readerGuide?.ua?.what,
        `${corner}/${dataset.id} is missing the Ukrainian reader guide`,
      );
      assert.ok(
        dataset.readerGuide?.en?.what,
        `${corner}/${dataset.id} is missing the English reader guide`,
      );
      checked += 1;
    }
    const reports = await readJson(`public/data/${corner}/reports/manifest.json`);
    assert.equal(reports.length, 3, `${corner} does not publish three report horizons`);
    const report = await readJson(
      `public/data/${corner}/${reports[0].json.replace(/^\/data\//u, "")}`,
    );
    assert.ok(report.lead, `${corner} report has no lead observation`);
    if (report.datasetGuides) {
      assert.ok(
        report.datasetGuides.length > 0,
        `${corner} report has no dataset explanations`,
      );
    }
  }
  assert.ok(checked >= 2_380, `Only ${checked} datasets were checked`);
});

test("Uconomics carrier text never becomes a negative numeric year", async () => {
  const manifest = await readJson("public/uc/uconomics/dataroom/manifest.json");
  for (const dataset of manifest.datasets) {
    const summary = await readJson(
      `public/uc/uconomics/dataroom/${dataset.id}/summary.json`,
    );
    for (const indicator of summary.indicators ?? []) {
      for (const point of indicator.series ?? []) {
        const carrierText =
          indicator.observationStatus === "carrier-text" ||
          point.qualityFlags?.includes("carrier-text");
        assert.equal(
          carrierText &&
            Number.isInteger(point.value) &&
            point.value >= -2100 &&
            point.value <= -1900,
          false,
          `${dataset.id}/${indicator.id} contains a negative year-like carrier value`,
        );
      }
    }
  }
});

test("F1 scenarios are sourced from the resolved 12_F1_UKRAINE snapshot", async () => {
  const framesManifest = await readJson("public/uc/frames/dataroom/manifest.json");
  const scenariosManifest = await readJson("public/uc/scenarios/dataroom/manifest.json");
  assert.equal(framesManifest.meta.cornerNumber, 15);
  assert.equal(scenariosManifest.meta.cornerNumber, 16);
  assert.equal(scenariosManifest.meta.sourceSnapshot, "/uc/scenarios/f1-ukraine.json");

  const framesF1 = await readJson("public/uc/frames/dataroom/frames-0001/summary.json");
  const scenariosF1 = await readJson("public/uc/scenarios/dataroom/scenarios-0001/summary.json");
  const endpoints = await readJson("public/uc/scenarios/dataroom/scenarios-0002/summary.json");
  assert.equal(framesF1.sourceRange, "12_F1_UKRAINE!A27:G42");
  assert.equal(scenariosF1.sourceRange, "Frames frames-0002 / MAC_GDP_USD + 12_F1_UKRAINE!A26:G42");
  assert.equal(endpoints.sourceRange, "12_F1_UKRAINE!A16:I22");
  assert.ok(scenariosF1.sourceReferences.some((reference) => reference.url.includes("gid=1012#gid=1012")));

  const pointFor = (summary, indicatorId, year) => {
    const indicator = summary.indicators.find((item) => item.idApi === indicatorId);
    return indicator?.series.find((item) => item.year === year)?.value;
  };
  assert.equal(scenariosF1.indicators.length, 5);
  assert.deepEqual(scenariosF1.indicators.map((indicator) => indicator.idApi), ["F1_GDP_S1", "F1_GDP_S2", "F1_GDP_S3", "F1_GDP_S4", "F1_GDP_S5"]);
  assert.equal(pointFor(scenariosF1, "F1_GDP_S1", 2021), 199.7658596);
  assert.equal(pointFor(scenariosF1, "F1_GDP_S2", 2026), 223.06401977837652);
  assert.equal(pointFor(scenariosF1, "F1_GDP_S3", 2040), 474.62696188045123);
  assert.equal(pointFor(scenariosF1, "F1_GDP_S4", 2040), 777.495324743506);
  assert.equal(pointFor(endpoints, "ENDPOINT_S3", 2040), 474.62696188045186);
});
