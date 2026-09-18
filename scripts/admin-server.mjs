import { createServer } from "node:http";
import { DatabaseSync } from "node:sqlite";
import { readFile, stat } from "node:fs/promises";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const corner = process.env.RI_CORNER ?? "budget";
const supportedCorners = [
  "budget",
  "oecd",
  "wb",
  "ilostat",
  "imf",
  "eurostat",
  "comtrade",
  "tradingeconomics",
  "ukraine",
  "industrial",
];
if (!supportedCorners.includes(corner)) {
  throw new Error(`RI_CORNER must be one of: ${supportedCorners.join(", ")}.`);
}
const defaultDatabasePath = resolve(root, `data/${corner}-dataroom.sqlite`);
const adminDirectory = resolve(root, "admin");
const maxQueryRows = 1_000;
const maxPreviewRows = 250;
const seriesIdExpr = `COALESCE(indicator_code, '') || '|' ||
  COALESCE(region_code, '') || '|' ||
  COALESCE(freq, '') || '|' ||
  COALESCE(unit, '')`;

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
};

function json(value) {
  return JSON.stringify(value, (_key, item) => {
    if (typeof item === "bigint") return Number(item);
    if (item instanceof Uint8Array) return `[BLOB ${item.byteLength} bytes]`;
    return item;
  });
}

