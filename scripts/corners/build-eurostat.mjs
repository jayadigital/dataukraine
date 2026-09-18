import { gunzipSync } from "node:zlib";
import {
  buildPublicRelease,
  createCornerDatabase,
  fetchCached,
  insertDatasets,
  mapConcurrent,
  slugify,
  toNumber,
} from "./common.mjs";

const api = "https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data";
const metabaseBody = await fetchCached(
  "https://ec.europa.eu/eurostat/api/dissemination/catalogue/metabase.txt.gz",
  "eurostat/metabase.txt.gz",
);
const metabase = gunzipSync(metabaseBody).toString("utf8");
const codes = [...new Set(
  metabase
    .split(/\r?\n/u)
    .map((line) => line.split("\t"))
    .filter(([, dimension, value]) => dimension === "geo" && value === "UA")
    .map(([code]) => code),
)].sort();

function orderedCodes(dimension) {
  const index = dimension?.category?.index;
  if (Array.isArray(index)) return index;
  return Object.entries(index ?? {})
    .sort((a, b) => Number(a[1]) - Number(b[1]))
    .map(([code]) => code);
}

function categoryLabel(dimension, code) {
  return dimension?.category?.label?.[code] ?? code;
}

function parseJsonStat(code, payload) {
  const dimensionIds = payload.id ?? [];
  const sizes = payload.size ?? [];
  const codeLists = dimensionIds.map((id) => orderedCodes(payload.dimension?.[id]));
  const values = Array.isArray(payload.value)
    ? payload.value.map((value, index) => [String(index), value])
    : Object.entries(payload.value ?? {});
  const rows = [];
  for (const [flatKey, rawValue] of values) {
    const value = toNumber(rawValue);
    if (value === null) continue;
    let remaining = Number(flatKey);
    const positions = new Array(dimensionIds.length);
    for (let index = dimensionIds.length - 1; index >= 0; index -= 1) {
      positions[index] = remaining % sizes[index];
      remaining = Math.floor(remaining / sizes[index]);
    }
    const dimensions = Object.fromEntries(
      dimensionIds.map((id, index) => [id, codeLists[index]?.[positions[index]]]),
    );
    const time = dimensions.time;
    if (!/^\d{4}$/u.test(time ?? "")) continue;
    if (dimensions.freq && dimensions.freq !== "A") continue;
    const labels = Object.fromEntries(
      dimensionIds.map((id) => [
        id,
        categoryLabel(payload.dimension?.[id], dimensions[id]),
      ]),
    );
    const detailDimensions = dimensionIds.filter(
      (id) => !["time", "freq", "geo"].includes(id),
    );
    const detailLabel = detailDimensions
      .map((id) => labels[id])
      .filter(Boolean)
      .join(" · ");
    const unitCode = dimensions.unit ?? "";
    const unitLabel = (labels.unit ?? unitCode) || "значення";
    rows.push({
      timePeriod: time,
      date: `${time}-12-31`,
      value,
      indicatorCode: [
        code,
        ...detailDimensions.map((id) => `${id}=${dimensions[id]}`),
      ].join("|"),
      indicatorLabel: detailLabel ? `${payload.label} · ${detailLabel}` : payload.label,
      unit: /percent|%/iu.test(unitLabel) ? "%" : unitLabel,
      freq: "A",
      action: "I",
      dimensions: {
        ...dimensions,
        labels,
      },
      attributes: {
        status: payload.status?.[flatKey] ?? null,
        source: payload.source,
        updated: payload.updated,
      },
      raw: {
        dataset: code,
        ...dimensions,
        value,
        status: payload.status?.[flatKey] ?? null,
      },
    });
  }
  return rows;
}

