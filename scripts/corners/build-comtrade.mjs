import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  buildPublicRelease,
  createCornerDatabase,
  dataRoot,
  fetchCached,
  insertDatasets,
  slugify,
  toNumber,
} from "./common.mjs";

const api = "https://comtradeapi.un.org/public/v1/preview/C/A/HS";
const firstYear = 1992;
const currentYear = new Date().getUTCFullYear();
let lastNetworkRequest = 0;

function sleep(milliseconds) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));
}

async function getJson(url, cacheKey) {
  let cached = false;
  if (process.env.RI_REFRESH !== "1") {
    try {
      await readFile(resolve(dataRoot, "cache", cacheKey));
      cached = true;
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  if (!cached) {
    const wait = 1_250 - (Date.now() - lastNetworkRequest);
    if (wait > 0) await sleep(wait);
  }
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const body = await fetchCached(url, cacheKey, {
        headers: { "user-agent": "RI Country Data Corners/0.2" },
      });
      if (!cached) lastNetworkRequest = Date.now();
      return JSON.parse(body.toString("utf8"));
    } catch (error) {
      if (!/429/iu.test(error.message) || attempt === 4) throw error;
      await sleep(attempt * 3_000);
    }
  }
}

function query(year, command, partner = "0") {
  const parameters = new URLSearchParams({
    reporterCode: "804",
    period: String(year),
    cmdCode: command,
    flowCode: "X,M",
    partner2Code: "0",
    customsCode: "C00",
    motCode: "0",
    maxRecords: "500",
    includeDesc: "true",
  });
  if (partner !== null) parameters.set("partnerCode", partner);
  return `${api}?${parameters}`;
}

const annualPayloads = [];
const failures = [];
for (let year = firstYear; year <= currentYear; year += 1) {
  try {
    const totals = await getJson(
      query(year, "TOTAL"),
      `comtrade/totals/${year}.json`,
    );
    const products = await getJson(
      query(year, "AG2"),
      `comtrade/products/${year}.json`,
    );
    const totalRows = totals.data ?? [];
    const productRows = products.data ?? [];
    if (totalRows.length || productRows.length) {
      annualPayloads.push({ year, totalRows, productRows });
    }
    console.log(
      `UN Comtrade ${year}: ${totalRows.length} totals, ${productRows.length} HS2 rows`,
    );
  } catch (error) {
    failures.push({ id: `year-${year}`, error: error.message });
  }
}

const latestYear = annualPayloads.map((item) => item.year).sort((a, b) => a - b).at(-1);
let partnerRows = [];
if (latestYear) {
  try {
    const partners = await getJson(
      query(latestYear, "TOTAL", null),
      `comtrade/partners/${latestYear}.json`,
    );
    partnerRows = (partners.data ?? []).filter((row) => row.partnerCode !== 0);
  } catch (error) {
    failures.push({ id: "latest-partners", error: error.message });
  }
}

function normalizedRow(raw, indicatorCode, indicatorLabel) {
  const year = String(raw.period ?? raw.refYear);
  return {
    timePeriod: year,
    date: `${year}-12-31`,
    value: toNumber(raw.primaryValue),
    indicatorCode,
    indicatorLabel,
    unit: "USD",
    freq: "A",
    action: "I",
    dimensions: {
      flowCode: raw.flowCode,
      flow: raw.flowDesc,
      commodityCode: raw.cmdCode,
      commodity: raw.cmdDesc,
      partnerCode: raw.partnerCode,
      partner: raw.partnerDesc,
      classification: raw.classificationCode,
    },
    attributes: {
      reported: raw.isReported,
      aggregate: raw.isAggregate,
      estimated: raw.legacyEstimationFlag,
    },
    raw,
  };
}

const totalRows = annualPayloads.flatMap(({ totalRows: rows }) =>
  rows
    .filter((row) => toNumber(row.primaryValue) !== null)
    .map((raw) => normalizedRow(
      raw,
      `TOTAL_${raw.flowCode}`,
      raw.flowCode === "X" ? "Експорт товарів" : "Імпорт товарів",
    )),
);
const productGroups = new Map();
for (const { productRows: rows } of annualPayloads) {
  for (const raw of rows) {
    if (toNumber(raw.primaryValue) === null) continue;
    const group = productGroups.get(raw.cmdCode) ?? {
      code: raw.cmdCode,
      title: raw.cmdDesc || `HS ${raw.cmdCode}`,
      rows: [],
    };
    group.rows.push(normalizedRow(
      raw,
      `${raw.cmdCode}_${raw.flowCode}`,
      `${raw.cmdDesc || `HS ${raw.cmdCode}`} · ${raw.flowCode === "X" ? "експорт" : "імпорт"}`,
    ));
    productGroups.set(raw.cmdCode, group);
  }
}

