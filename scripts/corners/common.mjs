import { DatabaseSync } from "node:sqlite";
import {
  mkdir,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { dataRoot, publicRoot, root } from "./common-paths.mjs";
import { localizeDataset } from "./localization.mjs";

export { dataRoot, publicRoot, root };
export const generatedAt = new Date().toISOString();
const chunkSize = 1_000;
const graphPrefixes = {
  budget: "BUD",
  oecd: "OECD",
  wb: "WB",
  ilostat: "ILO",
  imf: "IMF",
  eurostat: "EURO",
  comtrade: "TRADE",
  tradingeconomics: "TE",
  industrial: "RI",
  worldsteel: "WSA",
  owid: "OWID",
  uconomics: "UCO",
  ukraine: "CORE",
};

function graphCode(corner, datasetNumber, graphNumber) {
  const dataset = String(datasetNumber).padStart(4, "0");
  const graph = String(graphNumber).padStart(2, "0");
  return `UA-${graphPrefixes[corner] ?? String(corner).toUpperCase()}-${dataset}-G${graph}`;
}

export const cornerMeta = {
  budget: {
    source: "Open Budget України",
    sourceUrl: "https://api.openbudget.gov.ua/swagger-ui.html",
    storageModel: "SQLite annual execution snapshots + bounded JSON/CSV",
  },
  oecd: {
    source: "OECD Data Explorer",
    sourceUrl: "https://www.oecd.org/en/data/insights/data-explainers/2024/09/api.html",
    storageModel: "SQLite SDMX observations + bounded JSON/CSV",
  },
  wb: {
    source: "World Bank Data360",
    sourceUrl: "https://data360.worldbank.org/en/api",
    storageModel: "SQLite Data360 WDI observations + bounded JSON/CSV",
  },
  ilostat: {
    source: "ILOSTAT",
    sourceUrl: "https://rplumber.ilo.org/__docs__/",
    storageModel: "SQLite annual Ukraine labour observations + bounded JSON/CSV",
  },
  imf: {
    source: "IMF DataMapper",
    sourceUrl: "https://www.imf.org/external/datamapper/api/",
    storageModel: "SQLite IMF annual observations and projections + bounded JSON/CSV",
  },
  eurostat: {
    source: "Eurostat",
    sourceUrl: "https://ec.europa.eu/eurostat/web/user-guides/data-browser/api-data-access/",
    storageModel: "SQLite annual Ukraine JSON-stat observations + bounded JSON/CSV",
  },
  comtrade: {
    source: "UN Comtrade",
    sourceUrl: "https://unstats.un.org/unsd/api/",
    storageModel: "SQLite annual merchandise trade observations + bounded JSON/CSV",
  },
  tradingeconomics: {
    source: "Trading Economics",
    sourceUrl: "https://docs.tradingeconomics.com/forecasts/indicators/",
    storageModel: "SQLite public forecast snapshots + credential-ready API ingestion",
  },
  industrial: {
    source: "RI Industrial Dataroom",
    sourceUrl: "https://industrial.proto.fund",
    storageModel: "SQLite graph registry from RI evidence, model and scenario buckets 08-11",
  },
  worldsteel: {
    source: "World Steel Association",
    sourceUrl: "https://worldsteel.org/data/world-steel-in-figures/",
    storageModel: "Worldsteel public viewer snapshots + bounded JSON/CSV",
  },
  owid: {
    source: "Our World in Data",
    sourceUrl: "https://ourworldindata.org/",
    storageModel: "OWID Grapher CSV snapshots + bounded JSON/CSV",
  },
  uconomics: {
    source: "Uconomics 0.1",
    sourceUrl: "https://dataukraine.proto.fund/corner/uconomics",
    storageModel: "Flat normalized Markdown, JSON and CSV article-graph release",
  },
  ukraine: {
    source: "Ukraine Dataroom",
    sourceUrl: "https://dataukraine.proto.fund",
    storageModel: "13 source SQLite warehouses + semantic registry + bounded universal files",
  },
};

export function slugify(value) {
  return String(value)
    .normalize("NFKD")
    .replace(/[^\w]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 100);
}

export function parseCsv(text, delimiter = ",") {
  const lines = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (quoted) {
      if (char === '"' && next === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === delimiter) {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      if (row.some((item) => item !== "")) lines.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }
  if (field || row.length) {
    row.push(field);
    if (row.some((item) => item !== "")) lines.push(row);
  }
  if (!lines.length) return [];
  const fields = lines[0].map((item) => item.trim());
  return lines.slice(1).map((items) =>
    Object.fromEntries(fields.map((fieldName, index) => [fieldName, items[index] ?? ""])),
  );
}

export function toNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(String(value).replace(/\s+/g, "").replace(",", "."));
  return Number.isFinite(number) ? number : null;
}

export function periodToDate(period) {
  const text = String(period ?? "");
  if (/^\d{4}$/.test(text)) return `${text}-12-31`;
  const budget = text.match(/^(\d{2})\.(\d{4})$/);
  if (budget) {
    const day = new Date(Date.UTC(Number(budget[2]), Number(budget[1]), 0))
      .getUTCDate();
    return `${budget[2]}-${budget[1]}-${String(day).padStart(2, "0")}`;
  }
  const month = text.match(/^(\d{4})-M?(\d{2})$/);
  if (month) return `${month[1]}-${month[2]}-01`;
  const quarter = text.match(/^(\d{4})-?Q([1-4])$/i);
  if (quarter) {
    const monthNumber = Number(quarter[2]) * 3;
    const day = new Date(Date.UTC(Number(quarter[1]), monthNumber, 0)).getUTCDate();
    return `${quarter[1]}-${String(monthNumber).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  return text.slice(0, 10);
}

export function escapeCsv(value) {
  if (value === null || value === undefined) return "";
  const text = typeof value === "object" ? JSON.stringify(value) : String(value);
  return /[",;\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function toCsv(rows, fields) {
  return [
    fields.map(escapeCsv).join(","),
    ...rows.map((row) => fields.map((field) => escapeCsv(row[field])).join(",")),
  ].join("\n");
}

export async function fetchCached(url, cacheKey, options = {}) {
  const path = resolve(dataRoot, "cache", cacheKey);
  if (process.env.RI_REFRESH !== "1") {
    try {
      return await readFile(path);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  const response = await fetch(url, {
    ...options,
    headers: {
      "user-agent": "RI Country Data Corners/0.1",
      ...(options.headers ?? {}),
    },
  });
  const body = Buffer.from(await response.arrayBuffer());
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}: ${body.toString("utf8").slice(0, 500)}`);
  }
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, body);
  return body;
}

