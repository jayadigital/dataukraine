import {
  buildPublicRelease,
  createCornerDatabase,
  fetchCached,
  insertDatasets,
  parseCsv,
  slugify,
  toNumber,
} from "./common.mjs";

const api = "https://rplumber.ilo.org";
const headers = {
  "user-agent": "RI Country Data Corners/0.2 Rilostat-compatible",
};

async function csv(url, cacheKey) {
  const body = await fetchCached(url, cacheKey, { headers });
  return parseCsv(body.toString("utf8").replace(/^\uFEFF/u, ""));
}

const [sourceRows, indicatorRows, sexRows, classif1Rows, classif2Rows, statusRows] =
  await Promise.all([
    csv(`${api}/data/ref_area?id=UKR_A&format=.csv`, "ilostat/UKR_A.csv"),
    csv(`${api}/metadata/dic?var=indicator&lang=en&format=.csv`, "ilostat/indicator.csv"),
    csv(`${api}/metadata/dic?var=sex&lang=en&format=.csv`, "ilostat/sex.csv"),
    csv(`${api}/metadata/dic?var=classif1&lang=en&format=.csv`, "ilostat/classif1.csv"),
    csv(`${api}/metadata/dic?var=classif2&lang=en&format=.csv`, "ilostat/classif2.csv"),
    csv(`${api}/metadata/dic?var=obs_status&lang=en&format=.csv`, "ilostat/obs-status.csv"),
  ]);

function dictionary(rows, codeField, labelField) {
  return new Map(rows.map((row) => [row[codeField], row[labelField] || row[codeField]]));
}

const indicatorLabels = dictionary(indicatorRows, "indicator", "indicator.label");
const indicatorDescriptions = dictionary(
  indicatorRows,
  "indicator",
  "indicator.description",
);
const sexLabels = dictionary(sexRows, "sex", "sex.label");
const classif1Labels = dictionary(classif1Rows, "classif1", "classif1.label");
const classif2Labels = dictionary(classif2Rows, "classif2", "classif2.label");
const statusLabels = dictionary(statusRows, "obs_status", "obs_status.label");

function plainText(value) {
  return String(value ?? "")
    .replace(/<[^>]*>/gu, " ")
    .replace(/&nbsp;/gu, " ")
    .replace(/&amp;/gu, "&")
    .replace(/&quot;/gu, '"')
    .replace(/\s+/gu, " ")
    .trim();
}

function unitFor(code, label) {
  if (/_RT$/u.test(code) || /\(%\)|percent|rate\b/iu.test(label)) return "%";
  if (/US\$|USD/iu.test(label)) return "USD";
  if (/thousand/iu.test(label)) return "тис. осіб";
  if (/hours?/iu.test(label)) return "годин";
  if (/index/iu.test(label)) return "індекс";
  return "значення";
}

function categoryFor(code, label) {
  if (/^(UNE|LUU)|unemploy/iu.test(`${code} ${label}`)) return "Безробіття";
  if (/^(EMP|EAP|EPR)|employment|labour force/iu.test(`${code} ${label}`)) {
    return "Зайнятість і робоча сила";
  }
  if (/^(EAR|HOW|WAG)|earning|wage|working time/iu.test(`${code} ${label}`)) {
    return "Зарплати і робочий час";
  }
  if (/^(INJ|LAC)|injur|labour cost/iu.test(`${code} ${label}`)) {
    return "Умови та вартість праці";
  }
  if (/^(SOC|SDG)|social protection|poverty/iu.test(`${code} ${label}`)) {
    return "Соціальний захист і ЦСР";
  }
  if (/occupation|economic activity|status in employment/iu.test(label)) {
    return "Структура зайнятості";
  }
  return "Інші показники праці";
}

const heroIds = new Set([
  "UNE_DEAP_SEX_AGE_RT",
  "SDG_0852_SEX_AGE_RT",
  "EAP_DWAP_SEX_AGE_RT",
  "EMP_DWAP_SEX_AGE_RT",
  "EMP_TEMP_SEX_ECO_NB",
  "EAR_4MTH_SEX_OCU_CUR_NB",
  "HOW_TEMP_SEX_ECO_NB",
  "POP_XWAP_SEX_AGE_NB",
]);
const currentYear = new Date().getUTCFullYear();
const grouped = new Map();
for (const row of sourceRows) {
  if (!/^\d{4}$/u.test(row.time)) continue;
  const value = toNumber(row.obs_value);
  if (value === null) continue;
  const rows = grouped.get(row.indicator) ?? [];
  rows.push(row);
  grouped.set(row.indicator, rows);
}

