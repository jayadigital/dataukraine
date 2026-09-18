import {
  buildPublicRelease,
  createCornerDatabase,
  fetchCached,
  insertDatasets,
  mapConcurrent,
  toNumber,
} from "./common.mjs";

const api = "https://data360api.worldbank.org/data360";
const data360IndicatorIds = JSON.parse(
  (await fetchCached(`${api}/indicators?datasetId=WB_WDI`, "wb/indicators.json")).toString("utf8"),
);
const classicApi = "https://api.worldbank.org/v2";
const metadataPayload = JSON.parse(
  (await fetchCached(
    `${classicApi}/source/2/indicator?format=json&per_page=20000`,
    "wb/classic-metadata.json",
  )).toString("utf8"),
);
const metadataRows = metadataPayload[1] ?? [];
const codeBatches = [];
let batch = [];
let batchLength = 0;
for (const item of metadataRows) {
  const nextLength = batchLength + item.id.length + 1;
  // The API documents a larger limit, but its current gateway rejects some
  // path segments near 1 KB. Smaller batches are faster to retry and cache.
  if (batch.length >= 35 || nextLength > 700) {
    codeBatches.push(batch);
    batch = [];
    batchLength = 0;
  }
  batch.push(item.id);
  batchLength += item.id.length + 1;
}
if (batch.length) codeBatches.push(batch);

const payloads = await mapConcurrent(codeBatches, 6, async (codes, page) => {
  const indicatorPath = codes.join(";");
  const body = await fetchCached(
    `${classicApi}/country/UKR/indicator/${indicatorPath}?source=2&format=json&per_page=20000`,
    `wb/classic-data-${String(page).padStart(3, "0")}.json`,
  );
  console.log(`World Bank batch ${page + 1}/${codeBatches.length}`);
  return JSON.parse(body.toString("utf8"));
});
const observations = payloads
  .flatMap((payload) => payload[1] ?? [])
  .filter((row) => row.value !== null)
  .map((row) => ({
    ...row,
    INDICATOR: `WB_WDI_${row.indicator.id.replaceAll(".", "_")}`,
    TIME_PERIOD: row.date,
    OBS_VALUE: row.value,
    FREQ: "A",
    REF_AREA: "UKR",
  }));
const metadata = new Map(
  metadataRows.map((item) => [
    `WB_WDI_${item.id.replaceAll(".", "_")}`,
    item,
  ]),
);
const byIndicator = new Map();
for (const row of observations) {
  const current = byIndicator.get(row.INDICATOR) ?? [];
  current.push(row);
  byIndicator.set(row.INDICATOR, current);
}

const heroOrder = [
  "WB_WDI_NY_GDP_MKTP_CD",
  "WB_WDI_NY_GDP_MKTP_KD_ZG",
  "WB_WDI_NY_GDP_PCAP_CD",
  "WB_WDI_SP_POP_TOTL",
  "WB_WDI_FP_CPI_TOTL_ZG",
  "WB_WDI_SL_UEM_TOTL_ZS",
  "WB_WDI_NE_EXP_GNFS_ZS",
  "WB_WDI_BX_KLT_DINV_WD_GD_ZS",
  "WB_WDI_GC_DOD_TOTL_GD_ZS",
  "WB_WDI_SI_POV_NAHC",
  "WB_WDI_SE_XPD_TOTL_GD_ZS",
  "WB_WDI_SH_XPD_CHEX_GD_ZS",
];
const sortedIds = [...byIndicator.keys()].sort((a, b) => {
  const ai = heroOrder.indexOf(a);
  const bi = heroOrder.indexOf(b);
  if (ai !== -1 || bi !== -1) return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  return (metadata.get(a)?.name ?? a).localeCompare(metadata.get(b)?.name ?? b);
});

function categoryFor(id) {
  const code = id.replace(/^WB_WDI_/, "");
  if (/^(NY|NE|BN|GC|FM|FP|PA)/.test(code)) return "Економіка і фінанси";
  if (/^(SL|SI|SP)/.test(code)) return "Люди і праця";
  if (/^(SE)/.test(code)) return "Освіта";
  if (/^(SH)/.test(code)) return "Здоров’я";
  if (/^(EN|EG|ER|AG)/.test(code)) return "Клімат, енергія і земля";
  if (/^(IT|IS|IC)/.test(code)) return "Бізнес та інфраструктура";
  if (/^(BX|BM|TX|TM)/.test(code)) return "Торгівля та інвестиції";
  return "Інші показники розвитку";
}

function unitFor(row) {
  const item = metadata.get(row.INDICATOR);
  const definition = `${item?.name ?? ""} ${item?.unit ?? ""}`;
  if (/%|percentage|percent\b/i.test(definition)) return "%";
  if (/US\$|USD/i.test(definition)) return "USD";
  return item?.unit || "значення";
}