export async function mapConcurrent(items, concurrency, mapper) {
  const results = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await mapper(items[index], index);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
  );
  return results;
}

export async function createCornerDatabase(corner) {
  await mkdir(dataRoot, { recursive: true });
  const databasePath = resolve(dataRoot, `${corner}-dataroom.sqlite`);
  const db = new DatabaseSync(databasePath);
  db.exec(`
    PRAGMA journal_mode = DELETE;
    PRAGMA synchronous = NORMAL;
    DROP TABLE IF EXISTS entities;
    DROP TABLE IF EXISTS observations;
    DROP TABLE IF EXISTS availability_values;
    DROP TABLE IF EXISTS datasets;
    CREATE TABLE datasets (
      id TEXT PRIMARY KEY,
      number INTEGER NOT NULL,
      flow_id TEXT NOT NULL,
      version TEXT NOT NULL,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      frequency TEXT NOT NULL,
      priority TEXT NOT NULL,
      official_url TEXT NOT NULL,
      source_url TEXT NOT NULL,
      fetch_mode TEXT NOT NULL,
      series_count INTEGER,
      coverage_start TEXT,
      coverage_end TEXT,
      fetched_at TEXT NOT NULL,
      row_count INTEGER NOT NULL,
      limitation TEXT,
      description TEXT,
      question TEXT,
      why TEXT,
      annualization TEXT
    );
    CREATE TABLE availability_values (
      dataset_id TEXT NOT NULL,
      component_id TEXT NOT NULL,
      code TEXT NOT NULL,
      label TEXT,
      PRIMARY KEY (dataset_id, component_id, code)
    );
    CREATE TABLE observations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dataset_id TEXT NOT NULL,
      flow_id TEXT NOT NULL,
      time_period TEXT NOT NULL,
      date TEXT NOT NULL,
      year INTEGER,
      value REAL,
      indicator_code TEXT,
      indicator_label TEXT,
      region_code TEXT,
      region_label TEXT,
      freq TEXT,
      unit TEXT,
      action TEXT,
      dims_json TEXT NOT NULL,
      attrs_json TEXT NOT NULL,
      raw_json TEXT NOT NULL
    );
    CREATE TABLE entities (
      dataset_id TEXT NOT NULL,
      entity_code TEXT NOT NULL,
      entity_name TEXT,
      region_code TEXT,
      valid_from TEXT,
      valid_to TEXT,
      raw_json TEXT NOT NULL
    );
    CREATE INDEX observations_dataset_date ON observations(dataset_id, date);
    CREATE INDEX observations_dataset_indicator ON observations(dataset_id, indicator_code);
    CREATE INDEX observations_dataset_region ON observations(dataset_id, region_code);
    CREATE INDEX entities_dataset_region ON entities(dataset_id, region_code);
  `);
  return { db, databasePath };
}

