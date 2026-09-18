import test from "node:test";
import assert from "node:assert/strict";
import { startAdminServer, validateReadOnlySql } from "./admin-server.mjs";

test("accepts analytical SQL and rejects mutations", () => {
  assert.equal(
    validateReadOnlySql("SELECT id FROM datasets"),
    "SELECT id FROM datasets",
  );
  assert.equal(
    validateReadOnlySql("WITH recent AS (SELECT 1 AS value) SELECT * FROM recent"),
    "WITH recent AS (SELECT 1 AS value) SELECT * FROM recent",
  );
  assert.throws(
    () => validateReadOnlySql("DELETE FROM datasets"),
    /read-only|Only SELECT/u,
  );
  assert.equal(
    validateReadOnlySql("SELECT raw_json FROM observations LIMIT 1"),
    "SELECT raw_json FROM observations LIMIT 1",
  );
  assert.throws(
    () => validateReadOnlySql("SELECT 1; SELECT 2"),
    /one SQL statement/u,
  );
});

test("serves the local dashboard and read-only database APIs", async (context) => {
  const admin = await startAdminServer({ port: 0 });
  context.after(async () => {
    await admin.close();
    admin.database.close();
  });

  const page = await fetch(admin.url);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /Local Data Lab/u);

  const overviewResponse = await fetch(`${admin.url}../api/overview`);
  assert.equal(overviewResponse.status, 200);
  const overview = await overviewResponse.json();
  assert.equal(overview.datasets.length, 9);
  assert.equal(overview.snapshotCount, 9);
  assert.ok(overview.rawRows > 50_000);

  const datasetResponse = await fetch(
    `${admin.url}../api/dataset?id=incomes`,
  );
  const dataset = await datasetResponse.json();
  assert.equal(dataset.id, "incomes");
  assert.ok(dataset.series.length > 0);
  assert.ok(dataset.snapshots.length > 0);
  assert.ok(dataset.snapshots[0].source_date);

  const snapshot = dataset.snapshots.find((item) => item.row_count > 0);
  const snapshotParameters = new URLSearchParams({
    dataset: snapshot.dataset_id,
    source: snapshot.source_id,
    key: snapshot.snapshot_key,
    limit: "5",
  });
  const snapshotResponse = await fetch(
    `${admin.url}../api/snapshot?${snapshotParameters}`,
  );
  const snapshotPreview = await snapshotResponse.json();
  assert.equal(snapshotResponse.status, 200);
  assert.ok(snapshotPreview.rows.length > 0);
  assert.ok(snapshotPreview.rows.length <= 5);

  const queryResponse = await fetch(`${admin.url}../api/query`, {
    body: JSON.stringify({
      sql: "SELECT COUNT(*) AS dataset_count FROM datasets",
    }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
  const query = await queryResponse.json();
  assert.equal(query.rows[0].dataset_count, 9);

  const rejectedResponse = await fetch(`${admin.url}../api/query`, {
    body: JSON.stringify({ sql: "DROP TABLE datasets" }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
  assert.equal(rejectedResponse.status, 400);
  assert.match((await rejectedResponse.json()).error, /read-only|Only SELECT/u);
});