const ids = [...grouped.keys()].sort((a, b) => {
  const ah = heroIds.has(a) ? 0 : 1;
  const bh = heroIds.has(b) ? 0 : 1;
  if (ah !== bh) return ah - bh;
  return (indicatorLabels.get(a) ?? a).localeCompare(indicatorLabels.get(b) ?? b);
});

const datasets = ids.map((indicator, index) => {
  const title = indicatorLabels.get(indicator) ?? indicator;
  const unit = unitFor(indicator, title);
  const rows = grouped.get(indicator).map((raw) => {
    const dimensions = {
      sex: raw.sex,
      sexLabel: sexLabels.get(raw.sex) ?? raw.sex,
      classif1: raw.classif1 || null,
      classif1Label: (classif1Labels.get(raw.classif1) ?? raw.classif1) || null,
      classif2: raw.classif2 || null,
      classif2Label: (classif2Labels.get(raw.classif2) ?? raw.classif2) || null,
      source: raw.source,
    };
    const dimensionLabel = [
      dimensions.sexLabel,
      dimensions.classif1Label,
      dimensions.classif2Label,
    ].filter(Boolean).join(" · ");
    return {
      timePeriod: raw.time,
      date: `${raw.time}-12-31`,
      value: toNumber(raw.obs_value),
      indicatorCode: [
        indicator,
        raw.sex,
        raw.classif1,
        raw.classif2,
        raw.source,
      ].filter(Boolean).join("|"),
      indicatorLabel: dimensionLabel ? `${title} · ${dimensionLabel}` : title,
      unit,
      freq: "A",
      action: Number(raw.time) > currentYear ? "F" : "I",
      dimensions,
      attributes: {
        observationStatus: raw.obs_status,
        observationStatusLabel: statusLabels.get(raw.obs_status) ?? raw.obs_status,
        noteClassif: raw.note_classif || null,
        noteIndicator: raw.note_indicator || null,
        noteSource: raw.note_source || null,
      },
      raw,
    };
  });
  const description = plainText(indicatorDescriptions.get(indicator));
  return {
    id: slugify(indicator),
    number: index + 1,
    flowId: indicator,
    title,
    category: categoryFor(indicator, title),
    priority: heroIds.has(indicator) ? "hero" : index < 40 ? "top" : "deep",
    frequency: "Річна",
    officialUrl: "https://ilostat.ilo.org/data/bulk/",
    sourceUrl: `${api}/data/indicator?id=${encodeURIComponent(indicator)}&ref_area=UKR&format=.csv`,
    fetchMode: "complete annual Ukraine slice from the official ILOSTAT API",
    description: description || `${title}. У кімнаті збережені всі доступні річні зрізи України та їхні класифікації.`,
    question: `Що показує «${title}» про роботу і людей в Україні?`,
    why: "ILOSTAT використовує спільні міжнародні визначення. Це допомагає відрізнити зміну ринку праці від зміни способу підрахунку.",
    annualization: "Офіційні річні ряди ILOSTAT; майбутні роки позначені як прогнозні",
    limitation: "Національні опитування можуть мати воєнні прогалини; модельні оцінки та прогнози не слід змішувати з прямими спостереженнями.",
    availability: {
      sex: [...new Set(rows.map((row) => row.dimensions.sex).filter(Boolean))],
      classif1: [...new Set(rows.map((row) => row.dimensions.classif1).filter(Boolean))],
      classif2: [...new Set(rows.map((row) => row.dimensions.classif2).filter(Boolean))],
      source: [...new Set(rows.map((row) => row.dimensions.source).filter(Boolean))],
    },
    rows,
  };
});

const { db, databasePath } = await createCornerDatabase("ilostat");
insertDatasets(db, datasets);
await buildPublicRelease("ilostat", db, datasets, []);
db.close();
console.log(
  `ILOSTAT corner: ${datasets.length} rooms, ${sourceRows.length} source rows -> ${databasePath}`,
);