export function insertDatasets(db, datasets) {
  const insertDataset = db.prepare(`
    INSERT INTO datasets (
      id, number, flow_id, version, title, category, frequency, priority,
      official_url, source_url, fetch_mode, series_count, coverage_start,
      coverage_end, fetched_at, row_count, limitation, description, question,
      why, annualization
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertObservation = db.prepare(`
    INSERT INTO observations (
      dataset_id, flow_id, time_period, date, year, value, indicator_code,
      indicator_label, region_code, region_label, freq, unit, action,
      dims_json, attrs_json, raw_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertAvailability = db.prepare(`
    INSERT OR REPLACE INTO availability_values
      (dataset_id, component_id, code, label)
    VALUES (?, ?, ?, ?)
  `);
  const insertEntity = db.prepare(`
    INSERT INTO entities
      (dataset_id, entity_code, entity_name, region_code, valid_from, valid_to, raw_json)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  db.exec("BEGIN");
  try {
    for (const dataset of datasets) {
      const dates = dataset.rows.map((row) => row.date).filter(Boolean).sort();
      const seriesCount = new Set(
        dataset.rows.map((row) => `${row.indicatorCode}|${row.regionCode ?? ""}|${row.unit ?? ""}`),
      ).size;
      insertDataset.run(
        dataset.id,
        dataset.number,
        dataset.flowId,
        dataset.version ?? "1",
        dataset.title,
        dataset.category,
        dataset.frequency ?? "Річна",
        dataset.priority ?? "deep",
        dataset.officialUrl,
        dataset.sourceUrl,
        dataset.fetchMode ?? "complete annual history",
        seriesCount,
        dates[0] ?? null,
        dates.at(-1) ?? null,
        generatedAt,
        dataset.rows.length,
        dataset.limitation ?? null,
        dataset.description,
        dataset.question,
        dataset.why,
        dataset.annualization,
      );
      for (const row of dataset.rows) {
        insertObservation.run(
          dataset.id,
          dataset.flowId,
          row.timePeriod,
          row.date,
          Number(row.date?.slice(0, 4)) || null,
          row.value,
          row.indicatorCode,
          row.indicatorLabel,
          row.regionCode ?? null,
          row.regionLabel ?? null,
          row.freq ?? "A",
          row.unit ?? "значення",
          row.action ?? "I",
          JSON.stringify(row.dimensions ?? {}),
          JSON.stringify(row.attributes ?? {}),
          JSON.stringify(row.raw ?? row),
        );
      }
      for (const [component, values] of Object.entries(dataset.availability ?? {})) {
        for (const value of values) {
          insertAvailability.run(
            dataset.id,
            component,
            String(value.code ?? value),
            String(value.label ?? value.code ?? value),
          );
        }
      }
      for (const entity of dataset.entities ?? []) {
        insertEntity.run(
          dataset.id,
          entity.code,
          entity.name,
          entity.regionCode ?? null,
          entity.validFrom ?? null,
          entity.validTo ?? null,
          JSON.stringify(entity.raw ?? entity),
        );
      }
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

function round(value, digits = 4) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function formatValue(value, unit) {
  if (!Number.isFinite(value)) return "—";
  if (unit === "%") return `${round(value, 2).toLocaleString("uk-UA")}%`;
  if (/млрд грн/i.test(unit)) {
    return `${round(value, 1).toLocaleString("uk-UA")} млрд грн`;
  }
  if (/USD/i.test(unit) && Math.abs(value) >= 1_000_000_000) {
    return `$${round(value / 1_000_000_000, 1).toLocaleString("uk-UA")} млрд`;
  }
  if (/грн|UAH/i.test(unit) && Math.abs(value) >= 1_000_000_000) {
    return `${round(value / 1_000_000_000, 1).toLocaleString("uk-UA")} млрд грн`;
  }
  return round(value, 2).toLocaleString("uk-UA");
}

function metricFormat(unit) {
  if (unit === "%") return "percent";
  if (/USD/i.test(unit)) return "usd_billion";
  if (/грн|UAH/i.test(unit)) return "uah_billion";
  return "decimal";
}

function schemaFromRows(rows) {
  const samples = rows.slice(0, 2_000);
  const fields = new Set(samples.flatMap((row) => Object.keys(row.raw ?? {})));
  return [...fields].map((field) => {
    const values = samples
      .map((row) => row.raw?.[field])
      .filter((value) => value !== null && value !== undefined && value !== "");
    const numeric = values.length > 0 && values.every((value) => toNumber(value) !== null);
    return {
      field,
      label: field.replaceAll("_", " "),
      description: `Офіційний параметр ${field} у відповіді джерела.`,
      type: numeric ? "number" : "text",
      coverage: samples.length ? round((values.length / samples.length) * 100, 1) : 0,
      nulls: samples.length - values.length,
      examples: [...new Set(values.map(String))].slice(0, 3),
    };
  });
}

const temporalDimensionKeys = new Set([
  "auctiondate",
  "date",
  "dt",
  "exchangedate",
  "horizon",
  "labels",
  "paydate",
  "period",
  "rep_period",
  "repaydate",
  "time",
  "time_period",
  "top_10_latest",
  "year",
]);

function semanticDimensions(dimensions) {
  return Object.fromEntries(
    Object.entries(dimensions ?? {})
      .filter(([key]) => !temporalDimensionKeys.has(key.toLocaleLowerCase()))
      .sort(([left], [right]) => left.localeCompare(right)),
  );
}

function seriesGroups(rows, minimumPoints = 2) {
  const groups = new Map();
  for (const row of rows) {
    if (!Number.isFinite(row.value)) continue;
    const dimensions = semanticDimensions(row.dimensions);
    const dimensionKey = JSON.stringify(dimensions);
    const key = `${row.indicatorCode}|${row.regionCode ?? ""}|${row.unit ?? ""}|${dimensionKey}`;
    const current = groups.get(key) ?? {
      id: key,
      indicatorCode: row.indicatorCode,
      title: row.indicatorLabel || row.indicatorCode,
      unit: row.unit || "значення",
      points: [],
      dimensions,
    };
    current.points.push({
      date: row.date,
      year: Number(row.date.slice(0, 4)),
      label: row.pointLabel,
      value: round(row.value),
      partial: Boolean(row.partial),
      asOf: row.asOf ?? null,
      forecast: row.action === "F",
      freq: row.freq ?? "A",
      qualityFlags: row.qualityFlags ?? [],
    });
    groups.set(key, current);
  }
  return [...groups.values()]
    .map((group) => {
      const unique = new Map();
      const ordered = group.points.some((point) => point.label)
        ? group.points
        : group.points.sort((a, b) => a.date.localeCompare(b.date));
      for (const point of ordered) {
        unique.set(point.label ? `${point.date}|${point.label}` : point.date, point);
      }
      return { ...group, points: [...unique.values()] };
    })
    .filter((group) => group.points.length >= minimumPoints)
    .sort((a, b) => {
      if (b.points.length !== a.points.length) return b.points.length - a.points.length;
      return Math.abs(b.points.at(-1).value) - Math.abs(a.points.at(-1).value);
    });
}

function qualityForSeries(series, unit) {
  const flags = new Set(series.flatMap((point) => point.qualityFlags ?? []));
  if (/^\d{3,}$/u.test(String(unit ?? "").trim())) flags.add("coded-unit");
  const current = series.at(-1);
  const previous = series.at(-2);
  if (!current || !previous) flags.add("no-comparison");
  if (current?.gapBefore) flags.add("series-gap");
  if (current?.forecast) flags.add("forecast");
  if (current?.partial) flags.add("partial-period");
  if (current && previous && previous.value !== 0) {
    const change = Math.abs((current.value - previous.value) / previous.value);
    const history = series.slice(Math.max(0, series.length - 7), -1)
      .map((point) => Math.abs(point.value))
      .filter((value) => value > 0)
      .sort((left, right) => left - right);
    const median = history.length
      ? history[Math.floor(history.length / 2)]
      : Math.abs(previous.value);
    if (change > 2 && median > 0 && Math.abs(current.value) / median > 3) {
      flags.add("structural-break");
    }
  }
  const comparable = ![
    "coded-unit",
    "no-comparison",
    "series-gap",
    "forecast",
    "partial-period",
    "structural-break",
    "incomparable",
  ].some((flag) => flags.has(flag));
  return {
    status: comparable ? "comparable" : "review",
    comparable,
    flags: [...flags],
  };
}

function indicatorFromGroup(dataset, group, index) {
  const latest = group.points.at(-1);
  const quality = qualityForSeries(group.points, group.unit);
  return {
    id: `${dataset.id}-${index + 1}`,
    seriesKey: group.id,
    sourceId: dataset.flowId,
    sourceLabel: dataset.title,
    idApi: group.indicatorCode,
    title: group.title,
    value: latest.value,
    date: latest.date,
    partial: latest.partial,
    unit: group.unit,
    measureField: "value",
    dimensions: group.dimensions,
    series: group.points,
    notes: [
      dataset.annualization,
      ...(latest.partial ? ["Поточний рік є попереднім: використано останній доступний період."] : []),
    ],
    observationStatus: latest.partial ? "last-published" : "latest",
    sourceLatestDate: latest.date,
    quality,
  };
}

function levelFor(deltaPct) {
  if (deltaPct === null || Math.abs(deltaPct) < 1) return "stable";
  if (Math.abs(deltaPct) >= 20) return "critical";
  if (Math.abs(deltaPct) >= 7) return "watch";
  return "context";
}

function descriptionForField(field) {
  const descriptions = {
    OBS_VALUE: "Числове значення показника.",
    TIME_PERIOD: "Період, до якого належить значення.",
    REP_PERIOD: "Місяць і рік бюджетного звіту.",
    DONE_PERIOD_AMT: "Виконано від початку року до цього звітного місяця.",
    PLAN_CORR_YEAR_AMT: "Уточнений план на весь рік.",
    BUDG_TYP: "Рівень бюджету: державний, місцевий або зведений.",
    FUND_TYP: "Фонд: загальний, спеціальний або разом.",
  };
  return descriptions[field] ?? `Параметр ${field} з офіційної схеми джерела.`;
}

export async function buildPublicRelease(corner, db, datasets, failures = []) {
  const meta = cornerMeta[corner];
  const nextRoot = resolve(publicRoot, `${corner}.next`);
  const liveRoot = resolve(publicRoot, corner);
  await rm(nextRoot, { recursive: true, force: true });
  await mkdir(resolve(nextRoot, "dataroom"), { recursive: true });
  await mkdir(resolve(nextRoot, "reports"), { recursive: true });

  const cards = [];
  const coverageDatasets = [];
  const dashboardMetrics = [];
  const allowEmptyUconomicsArticles = corner === "uconomics";

  for (const sourceDataset of datasets) {
    const dataset = localizeDataset(sourceDataset, corner);
    const groups = seriesGroups(
      dataset.rows,
      corner === "ukraine" || corner === "uconomics" ? 1 : 2,
    );
    if (!groups.length && !allowEmptyUconomicsArticles) {
      failures.push({
        id: dataset.id,
        error: "excluded-no-temporal-series: no numeric series has at least two distinct published periods",
      });
      continue;
    }
    const indicatorLimit = corner === "industrial"
      ? 60
      : corner === "owid"
        ? 40
        : corner === "worldsteel"
          ? 16
          : 6;
    const indicators = groups.slice(0, indicatorLimit).map((group, index) => ({
      ...indicatorFromGroup(dataset, group, index),
      graphCode: graphCode(corner, dataset.number, index + 1),
    }));
    const latestDate = dataset.rows.map((row) => row.date).filter(Boolean).sort().at(-1) ?? null;
    const latestRows = dataset.rows.filter((row) => row.date === latestDate);
    const fallbackFacts = dataset.fallbackFacts ?? [];
    const schema = schemaFromRows(dataset.rows).map((field) => ({
      ...field,
      description: descriptionForField(field.field),
    }));
    const datasetRoot = resolve(nextRoot, "dataroom", dataset.id);
    await mkdir(datasetRoot, { recursive: true });

    const rawFields = [...new Set(latestRows.flatMap((row) => Object.keys(row.raw ?? {})))];
    const jsonChunks = [];
    const csvChunks = [];
    for (let index = 0; index < latestRows.length; index += chunkSize) {
      const slice = latestRows.slice(index, index + chunkSize).map((row) => ({
        source: dataset.flowId,
        ...(row.raw ?? {}),
      }));
      const part = String(index / chunkSize + 1).padStart(3, "0");
      await writeFile(resolve(datasetRoot, `latest-${part}.json`), `${JSON.stringify(slice)}\n`);
      await writeFile(resolve(datasetRoot, `latest-${part}.csv`), `${toCsv(slice, ["source", ...rawFields])}\n`);
      jsonChunks.push({
        url: `/data/dataroom/${dataset.id}/latest-${part}.json`,
        rows: slice.length,
      });
      csvChunks.push({
        url: `/data/dataroom/${dataset.id}/latest-${part}.csv`,
        rows: slice.length,
      });
    }

    const annualRows = groups.flatMap((group) =>
      group.points.map((point) => ({
        indicator_code: group.indicatorCode,
        indicator: group.title,
        label: point.label ?? "",
        date: point.date,
        year: point.year,
        value: point.value,
        unit: group.unit,
        partial: point.partial ? "true" : "false",
        forecast: point.forecast ? "true" : "false",
      })),
    );
    await writeFile(
      resolve(datasetRoot, "annual.csv"),
      `${toCsv(annualRows, ["indicator_code", "indicator", "label", "date", "year", "value", "unit", "partial", "forecast"])}\n`,
    );
    await writeFile(resolve(datasetRoot, "schema.json"), `${JSON.stringify(schema, null, 2)}\n`);

    const regionalPerspective = dataset.regionalPerspective ?? {
      available: false,
      field: null,
      codeSystem: null,
      description: null,
      joinNote: null,
      regionCount: 0,
      rowCount: 0,
      seriesCount: 0,
      regions: [],
    };
    if (regionalPerspective.available) {
      await writeFile(
        resolve(datasetRoot, "regions.json"),
        `${JSON.stringify(regionalPerspective, null, 2)}\n`,
      );
    }
    const coverage = [{
      id: dataset.flowId,
      label: dataset.title,
      status: "included",
      description: dataset.description,
      availability: `${dataset.rows.length.toLocaleString("uk-UA")} нормалізованих спостережень`,
      limitation: dataset.limitation ?? null,
      latestDate,
      latestRows: latestRows.length,
      latestUrl: dataset.sourceUrl,
      cadence: dataset.frequency,
      chartedPoints: annualRows.length,
      cache: {
        snapshots: new Set(dataset.rows.map((row) => row.timePeriod)).size,
        rows: dataset.rows.length,
        bytes: Buffer.byteLength(JSON.stringify(dataset.rows)),
      },
      annualSnapshots: {
        count: new Set(dataset.rows.map((row) => row.date.slice(0, 4))).size,
        firstYear: Number(dataset.rows.map((row) => row.date.slice(0, 4)).sort()[0]) || null,
        lastYear: Number(dataset.rows.map((row) => row.date.slice(0, 4)).sort().at(-1)) || null,
        rows: annualRows.length,
      },
    }];
    const summary = {
      id: dataset.id,
      number: dataset.number,
      graphCodeBase: graphCode(corner, dataset.number, 1).replace(/-G01$/u, ""),
      flowId: dataset.flowId,
      title: dataset.title,
      titleOriginal: dataset.titleOriginal,
      titleUa: dataset.titleUa,
      titleEn: dataset.titleEn,
      originalLanguage: dataset.originalLanguage,
      category: dataset.category,
      frequency: dataset.frequency,
      coverageStart: dataset.rows.map((row) => row.date).sort()[0] ?? null,
      priority: dataset.priority,
      status: fallbackFacts.length && !indicators.length ? "facts" : "live",
      presentation: indicators.length ? "chart" : "facts",
      fallbackFacts,
      annualization: dataset.annualization,
      endpoint: dataset.sourceUrl,
      description: dataset.description,
      descriptionUa: dataset.descriptionUa,
      descriptionEn: dataset.descriptionEn,
      question: dataset.question,
      why: dataset.why,
      readerGuide: dataset.readerGuide,
      lineage: dataset.lineage ?? null,
      freshness: {
        generatedAt,
        latestDate,
        rowCount: dataset.rows.length,
        bytes: Buffer.byteLength(JSON.stringify(dataset.rows)),
        sources: [{
          id: dataset.flowId,
          label: dataset.title,
          latestDate,
          rowCount: dataset.rows.length,
          url: dataset.sourceUrl,
        }],
      },
      schema,
      indicators,
      presentation: indicators.length ? "chart" : "facts",
      fallbackFacts,
      coverage,
      regionalPerspective,
      exports: {
        jsonChunks,
        csvChunks,
        annualCsv: `/data/dataroom/${dataset.id}/annual.csv`,
        regionsJson: regionalPerspective.available
          ? `/data/dataroom/${dataset.id}/regions.json`
          : null,
      },
    };
    await writeFile(resolve(datasetRoot, "summary.json"), `${JSON.stringify(summary)}\n`);
    await writeFile(
      resolve(datasetRoot, "README.md"),
      `# ${dataset.titleUa}\n\n${dataset.descriptionUa}\n\n## Пояснення\n\n${dataset.readerGuide.ua.what}\n\n${dataset.readerGuide.ua.how}\n\n${dataset.readerGuide.ua.use}\n\n${dataset.readerGuide.ua.caution}\n\n## English\n\n# ${dataset.titleEn}\n\n${dataset.descriptionEn}\n\n${dataset.readerGuide.en.what}\n\n${dataset.readerGuide.en.how}\n\n${dataset.readerGuide.en.use}\n\n${dataset.readerGuide.en.caution}\n\n## Метод\n\n${dataset.annualization}\n\n## Джерело\n\n${dataset.sourceUrl}\n`,
    );

    const lead = indicators[0];
    cards.push({
      id: dataset.id,
      number: dataset.number,
      graphCodeBase: summary.graphCodeBase,
      title: dataset.title,
      titleOriginal: dataset.titleOriginal,
      titleUa: dataset.titleUa,
      titleEn: dataset.titleEn,
      category: dataset.category,
      description: dataset.description,
      descriptionUa: dataset.descriptionUa,
      descriptionEn: dataset.descriptionEn,
      question: dataset.question,
      readerGuide: dataset.readerGuide,
      lineage: dataset.lineage ?? null,
      frequency: dataset.frequency,
      coverageStart: summary.coverageStart,
      latestDate: latestDate ?? dataset.releaseDate ?? "",
      rowCount: dataset.rows.length,
      fieldCount: schema.length,
      value: lead?.value ?? null,
      unit: lead?.unit ?? "",
      indicatorTitle: lead?.title ?? "Відкрити параметри",
      sparkline: lead?.series ?? [],
      presentation: indicators.length ? "chart" : "facts",
      fallbackFacts,
      regional: {
        available: regionalPerspective.available,
        field: regionalPerspective.field,
        regionCount: regionalPerspective.regionCount,
        rowCount: regionalPerspective.rowCount,
      },
      url: `/dataset/${dataset.id}`,
    });
    coverageDatasets.push({
      id: dataset.id,
      number: dataset.number,
      title: dataset.title,
      latestDate,
      latestRows: latestRows.length,
      sources: coverage,
      regionalPerspective,
    });
    if (lead) {
      const previous = lead.series.length > 1 ? lead.series.at(-2) : null;
      const currentPartial = Boolean(lead.partial);
      const comparable = Boolean(previous && !currentPartial && lead.quality.comparable);
      const deltaAbs = comparable ? lead.value - previous.value : null;
      const deltaPct = previous?.value && comparable
        ? (deltaAbs / Math.abs(previous.value)) * 100
        : null;
      const displayScale = /UAH|грн/i.test(lead.unit) ? 1_000_000_000 : 1;
      const displayUnit = displayScale === 1_000_000_000 ? "млрд грн" : lead.unit;
      dashboardMetrics.push({
        id: dataset.id,
        title: lead.title,
        shortTitle: dataset.title,
        category: dataset.category,
        unit: displayUnit,
        format: displayScale === 1 ? metricFormat(lead.unit) : "decimal",
        color: ["#0057b8", "#d08a00", "#16664b", "#b3342d", "#31516f"][dashboardMetrics.length % 5],
        current: lead.value / displayScale,
        currentDate: lead.date,
        currentPartial,
        quality: lead.quality,
        previous: previous ? previous.value / displayScale : null,
        previousDate: previous?.date ?? null,
        deltaAbs: deltaAbs === null ? null : deltaAbs / displayScale,
        deltaPct,
        comparisonLabel: previous ? `проти ${previous.year}` : "перше значення",
        annualization: dataset.annualization,
        coverageStart: lead.series[0]?.date ?? latestDate,
        series: lead.series.map((point) => ({
          ...point,
          value: point.value / displayScale,
        })),
      });
    }
  }

  const heroMetrics = dashboardMetrics
    .sort((a, b) => {
      const aPriority = datasets.find((item) => item.id === a.id)?.priority;
      const bPriority = datasets.find((item) => item.id === b.id)?.priority;
      return ({ hero: 0, top: 1, deep: 2 }[aPriority] ?? 3) -
        ({ hero: 0, top: 1, deep: 2 }[bPriority] ?? 3);
    })
    .slice(0, 12);
  const signals = heroMetrics.map((metric) => {
    const level = metric.quality?.comparable ? levelFor(metric.deltaPct) : "context";
    const direction = (metric.deltaAbs ?? 0) > 0 ? "вище" : "нижче";
    return {
      id: `signal-${metric.id}`,
      metricId: metric.id,
      level,
      label: { critical: "різкий рух", watch: "варто глянути", context: "контекст", stable: "стабільно" }[level],
      title: metric.shortTitle,
      body: metric.currentPartial
        ? `Показано накопичувальний результат станом на ${metric.currentDate}, а не фінал року. Його не можна прямо називати річним зростанням або падінням.`
        : metric.quality && !metric.quality.comparable
        ? `Останню точку не порівнюємо автоматично: ${metric.quality.flags.join(", ")}. Ряд залишається на графіку з позначкою для перевірки.`
        : metric.previous === null
        ? "Для цього ряду поки немає зіставного попереднього значення."
        : `Останнє значення ${direction} попереднього на ${Math.abs(metric.deltaPct ?? 0).toFixed(1)}%. Це сигнал для перевірки, а не готове пояснення причини.`,
      value: formatValue(metric.current, metric.unit),
    };
  });

  const dashboard = {
    meta: {
      generatedAt,
      source: meta.source,
      sourceUrl: meta.sourceUrl,
      catalogueCount: cards.length,
      liveMetricCount: heroMetrics.length,
      currentThrough: cards.map((card) => card.latestDate).filter(Boolean).sort().at(-1),
    },
    metrics: heroMetrics,
    signals,
    catalogue: cards.map((card) => ({
      number: card.number,
      id: card.id,
      title: card.title,
      category: card.category,
      frequency: card.frequency,
      coverageStart: card.coverageStart,
      priority: datasets.find((item) => item.id === card.id)?.priority ?? "deep",
      status: "live",
      annualization: datasets.find((item) => item.id === card.id)?.annualization,
      endpoint: datasets.find((item) => item.id === card.id)?.sourceUrl,
    })),
    report: {
      title: "Поточний монітор",
      deck: "Автоматичний список найбільших змін у підтверджених рядах.",
      generatedAt,
      highlights: signals.slice(0, 5).map((signal) => ({
        level: signal.level,
        title: signal.title,
        body: signal.body,
      })),
    },
  };
  await writeFile(resolve(nextRoot, "dashboard.json"), `${JSON.stringify(dashboard)}\n`);
  await writeFile(resolve(nextRoot, "catalogue.json"), `${JSON.stringify(dashboard.catalogue)}\n`);

  const manifest = {
    meta: {
      generatedAt,
      source: meta.source,
      sourceUrl: meta.sourceUrl,
      datasetCount: cards.length,
      liveDatasetCount: cards.length,
      failedDatasetCount: failures.length,
      factOnlyDatasetCount: cards.filter((card) => card.presentation === "facts").length,
      regionalDatasetCount: cards.filter((card) => card.regional.available).length,
      storageModel: meta.storageModel,
      coverageReport: {
        json: "/data/dataroom/coverage-report.json",
        markdown: "/data/dataroom/COVERAGE.md",
      },
    },
    datasets: cards,
    failures,
  };
  await writeFile(resolve(nextRoot, "dataroom/manifest.json"), `${JSON.stringify(manifest)}\n`);
  const coverageReport = {
    generatedAt,
    datasetCount: cards.length,
    regionalDatasetCount: manifest.meta.regionalDatasetCount,
    sourceCount: coverageDatasets.length + failures.length,
    datasets: coverageDatasets,
    failures,
  };
  await writeFile(
    resolve(nextRoot, "dataroom/coverage-report.json"),
    `${JSON.stringify(coverageReport)}\n`,
  );
  await writeFile(
    resolve(nextRoot, "dataroom/COVERAGE.md"),
    `# ${meta.source}: аудит покриття\n\nПідтверджено наборів: ${cards.length}. Непідтверджено або відхилено: ${failures.length}.\n`,
  );

  const reportDefinitions = [
    { id: "annual", period: "annual", kicker: "Річний кадр", title: "Довга динаміка", deck: "Останні зіставні річні точки ключових показників." },
    { id: "latest", period: "monthly", kicker: "Останній кадр", title: "Що змінилося", deck: "Найсвіжіші офіційні рухи у каталозі." },
    { id: "freshness", period: "daily", kicker: "Аудит", title: "Свіжість даних", deck: "Які ряди оновилися та де залишаються прогалини." },
  ];
  const reportManifest = [];
  for (const definition of reportDefinitions) {
    const observations = heroMetrics.slice(0, 8).map((metric) => {
      const current = metric.current;
      const previous = metric.previous ?? current;
      const delta = metric.quality?.comparable ? current - previous : 0;
      const deltaPct = !metric.quality?.comparable
        ? null
        : previous ? (delta / Math.abs(previous)) * 100 : null;
      return {
        id: metric.id,
        label: metric.shortTitle,
        unit: metric.unit,
        current,
        previous,
        delta,
        deltaPct,
        level: metric.quality?.comparable ? levelFor(deltaPct) : "context",
        quality: metric.quality,
        comparison: metric.comparisonLabel,
        currentDate: metric.currentDate,
        previousDate: metric.previousDate ?? metric.currentDate,
        insight: signals.find((signal) => signal.metricId === metric.id)?.body ?? "",
      };
    });
    const lead = observations[0] ?? {
      id: "none",
      label: "Немає зіставних рядів",
      unit: "",
      current: 0,
      previous: 0,
      delta: 0,
      deltaPct: 0,
      level: "stable",
      currentDate: generatedAt.slice(0, 10),
      previousDate: generatedAt.slice(0, 10),
      insight: "Дані ще збираються.",
    };
    const report = {
      ...definition,
      brief: `${definition.deck} Автоматичні маркери не доводять причинність.`,
      generatedAt,
      source: meta.source,
      observations,
      datasetGuides: observations
        .map((observation) => cards.find((card) => card.id === observation.id))
        .filter(Boolean)
        .map((card) => ({
          id: card.id,
          titleUa: card.titleUa,
          titleEn: card.titleEn,
          readerGuide: card.readerGuide,
        })),
      lead,
      notes: [
        "Кожне значення зберігає період і одиницю виміру.",
        "Поточні річні точки позначаються як попередні, якщо рік ще не завершений.",
      ],
    };
    await writeFile(resolve(nextRoot, `reports/${definition.id}.json`), `${JSON.stringify(report)}\n`);
    await writeFile(
      resolve(nextRoot, `reports/${definition.id}.md`),
      `# ${definition.title}\n\n${definition.deck}\n\n${observations.map((item) => `- **${item.label}:** ${formatValue(item.current, item.unit)}. ${item.insight}`).join("\n")}\n\n## Пояснення наборів\n\n${report.datasetGuides.map((dataset) => `### ${dataset.titleUa}\n\n${dataset.readerGuide.ua.what}\n\n${dataset.readerGuide.ua.how}\n\n${dataset.readerGuide.ua.use}\n\n${dataset.readerGuide.ua.caution}`).join("\n\n")}\n`,
    );
    reportManifest.push({
      ...definition,
      brief: report.brief,
      generatedAt,
      lead,
      json: `/data/reports/${definition.id}.json`,
      markdown: `/data/reports/${definition.id}.md`,
      url: `/report/${definition.id}`,
    });
  }
  await writeFile(resolve(nextRoot, "reports/manifest.json"), `${JSON.stringify(reportManifest)}\n`);

  await rm(liveRoot, { recursive: true, force: true });
  await rename(nextRoot, liveRoot);
}