const responses = await mapConcurrent(codes, 6, async (code, index) => {
  try {
    const body = await fetchCached(
      `${api}/${encodeURIComponent(code)}?lang=en&geo=UA`,
      `eurostat/data/${code}.json`,
      { signal: AbortSignal.timeout(45_000) },
    );
    if (body.byteLength > 20_000_000) {
      return {
        code,
        error: `Live Ukraine response is ${(body.byteLength / 1_000_000).toFixed(1)} MB and is deferred to a dedicated heavy-table pipeline.`,
      };
    }
    const payload = JSON.parse(body.toString("utf8"));
    const rows = parseJsonStat(code, payload);
    if (!rows.length) {
      return { code, error: "No annual Ukraine observations in the current live response." };
    }
    if (rows.length > 100_000) {
      return {
        code,
        error: `${rows.length.toLocaleString("en")} annual rows require a dedicated partitioned release.`,
      };
    }
    if ((index + 1) % 25 === 0) {
      console.log(`Eurostat checked ${index + 1}/${codes.length}`);
    }
    return { code, payload, rows };
  } catch (error) {
    return { code, error: error.message };
  }
});

const heroCodes = [
  "enpe_nama_10_gdp",
  "enpe_cpi",
  "enpe_lfsa_urgan",
  "enpe_lfsa_ergan",
  "enpe_ext_bal",
  "enpe_bop_c6_a",
  "enpe_mon_res",
  "enpe_env_ghg",
  "demo_pjan",
  "earn_mw_cur",
];

function categoryFor(code, label) {
  if (/nama|gdp|gov|bop|mon_res/iu.test(`${code} ${label}`)) return "Економіка і фінанси";
  if (/lfsa|earn|unemploy|employ/iu.test(`${code} ${label}`)) return "Праця і доходи";
  if (/demo|migr|asyl|marr|div|population/iu.test(`${code} ${label}`)) {
    return "Населення і міграція";
  }
  if (/ext_|trade|irt_/iu.test(`${code} ${label}`)) return "Торгівля";
  if (/apro|fish|agri/iu.test(`${code} ${label}`)) return "Сільське господарство";
  if (/env|nrg|energy|waste|water/iu.test(`${code} ${label}`)) {
    return "Енергія і довкілля";
  }
  if (/educ|hlth|health/iu.test(`${code} ${label}`)) return "Освіта і здоров’я";
  return "Інші європейські показники";
}

const available = responses.filter((item) => item.rows);
available.sort((a, b) => {
  const ai = heroCodes.indexOf(a.code);
  const bi = heroCodes.indexOf(b.code);
  if (ai !== -1 || bi !== -1) return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  return a.code.localeCompare(b.code);
});

const datasets = available.map(({ code, payload, rows }, index) => ({
  id: slugify(code),
  number: index + 1,
  flowId: code,
  title: payload.label ?? code,
  category: categoryFor(code, payload.label),
  priority: heroCodes.includes(code) ? "hero" : index < 50 ? "top" : "deep",
  frequency: "Річна",
  officialUrl: "https://ec.europa.eu/eurostat/web/ukraine",
  sourceUrl: `${api}/${encodeURIComponent(code)}?lang=en&geo=UA`,
  fetchMode: "complete annual Ukraine slice from the Eurostat Statistics API",
  description: `${payload.label ?? code}. Збережені всі річні значення України, які повертає поточна JSON-stat схема.`,
  question: `Як Україна виглядає у європейському показнику «${payload.label ?? code}»?`,
  why: "Eurostat використовує узгоджені європейські класифікації. Це корисно для порівняння з ЄС, але окремі українські ряди можуть завершуватися раніше.",
  annualization: "Офіційні річні значення Eurostat; місячні й квартальні позиції відфільтровано",
  limitation: null,
  availability: Object.fromEntries(
    (payload.id ?? []).map((id) => [
      id,
      orderedCodes(payload.dimension?.[id]).map((value) => ({
        code: value,
        label: categoryLabel(payload.dimension?.[id], value),
      })),
    ]),
  ),
  rows,
}));
const failures = responses
  .filter((item) => item.error)
  .map(({ code, error }) => ({ id: code, error }));

const { db, databasePath } = await createCornerDatabase("eurostat");
insertDatasets(db, datasets);
await buildPublicRelease("eurostat", db, datasets, failures);
db.close();
console.log(
  `Eurostat corner: ${datasets.length}/${codes.length} annual Ukraine rooms, ${failures.length} deferred -> ${databasePath}`,
);