function productCategory(code) {
  const chapter = Number(code);
  if (chapter <= 24) return "Аграрна продукція і харчі";
  if (chapter <= 27) return "Мінерали та енергія";
  if (chapter <= 40) return "Хімія і пластмаси";
  if (chapter <= 67) return "Шкіра, деревина, папір і текстиль";
  if (chapter <= 83) return "Камінь і метали";
  if (chapter <= 85) return "Машини й електроніка";
  if (chapter <= 89) return "Транспорт";
  return "Інші товари";
}

const datasets = [{
  id: "trade-totals",
  number: 1,
  flowId: "COMTRADE_TOTAL",
  title: "Експорт та імпорт товарів",
  category: "Загальна торгівля",
  priority: "hero",
  frequency: "Річна",
  officialUrl: "https://comtradeplus.un.org/",
  sourceUrl: query(latestYear ?? currentYear, "TOTAL"),
  fetchMode: "annual Ukraine totals, reporter 804, world partner",
  description: "Скільки товарів Україна експортувала та імпортувала у доларах США за кожен доступний рік.",
  question: "Коли експорт покривав імпорт, а коли торговельний розрив розширювався?",
  why: "Експорт приносить валюту, імпорт показує внутрішній попит і залежність від зовнішніх товарів.",
  annualization: "Річні агрегати UN Comtrade без сумування повторних класифікацій",
  limitation: "Останній доступний рік може містити оцінені агрегати; це позначено у первинних полях.",
  rows: totalRows,
}];

for (const group of [...productGroups.values()].sort((a, b) => a.code.localeCompare(b.code))) {
  datasets.push({
    id: `hs-${slugify(group.code)}`,
    number: datasets.length + 1,
    flowId: `COMTRADE_HS_${group.code}`,
    title: group.title,
    category: productCategory(group.code),
    priority: datasets.length < 20 ? "top" : "deep",
    frequency: "Річна",
    officialUrl: "https://comtradeplus.un.org/",
    sourceUrl: query(latestYear ?? currentYear, "AG2"),
    fetchMode: "annual Ukraine HS2 trade with world partner",
    description: `${group.title}. Історія експорту та імпорту України для двозначної товарної групи HS.`,
    question: `Як змінювалася торгівля України товарною групою «${group.title}»?`,
    why: "Товарні групи показують, які галузі заробляють валюту і де економіка найбільше залежить від імпорту.",
    annualization: "Річні агрегати за гармонізованою двозначною класифікацією HS",
    limitation: "UN Comtrade може конвертувати старі національні класифікації до зіставної HS; дивіться прапори оцінювання.",
    rows: group.rows,
  });
}

if (partnerRows.length) {
  datasets.push({
    id: "latest-trade-partners",
    number: datasets.length + 1,
    flowId: "COMTRADE_PARTNERS",
    title: `Торговельні партнери, ${latestYear}`,
    category: "Географія торгівлі",
    priority: "hero",
    frequency: "Останній річний зріз",
    officialUrl: "https://comtradeplus.un.org/",
    sourceUrl: query(latestYear, "TOTAL", null),
    fetchMode: "latest annual Ukraine totals by partner",
    description: `Хто купував українські товари і звідки Україна імпортувала у ${latestYear} році.`,
    question: "З якими країнами Україна торгує найбільше?",
    why: "Концентрація на кількох партнерах створює ризик, а диверсифікація робить торгівлю стійкішою.",
    annualization: "Один останній повний річний зріз за торговельним партнером",
    limitation: "Для швидкої публічної версії партнерська деталізація завантажена лише за останній доступний рік.",
    rows: partnerRows.map((raw) => normalizedRow(
      raw,
      `${raw.partnerCode}_${raw.flowCode}`,
      `${raw.partnerDesc} · ${raw.flowCode === "X" ? "експорт" : "імпорт"}`,
    )),
  });
}

const { db, databasePath } = await createCornerDatabase("comtrade");
insertDatasets(db, datasets);
await buildPublicRelease("comtrade", db, datasets, failures);
db.close();
console.log(
  `UN Comtrade corner: ${datasets.length} rooms through ${latestYear}, ${failures.length} gaps -> ${databasePath}`,
);