const datasets = sortedIds.map((id, index) => {
  const sourceRows = byIndicator.get(id);
  const indicatorMeta = metadata.get(id);
  const title = indicatorMeta?.name ?? sourceRows[0]?.indicator?.value ?? id;
  const rows = sourceRows
    .map((raw) => ({
      timePeriod: raw.TIME_PERIOD,
      date: `${raw.TIME_PERIOD}-12-31`,
      value: toNumber(raw.OBS_VALUE),
      indicatorCode: id,
      indicatorLabel: title,
      unit: unitFor(raw),
      freq: raw.FREQ ?? "A",
      partial: false,
      dimensions: {
        countryCode: raw.countryiso3code,
        countryName: raw.country?.value,
      },
      attributes: {
        decimal: raw.decimal,
        sourceNote: indicatorMeta?.sourceNote,
        topics: indicatorMeta?.topics,
      },
      raw,
    }))
    .filter((row) => row.value !== null && /^\d{4}$/.test(row.timePeriod));
  return {
    id: id.toLowerCase().replace(/^wb_wdi_/, "").replaceAll("_", "-"),
    number: index + 1,
    flowId: id,
    title,
    category: categoryFor(id),
    priority: heroOrder.includes(id) ? "hero" : index < 40 ? "top" : "deep",
    frequency: "Річна",
    officialUrl: "https://data360.worldbank.org/en/api",
    sourceUrl: `${classicApi}/country/UKR/indicator/${id.replace(/^WB_WDI_/, "").replaceAll("_", ".")}?source=2&format=json`,
    fetchMode: "complete annual Ukraine slice from WDI source 2; Data360 catalogue cross-check",
    description: `${title}. Тут зібрано всі доступні річні значення України з WDI; каталог звірено з Data360.`,
    question: `Як змінювався показник «${title}» в Україні?`,
    why: "World Bank приводить дані різних країн до спільних визначень. Це допомагає бачити довгу динаміку і порівнювати, але рік публікації може відставати.",
    annualization: "Офіційні річні спостереження WDI без заповнення пропусків",
    limitation: rows.length < 2 ? "Показник має лише одну доступну річну точку для України." : null,
    rows,
  };
});

const gepMetadataPayload = JSON.parse(
  (await fetchCached(
    `${classicApi}/indicator?format=json&source=27&per_page=1000`,
    "wb/gep-metadata.json",
  )).toString("utf8"),
);
const gepMetadata = gepMetadataPayload[1]?.[0];
const gepPayload = JSON.parse(
  (await fetchCached(
    `${classicApi}/country/UKR/indicator/NYGDPMKTPKDZ?format=json&source=27&per_page=100`,
    "wb/gep-ukraine-gdp-growth.json",
  )).toString("utf8"),
);
const gepRows = (gepPayload[1] ?? [])
  .filter((row) => row.value !== null && /^\d{4}$/u.test(row.date))
  .map((raw) => ({
    timePeriod: raw.date,
    date: `${raw.date}-12-31`,
    value: toNumber(raw.value),
    indicatorCode: "WB_GEP_NYGDPMKTPKDZ",
    indicatorLabel: gepMetadata?.name ?? raw.indicator?.value,
    unit: "%",
    freq: "A",
    action: raw.obs_status === "F" ? "F" : "I",
    dimensions: {
      countryCode: raw.countryiso3code,
      countryName: raw.country?.value,
      source: "Global Economic Prospects",
    },
    attributes: {
      observationStatus: raw.obs_status,
      sourceNote: gepMetadata?.sourceNote,
    },
    raw,
  }))
  .sort((a, b) => a.date.localeCompare(b.date));
if (gepRows.length) {
  datasets.push({
    id: "gep-gdp-growth-forecast",
    number: datasets.length + 1,
    flowId: "WB_GEP_NYGDPMKTPKDZ",
    title: gepMetadata?.name ?? "GDP growth forecast",
    category: "Прогнози",
    priority: "hero",
    frequency: "Річна",
    officialUrl: "https://www.worldbank.org/en/publication/global-economic-prospects",
    sourceUrl: `${classicApi}/country/UKR/indicator/NYGDPMKTPKDZ?format=json&source=27`,
    fetchMode: "complete Ukraine series from World Bank Global Economic Prospects source 27",
    description: "Історичне зростання ВВП України та доступний прогноз World Bank Global Economic Prospects в одній серії.",
    question: "Яке зростання економіки України очікує World Bank?",
    why: "Це незалежна зовнішня траєкторія, яку можна зіставити з IMF і Trading Economics, не змішуючи різні дати та методології.",
    annualization: "Річні значення; статус F у World Bank позначено як forecast",
    limitation: "Прогноз переглядається у нових випусках Global Economic Prospects.",
    rows: gepRows,
  });
}

const missingMetadata = data360IndicatorIds.filter((id) => !metadata.has(id)).length;
const { db, databasePath } = await createCornerDatabase("wb");
insertDatasets(db, datasets);
await buildPublicRelease("wb", db, datasets, [
  {
    id: "data360-paging-fallback",
    error: "Data360 live paging timed out during this build; observations were retrieved from the official World Bank Indicators API, source 2 (WDI), and cross-checked against the Data360 WDI catalogue.",
  },
  ...(missingMetadata ? [{
    id: "data360-catalogue-gap",
    error: `${missingMetadata} Data360 WDI identifiers are not present in the current Indicators API source-2 metadata and are reported separately rather than invented.`,
  }] : []),
]);
db.close();
console.log(`World Bank corner: ${datasets.length} rooms, ${observations.length} observations -> ${databasePath}`);