function sendJson(response, status, payload) {
  response.writeHead(status, {
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(json(payload));
}

function normalizeSql(sql) {
  return sql
    .replace(/^\s*(?:(?:--[^\n]*(?:\n|$))|(?:\/\*[\s\S]*?\*\/)\s*)*/u, "")
    .trim();
}

export function validateReadOnlySql(input) {
  if (typeof input !== "string" || input.trim().length === 0) {
    throw new Error("Enter a SQL query.");
  }

  const normalized = normalizeSql(input);
  const withoutTrailingSemicolon = normalized.replace(/;\s*$/u, "");
  if (withoutTrailingSemicolon.includes(";")) {
    throw new Error("Run one SQL statement at a time.");
  }

  const firstKeyword = withoutTrailingSemicolon
    .match(/^([a-z]+)/iu)?.[1]
    ?.toLocaleLowerCase("en-US");
  if (!["select", "with", "explain", "pragma"].includes(firstKeyword ?? "")) {
    throw new Error("Only SELECT, WITH, EXPLAIN, and safe PRAGMA queries are allowed.");
  }

  if (
    /\b(?:attach|detach|vacuum|reindex|insert|update|delete|drop|alter|create|replace|trigger|analyze)\b/iu.test(
      withoutTrailingSemicolon,
    )
  ) {
    throw new Error("This dashboard is read-only.");
  }

  if (
    firstKeyword === "pragma" &&
    !/^pragma\s+(?:table_info|table_list|database_list|compile_options|integrity_check)\b/iu.test(
      withoutTrailingSemicolon,
    )
  ) {
    throw new Error("That PRAGMA is not available in the read-only workspace.");
  }

  return withoutTrailingSemicolon;
}

function executeSql(database, input) {
  const sql = validateReadOnlySql(input);
  const shouldCap = /^(?:select|with)\b/iu.test(sql) && !/\blimit\s+\d+/iu.test(sql);
  const executableSql = shouldCap ? `${sql}\nLIMIT ${maxQueryRows + 1}` : sql;
  const startedAt = performance.now();
  const statement = database.prepare(executableSql);
  const allRows = statement.all();
  const elapsedMs = performance.now() - startedAt;
  const truncated = allRows.length > maxQueryRows;
  const rows = allRows.slice(0, maxQueryRows);
  const columns =
    rows.length > 0
      ? Object.keys(rows[0])
      : statement.columns().map((column) => column.name);

  return {
    columns,
    elapsedMs: Number(elapsedMs.toFixed(2)),
    rowCount: rows.length,
    rows,
    truncated,
  };
}

function parseDataset(row) {
  return {
    category: row.category,
    description: `${row.flow_id} / ${row.fetch_mode}`,
    fieldCount: row.field_count,
    frequency: row.cadence,
    id: row.id,
    latestDate: row.latest_date ?? row.coverage_end,
    number: row.number,
    question: row.limitation ?? "Open the parameters and compare the time series.",
    rowCount: row.row_count,
    status: "live",
    title: row.title,
  };
}

async function readRequestJson(request) {
  const chunks = [];
  let byteCount = 0;
  for await (const chunk of request) {
    byteCount += chunk.length;
    if (byteCount > 64 * 1024) throw new Error("Request body is too large.");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function requireParam(url, key) {
  const value = url.searchParams.get(key);
  if (!value) throw new Error(`Missing ${key}.`);
  return value;
}

function datasetRows(database) {
  return database
    .prepare(
      `SELECT d.id,
              d.number,
              d.title,
              d.category,
              d.frequency AS cadence,
              d.fetch_mode,
              d.flow_id,
              d.coverage_start,
              d.coverage_end,
              d.fetched_at,
              d.limitation,
              d.row_count,
              COALESCE((SELECT MAX(date)
                        FROM observations o
                        WHERE o.dataset_id = d.id), d.coverage_end) AS latest_date,
              COALESCE((SELECT COUNT(DISTINCT component_id)
                        FROM availability_values av
                        WHERE av.dataset_id = d.id), 0) AS field_count
       FROM datasets d
       ORDER BY d.number`,
    )
    .all();
}

function overview(database, databaseBytes) {
  const datasets = datasetRows(database).map(parseDataset);
  const observationStats = database
    .prepare(
      `SELECT COUNT(*) AS point_count,
              COUNT(DISTINCT dataset_id || ':' ||
                COALESCE(indicator_code, '') || ':' ||
                COALESCE(region_code, '') || ':' ||
                COALESCE(freq, '') || ':' ||
                COALESCE(unit, '')) AS series_count
       FROM observations`,
    )
    .get();
  const release = database
    .prepare("SELECT MAX(fetched_at) AS generated_at, SUM(row_count) AS raw_rows FROM datasets")
    .get();

  return {
    databaseBytes,
    datasets,
    generatedAt: release.generated_at,
    rawBytes: databaseBytes,
    rawRows: release.raw_rows ?? observationStats.point_count,
    seriesCount: observationStats.series_count,
    seriesPointCount: observationStats.point_count,
    snapshotCount: datasets.length,
  };
}

function datasetDetails(database, datasetId) {
  const row = database
    .prepare(
      `SELECT d.id,
              d.number,
              d.title,
              d.category,
              d.frequency AS cadence,
              d.fetch_mode,
              d.flow_id,
              d.source_url,
              d.coverage_start,
              d.coverage_end,
              d.fetched_at,
              d.limitation,
              d.row_count,
              COALESCE((SELECT MAX(date)
                        FROM observations o
                        WHERE o.dataset_id = d.id), d.coverage_end) AS latest_date,
              COALESCE((SELECT COUNT(DISTINCT component_id)
                        FROM availability_values av
                        WHERE av.dataset_id = d.id), 0) AS field_count
       FROM datasets d
       WHERE d.id = ?`,
    )
    .get(datasetId);
  if (!row) return null;

  const series = database
    .prepare(
      `SELECT ${seriesIdExpr} AS series_id,
              TRIM(COALESCE(indicator_label, indicator_code, 'Observation') ||
                CASE
                  WHEN region_label IS NOT NULL
                    AND region_code IS NOT NULL
                    AND region_code <> 'UA00000000000000000'
                  THEN ' / ' || region_label
                  ELSE ''
                END) AS title,
              COALESCE(unit, 'значення') AS unit,
              MIN(date) AS first_period,
              MAX(date) AS last_period,
              COUNT(*) AS point_count
       FROM observations
       WHERE dataset_id = ? AND value IS NOT NULL
       GROUP BY series_id, title, unit
       HAVING point_count >= 2
       ORDER BY point_count DESC, last_period DESC, title
       LIMIT 250`,
    )
    .all(datasetId);

  const snapshots = [
    {
      dataset_id: row.id,
      source_id: row.flow_id,
      snapshot_key: row.fetch_mode,
      source_url: row.source_url,
      source_date: row.latest_date,
      fetched_at: row.fetched_at,
      row_count: row.row_count,
      byte_count: 0,
    },
  ];

  return {
    ...parseDataset(row),
    series,
    snapshots,
    summary: {
      coverageStart: row.coverage_start,
      coverageEnd: row.coverage_end,
      fetchMode: row.fetch_mode,
      flowId: row.flow_id,
      limitation: row.limitation,
    },
  };
}

function seriesPoints(database, url) {
  const datasetId = requireParam(url, "dataset");
  const seriesId = requireParam(url, "series");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const conditions = ["dataset_id = ?", `${seriesIdExpr} = ?`, "value IS NOT NULL"];
  const parameters = [datasetId, seriesId];

  if (from) {
    conditions.push("date >= ?");
    parameters.push(from);
  }
  if (to) {
    conditions.push("date <= ?");
    parameters.push(to);
  }

  const rows = database
    .prepare(
      `SELECT date AS period,
              value,
              COALESCE(indicator_label, indicator_code, 'Observation') AS title,
              COALESCE(unit, 'значення') AS unit
       FROM observations
       WHERE ${conditions.join(" AND ")}
       ORDER BY date
       LIMIT 5000`,
    )
    .all(...parameters);

  return {
    datasetId,
    points: rows,
    seriesId,
  };
}

function rawRows(database, url) {
  const datasetId = requireParam(url, "dataset");
  const limit = Math.min(
    maxPreviewRows,
    Math.max(1, Number(url.searchParams.get("limit") ?? 50)),
  );
  const offset = Math.max(0, Number(url.searchParams.get("offset") ?? 0));
  const rows = database
    .prepare(
      `SELECT raw_json
       FROM observations
       WHERE dataset_id = ?
       ORDER BY date DESC, id DESC
       LIMIT ? OFFSET ?`,
    )
    .all(datasetId, limit, offset)
    .map((row) => JSON.parse(row.raw_json));
  const total = database
    .prepare("SELECT COUNT(*) AS count FROM observations WHERE dataset_id = ?")
    .get(datasetId);

  return {
    offset,
    rows,
    totalRows: total.count,
  };
}

async function serveStatic(response, pathname) {
  const filenames = {
    "/admin": "index.html",
    "/admin/": "index.html",
    "/admin/admin.css": "admin.css",
    "/admin/admin.js": "admin.js",
  };
  const filename = filenames[pathname];
  if (!filename) return false;

  const path = join(adminDirectory, filename);
  const body = await readFile(path);
  response.writeHead(200, {
    "Cache-Control": "no-store",
    "Content-Type": mimeTypes[extname(filename)] ?? "application/octet-stream",
  });
  response.end(body);
  return true;
}

export async function startAdminServer({
  databasePath = defaultDatabasePath,
  host = "127.0.0.1",
  port = Number(process.env.RI_ADMIN_PORT ?? 4174),
} = {}) {
  const database = new DatabaseSync(databasePath, { readOnly: true });
  database.exec("PRAGMA query_only = ON; PRAGMA busy_timeout = 3000;");
  const databaseBytes = (await stat(databasePath)).size;

  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? "/", `http://${request.headers.host}`);

      if (url.pathname === "/") {
        response.writeHead(302, { Location: "/admin/" });
        response.end();
        return;
      }
      if (url.pathname === "/favicon.ico") {
        response.writeHead(204);
        response.end();
        return;
      }
      if (await serveStatic(response, url.pathname)) return;

      if (request.method === "GET" && url.pathname === "/api/health") {
        sendJson(response, 200, {
          database: databasePath,
          mode: "read-only",
          ok: true,
          service: `ri-${corner}-local-admin`,
          corner,
        });
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/overview") {
        sendJson(response, 200, overview(database, databaseBytes));
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/dataset") {
        const details = datasetDetails(database, requireParam(url, "id"));
        if (!details) {
          sendJson(response, 404, { error: "Dataset not found." });
          return;
        }
        sendJson(response, 200, details);
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/series") {
        sendJson(response, 200, seriesPoints(database, url));
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/snapshot") {
        const datasetId = requireParam(url, "dataset");
        const result = rawRows(database, url);
        const metadata = database
          .prepare(
            `SELECT id AS datasetId,
                    flow_id AS sourceId,
                    fetch_mode AS snapshotKey,
                    source_url AS sourceUrl,
                    fetched_at AS fetchedAt,
                    row_count AS rowCount
             FROM datasets
             WHERE id = ?`,
          )
          .get(datasetId);
        if (!metadata) {
          sendJson(response, 404, { error: "Dataset not found." });
          return;
        }

        if (url.searchParams.get("download") === "1") {
          const filename = `${datasetId}-sdmx-sample`
            .replace(/[^a-z0-9_-]+/giu, "-")
            .slice(0, 140);
          response.writeHead(200, {
            "Content-Disposition": `attachment; filename="${filename}.json"`,
            "Content-Type": "application/json; charset=utf-8",
          });
          response.end(json(result.rows));
          return;
        }

        sendJson(response, 200, {
          metadata: {
            byteCount: databaseBytes,
            datasetId,
            fetchedAt: metadata.fetchedAt,
            rowCount: metadata.rowCount,
            snapshotKey: metadata.snapshotKey,
            sourceDate: null,
            sourceId: metadata.sourceId,
            sourceUrl: metadata.sourceUrl,
          },
          ...result,
        });
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/query") {
        const body = await readRequestJson(request);
        sendJson(response, 200, executeSql(database, body.sql));
        return;
      }

      sendJson(response, 404, { error: "Route not found." });
    } catch (error) {
      sendJson(response, 400, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  await new Promise((resolvePromise, reject) => {
    server.once("error", reject);
    server.listen(port, host, resolvePromise);
  });

  const address = server.address();
  const actualPort = typeof address === "object" && address ? address.port : port;
  return {
    close: () =>
      new Promise((resolvePromise, reject) => {
        server.close((error) => (error ? reject(error) : resolvePromise()));
      }),
    database,
    server,
    url: `http://${host}:${actualPort}/admin/`,
  };
}

const isMain =
  process.argv[1] &&
  resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (isMain) {
  const admin = await startAdminServer();
  console.log(`RI ${corner.toUpperCase()} Local Data Lab: ${admin.url}`);
  console.log("Read-only SQLite access. Press Ctrl+C to stop.");

  const close = async () => {
    await admin.close();
    admin.database.close();
    process.exit(0);
  };
  process.once("SIGINT", close);
  process.once("SIGTERM", close);
}
