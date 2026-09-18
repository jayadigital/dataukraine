import { DatabaseSync } from "node:sqlite";
import {
  mkdir,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync, gunzipSync } from "node:zlib";
import { catalogue } from "./catalog.mjs";
import { datasetContent } from "./dataset-content.mjs";
import { datasetSources, stat } from "./dataset-sources.mjs";
import {
  currentDateParts,
  daysInMonth,
  fetchJson,
  mapLimit,
  nbuDate,
  nbuMonth,
  pad,
  round,
} from "./lib.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../..");
const publicRoot = resolve(root, "public/data");
const liveOutputRoot = resolve(publicRoot, "dataroom");
const outputRoot = resolve(publicRoot, "dataroom.next");
const databaseDirectory = resolve(root, "data");
const databasePath = resolve(databaseDirectory, "nbu-dataroom.sqlite");
const current = currentDateParts();
const generatedAt = new Date().toISOString();
const force = process.env.RI_FORCE === "1";
const fullAnnual = process.env.RI_FULL_ANNUAL !== "0";
const chunkSize = 1_000;
const csvChunkSize = 5_000;

const regionCodebooks = {
  odkodter: {
    codeSystem: "NBU odkodter",
    description:
      "Банківський територіальний зріз для кредитів, депозитів і нових ставок.",
    joinNote:
      "Код 9 об’єднує Київську область і місто Київ, а код 11 — АР Крим і Севастополь. Для карти ці складені території слід показувати разом.",
    names: {
      1: "Вінницька",
      2: "Волинська",
      3: "Дніпропетровська",
      4: "Донецька",
      5: "Житомирська",
      6: "Закарпатська",
      7: "Запорізька",
      8: "Івано-Франківська",
      9: "Київська область і м. Київ",
      10: "Кіровоградська",
      11: "АР Крим і м. Севастополь",
      12: "Луганська",
      13: "Львівська",
      14: "Миколаївська",
      15: "Одеська",
      16: "Полтавська",
      17: "Рівненська",
      18: "Сумська",
      19: "Тернопільська",
      20: "Харківська",
      21: "Херсонська",
      22: "Хмельницька",
      23: "Черкаська",
      24: "Чернігівська",
      25: "Чернівецька",
    },
  },
  ku: {
    codeSystem: "NBU ku",
    description: "Регіональний зріз індексу споживчих цін.",
    joinNote:
      "У цьому довіднику Київ має окремий код 26, АР Крим — 11, Севастополь — 29. Експорт містить лише коди, опубліковані у поточному зрізі НБУ.",
    names: {
      1: "Вінницька",
      2: "Волинська",
      3: "Дніпропетровська",
      4: "Донецька",
      5: "Житомирська",
      6: "Закарпатська",
      7: "Запорізька",
      8: "Івано-Франківська",
      9: "Київська",
      10: "Кіровоградська",
      11: "АР Крим",
      12: "Луганська",
      13: "Львівська",
      14: "Миколаївська",
      15: "Одеська",
      16: "Полтавська",
      17: "Рівненська",
      18: "Сумська",
      19: "Тернопільська",
      20: "Харківська",
      21: "Херсонська",
      22: "Хмельницька",
      23: "Черкаська",
      24: "Чернігівська",
      25: "Чернівецька",
      26: "м. Київ",
      29: "м. Севастополь",
    },
  },
};

const fieldGlossary = {
  dt: ["Дата", "Звітна дата спостереження."],
  txt: ["Показник", "Українська назва показника."],
  txten: ["Indicator", "Англійська назва показника."],
  id_api: ["ID API", "Стабільний код серії НБУ."],
  level: ["Рівень", "Місце показника в ієрархії набору."],
  leveli: ["Рівень", "Місце показника в ієрархії набору."],
  parent: ["Батьківська серія", "Код ширшого показника."],
  freq: ["Частота", "D — день, M — місяць, Q — квартал, Y — рік."],
  value: ["Значення", "Числове значення показника."],
  tzep: ["Тип значення", "Код одиниці виміру або способу розрахунку."],
  r030: ["Валюта", "Цифровий код валюти."],
  cc: ["Код валюти", "Літерний код валюти."],
  odr030: ["Валюта", "Валюта, у якій обліковано позицію."],
  r034: ["Валюта", "Код валюти банківського показника."],
  r037: ["Напрям", "Код напряму ввезення або вивезення валюти."],
  odkodter: ["Регіон", "Територіальний зріз показника."],
  ods183ld: ["Строк кредиту", "Початковий строк погашення кредиту."],
  ods183dd: ["Строк депозиту", "Початковий строк депозиту."],
  ods183sd: ["Строк паперу", "Початковий строк боргового паперу."],
  ods180: ["Строк угоди", "Початковий строк нового кредиту або депозиту."],
  odk111: ["Сектор", "Сектор економіки позичальника або вкладника."],
  odk051: ["Вид діяльності", "Код виду економічної діяльності."],
  odk070: ["Сектор емітента", "Сектор економіки емітента цінного паперу."],
  odf074: ["Інструмент", "Вид фінансового інструменту або операції."],
  k040: ["Резидентність", "Код країни або групи резидентності."],
  k076: ["Компонент", "Компонент грошового агрегату."],
  k140: ["Група банків", "Банківська група або загальна система."],
  nkb: ["Банк", "Ідентифікатор банку."],
  mfo: ["МФО", "Код банку."],
  fullname: ["Банк", "Повна назва банку."],
  gr_bank: ["Група банку", "Група, до якої НБУ відносить банк."],
  r020: ["Рахунок", "Код бухгалтерського рахунку."],
  t025: ["Тип обороту", "Дебет, кредит, активний або пасивний залишок."],
  s080: ["Клас боржника", "Клас якості або тип позичальника."],
  s181: ["Валюта представлення", "USD, EUR, UAH або інший зріз."],
  t023: ["Форма представлення", "Стандартна або аналітична форма."],
  mcrd081: ["Товарна група", "Група товарів або послуг."],
  ku: ["Регіон", "Код регіону."],
  mcrk110: ["Порівняння", "База порівняння індексу."],
  mcr210i: ["Вид діяльності", "Галузь або вид економічної діяльності."],
  repository: ["Тип операції", "Додаткова ознака угоди."],
  ind: ["Порядок", "Порядок компонента в офіційній таблиці."],
  nomernb: ["Рядок форми", "Номер рядка статистичної форми."],
  AuctionDate: ["Дата аукціону", "Дата розміщення ОВДП."],
  ValCode: ["Валюта", "Валюта випуску ОВДП."],
  StockCode: ["ISIN", "Міжнародний код облігації."],
  RepayDate: ["Погашення", "Дата повернення основної суми."],
  AvgLevel: ["Дохідність", "Середньозважена дохідність аукціону, %."],
  Attraction: ["Залучено", "Сума коштів, залучених до бюджету."],
  cpcode: ["ISIN", "Міжнародний код цінного паперу."],
  nominal: ["Номінал", "Номінальна вартість одного паперу."],
  auk_proc: ["Купон", "Річна відсоткова ставка паперу."],
  pgs_date: ["Погашення", "Дата погашення паперу."],
  val_code: ["Валюта", "Валюта номіналу."],
  payments: ["Виплати", "Графік купонів і погашення."],
};

const ignoredIdentityFields = new Set([
  "dt",
  "txt",
  "txten",
  "value",
  "level",
  "leveli",
  "parent",
  "freq",
  "fullname",
]);

const filterFields = new Set([
  "id_api",
  "tzep",
  "odkodter",
  "odr030",
  "ods183ld",
  "ods183dd",
  "ods183sd",
  "ods180",
  "odk111",
  "odk051",
  "odk070",
  "odf074",
  "k040",
  "k076",
  "k140",
  "nkb",
  "r020",
  "r034",
  "r037",
  "s080",
  "s181",
  "t023",
  "t025",
  "mcrd081",
  "ku",
  "mcrk110",
  "mcr210i",
  "repository",
  "ind",
  "nomernb",
]);

const queryFilterFields = new Set(
  [...filterFields].filter(
    (field) =>
      !["tzep", "repository", "ind", "nomernb", "mcrk110"].includes(field),
  ),
);

const preferredIds = {
  "nbu-rates": [
    "KEY_PolicyRate",
    "KEY_OvernightLoans",
    "KEY_OvernightCertificates",
  ],
  loans: ["Loans_Res", "Loans_Corp", "Loans_HH", "Loans_Gov"],
  deposits: ["Deposits_Res", "Deposits_HH", "Deposits_Corp", "Deposits_Gov"],
  "bank-securities": ["Securities_Asset", "Securities_Liab"],
  "bank-interest-rates": [
    "New_Loans_NFinCorp",
    "New_Loans_HH",
    "New_Deposits_NFinCorp",
    "New_Deposits_HH",
  ],
  "bank-income-expenses": [
    "Bank_Income_Total",
    "Bank_Expenses_Total",
    "Bank_ProfitLoss",
  ],
  "bank-indicators": [
    "BASIND_Assets",
    "BASIND_Liabilities",
    "BASIND_Capital",
    "BASIND_Banks",
  ],
  "business-surveys": ["m_survey_IEA", "q_survey_BOI_total"],
  "macro-indicators": [
    "prices_price_cpi_",
    "prices_price_core_cpi_",
    "ea_gdp_ps_gdp_cp",
    "lmss_fund_pay_wage",
    "lmss_fund_pay_realwage",
    "lmss_actnas_up1570ap_",
    "gf_budgtfd_total",
  ],
  "monetary-aggregates": ["M3", "M2", "M1", "M0"],
  "financial-corporation-surveys": ["DEPCORNBU_NFA", "DEPCORNBU_DC", "RE_MB"],
  "international-reserves": ["RES_OffReserveAssets", "RES_FX", "RES_Gold"],
  "balance-of-payments": ["CA", "FA", "BOP", "FDI_DP_f"],
  "international-investment-position": ["IIP_Net", "IIP_A", "IIP_L"],
  "foreign-direct-investment": ["FDIs_DP_s", "FDIs_in_DP_s", "FDIf_in_DP_f"],
  "gross-external-debt": ["ED", "ED_GG", "ED_OS", "ED_DTC"],
  "short-term-external-debt": ["SED", "SED_GG", "SED_OS", "SED_DTC"],
  "cash-fx-flows": ["CashFlow_Imp_M", "CashFlow_Exp_M"],
};

const preferredIdsBySource = {
  "macro-indicators": {
    "prices-monthly": ["prices_price_cpi_", "prices_price_core_cpi_"],
    "prices-annual": ["prices_price_cpi_", "prices_price_ppi_"],
    "activity-monthly": [
      "ea_indust_ind_indprod",
      "ea_trade_trt_",
      "ea_building_index_co_",
    ],
    "activity-quarterly": [
      "ea_gdp_ps_gdp_cp",
      "ea_gdp_es_gdp_cp",
      "ea_gdp_es_gfcf",
    ],
    "activity-annual": [
      "ea_gdp_ps_gdp_cp",
      "ea_gdp_es_gdp_cp",
      "ea_gdp_es_gfcf",
    ],
    "labor-monthly": [
      "lmss_fund_pay_wage",
      "lmss_fund_pay_realwage",
      "lmss_borgi_zab_ved_",
    ],
    "labor-quarterly": [
      "lmss_actnas_up1570ap_",
      "lmss_actnas_ep1570ap_",
      "lmss_actnas_eap1570ap_",
      "lmss_fund_pay_wagefund",
    ],
    "budget-monthly": ["gf_budgtee_Total", "gf_budgtfd_total"],
    "budget-annual": ["gf_budgtfd_total", "gf_budgtfd_400000"],
  },
};

await mkdir(databaseDirectory, { recursive: true });
await mkdir(publicRoot, { recursive: true });
await rm(outputRoot, { recursive: true, force: true });
await mkdir(outputRoot, { recursive: true });

const db = new DatabaseSync(databasePath);
db.exec(`
  PRAGMA journal_mode = DELETE;
  PRAGMA synchronous = FULL;
  CREATE TABLE IF NOT EXISTS raw_snapshots (
    dataset_id TEXT NOT NULL,
    source_id TEXT NOT NULL,
    snapshot_key TEXT NOT NULL,
    source_url TEXT NOT NULL,
    source_date TEXT,
    fetched_at TEXT NOT NULL,
    row_count INTEGER NOT NULL,
    byte_count INTEGER NOT NULL,
    payload_gzip BLOB NOT NULL,
    PRIMARY KEY (dataset_id, source_id, snapshot_key)
  );
  CREATE TABLE IF NOT EXISTS dataset_index (
    dataset_id TEXT PRIMARY KEY,
    generated_at TEXT NOT NULL,
    latest_date TEXT,
    row_count INTEGER NOT NULL,
    field_count INTEGER NOT NULL,
    summary_json TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS series_points (
    dataset_id TEXT NOT NULL,
    series_id TEXT NOT NULL,
    period TEXT NOT NULL,
    value REAL NOT NULL,
    title TEXT NOT NULL,
    unit TEXT NOT NULL,
    PRIMARY KEY (dataset_id, series_id, period)
  );
`);

const getCached = db.prepare(`
  SELECT payload_gzip, source_url, source_date
  FROM raw_snapshots
  WHERE dataset_id = ? AND source_id = ? AND snapshot_key = ?
`);
const getSourceSnapshots = db.prepare(`
  SELECT snapshot_key, source_url, source_date, row_count, byte_count
  FROM raw_snapshots
  WHERE dataset_id = ? AND source_id = ?
  ORDER BY snapshot_key
`);
const putSnapshot = db.prepare(`
  INSERT OR REPLACE INTO raw_snapshots
  (dataset_id, source_id, snapshot_key, source_url, source_date, fetched_at,
   row_count, byte_count, payload_gzip)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const putDataset = db.prepare(`
  INSERT OR REPLACE INTO dataset_index
  (dataset_id, generated_at, latest_date, row_count, field_count, summary_json)
  VALUES (?, ?, ?, ?, ?, ?)
`);
const putSeriesPoint = db.prepare(`
  INSERT OR REPLACE INTO series_points
  (dataset_id, series_id, period, value, title, unit)
  VALUES (?, ?, ?, ?, ?, ?)
`);
const deleteSeries = db.prepare(`
  DELETE FROM series_points WHERE dataset_id = ?
`);
const deleteDatasetIndex = db.prepare(`
  DELETE FROM dataset_index WHERE dataset_id = ?
`);
const deleteDatasetSnapshots = db.prepare(`
  DELETE FROM raw_snapshots WHERE dataset_id = ?
`);

const activeDatasetIds = new Set(catalogue.map((item) => item.id));
for (const row of db
  .prepare("SELECT dataset_id FROM dataset_index")
  .all()) {
  if (activeDatasetIds.has(row.dataset_id)) continue;
  deleteDatasetIndex.run(row.dataset_id);
  deleteSeries.run(row.dataset_id);
  deleteDatasetSnapshots.run(row.dataset_id);
}

function toIso(value) {
  const text = String(value ?? "");
  if (/^\d{8}$/.test(text)) {
    return `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}`;
  }
  if (/^\d{6}$/.test(text)) {
    return `${text.slice(0, 4)}-${text.slice(4, 6)}-01`;
  }
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(text)) {
    const [day, month, year] = text.split(".");
    return `${year}-${month}-${day}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  return text;
}

function sourceDate(rows) {
  return rows
    .map((row) =>
      toIso(
        row.dt ??
          row.exchangedate ??
          row.AuctionDate ??
          row.razm_date ??
          row.pgs_date,
      ),
    )
    .filter(Boolean)
    .sort()
    .at(-1);
}

function monthOffset(year, month, offset) {
  const date = new Date(Date.UTC(year, month - 1 + offset, 1));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 };
}

function dayOffset(year, month, day, offset) {
  const date = new Date(Date.UTC(year, month - 1, day + offset));
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

function quarterCandidates(count) {
  const result = [];
  const quarterMonth = Math.floor((current.month - 1) / 3) * 3 + 1;
  for (let index = 0; index < count; index += 1) {
    result.push(monthOffset(current.year, quarterMonth, -index * 3));
  }
  return result;
}

function buildDatedUrl(source, candidate, row = null) {
  const date =
    source.dateFormat === "ym"
      ? nbuMonth(candidate.year, candidate.month)
      : nbuDate(candidate.year, candidate.month, candidate.day ?? 1);
  const params = new URLSearchParams({ date });
  if (source.period) params.set("period", source.period);
  if (row) {
    for (const [key, value] of Object.entries(row)) {
      if (
        queryFilterFields.has(key) &&
        value !== null &&
        value !== undefined &&
        typeof value !== "object"
      ) {
        params.set(key, String(value));
      }
    }
  }
  params.set("json", "");
  return `${stat}/${source.path}?${params.toString().replace(/json=$/, "json")}`;
}

async function cachedFetch(datasetId, sourceId, key, url) {
  if (!force) {
    const cached = getCached.get(datasetId, sourceId, key);
    if (cached) {
      return {
        rows: JSON.parse(gunzipSync(cached.payload_gzip).toString("utf8")),
        url: cached.source_url,
        date: cached.source_date,
        cached: true,
      };
    }
  }
  const rows = await fetchJson(url, { cache: false });
  const payload = Buffer.from(JSON.stringify(rows));
  const date = sourceDate(rows);
  putSnapshot.run(
    datasetId,
    sourceId,
    key,
    url,
    date ?? null,
    generatedAt,
    rows.length,
    payload.byteLength,
    gzipSync(payload),
  );
  return { rows, url, date, cached: false };
}

async function tryFetch(datasetId, sourceId, key, url) {
  try {
    const result = await cachedFetch(datasetId, sourceId, key, url);
    return result.rows.length ? result : null;
  } catch {
    return null;
  }
}

async function fetchLatestSource(datasetId, source) {
  if (source.mode === "static") {
    return cachedFetch(
      datasetId,
      source.id,
      `latest-${nbuDate(current.year, current.month, current.day)}`,
      source.url,
    );
  }

  if (source.mode === "range-window") {
    const start = monthOffset(current.year, current.month, -source.months);
    const params = new URLSearchParams({
      start: nbuDate(start.year, start.month, 1),
      end: nbuDate(current.year, current.month, 1),
    });
    params.set("json", "");
    const url = `${stat}/${source.path}?${params.toString().replace(/json=$/, "json")}`;
    return cachedFetch(datasetId, source.id, "latest", url);
  }

  let candidates;
  if (source.cadence === "day") {
    candidates = Array.from({ length: source.lookback }, (_, index) =>
      dayOffset(current.year, current.month, current.day, -index),
    );
  } else if (source.cadence === "quarter") {
    candidates = quarterCandidates(source.lookback);
  } else if (source.cadence === "year") {
    candidates = Array.from({ length: source.lookback }, (_, index) => ({
      year: current.year + 1 - index,
      month: 1,
      day: 1,
    }));
  } else {
    candidates = Array.from({ length: source.lookback }, (_, index) =>
      monthOffset(current.year, current.month, -index),
    );
  }

  for (const candidate of candidates) {
    const key =
      source.dateFormat === "ym"
        ? nbuMonth(candidate.year, candidate.month)
        : nbuDate(candidate.year, candidate.month, candidate.day ?? 1);
    const result = await tryFetch(
      datasetId,
      source.id,
      `latest-${key}`,
      buildDatedUrl(source, candidate),
    );
    if (result) return result;
  }
  throw new Error(`No live rows found for ${datasetId}/${source.id}`);
}

function profileSchema(rows) {
  const profiles = new Map();
  for (const row of rows) {
    for (const [field, value] of Object.entries(row)) {
      if (field === "_source") continue;
      const profile = profiles.get(field) ?? {
        field,
        present: 0,
        nulls: 0,
        types: new Set(),
        examples: new Set(),
      };
      profile.present += 1;
      if (value === null || value === undefined || value === "") {
        profile.nulls += 1;
      } else {
        const type = Array.isArray(value) ? "array" : typeof value;
        profile.types.add(type);
        if (profile.examples.size < 6) {
          const example =
            typeof value === "object" ? JSON.stringify(value).slice(0, 100) : value;
          profile.examples.add(example);
        }
      }
      profiles.set(field, profile);
    }
  }
  return [...profiles.values()]
    .map((profile) => {
      const [label, description] = fieldGlossary[profile.field] ?? [
        profile.field,
        "Додатковий вимір або атрибут з офіційного набору НБУ.",
      ];
      return {
        field: profile.field,
        label,
        description,
        type: [...profile.types].join(" | ") || "null",
        coverage: rows.length ? round((profile.present / rows.length) * 100, 1) : 0,
        nulls: profile.nulls,
        examples: [...profile.examples],
      };
    })
    .sort((left, right) => {
      const order = ["dt", "txt", "id_api", "value"];
      const leftRank = order.indexOf(left.field);
      const rightRank = order.indexOf(right.field);
      if (leftRank >= 0 || rightRank >= 0) {
        return (leftRank < 0 ? 99 : leftRank) - (rightRank < 0 ? 99 : rightRank);
      }
      return left.field.localeCompare(right.field);
    });
}

function rowScore(row) {
  let score = 0;
  const level = Number(row.leveli ?? row.level ?? 9);
  if (Number.isFinite(level)) score += Math.max(0, 10 - level * 2);
  if (row.parent == null || row.parent === "відсутній") score += 4;
  const text = String(row.txt ?? row.cpdescr ?? "").toLocaleLowerCase("uk");
  if (/усього|всього|total|офіційн|загальн|чисті|індекс/.test(text)) score += 8;
  for (const [key, value] of Object.entries(row)) {
    if (!filterFields.has(key)) continue;
    if (
      value == null ||
      ["total", "#", "0", "000", "null", "відсутній"].includes(
        String(value).toLocaleLowerCase(),
      )
    ) {
      score += 1;
    }
  }
  const numeric = numericValue(row);
  if (numeric) {
    score += Number(numeric[1]) === 0 ? -24 : 6;
  }
  return score;
}

function numericValue(row) {
  const candidates = [
    ["value", row.value],
    ["Attraction", row.Attraction],
    ["AvgLevel", row.AvgLevel],
    ["rate", row.rate],
    ["auk_proc", row.auk_proc],
    ["nominal", row.nominal],
  ];
  return candidates.find(([, value]) => Number.isFinite(Number(value)));
}

function identity(row) {
  const parts = Object.entries(row)
    .filter(
      ([key, value]) =>
        !ignoredIdentityFields.has(key) &&
        key !== "_source" &&
        value !== null &&
        value !== undefined &&
        typeof value !== "object",
    )
    .sort(([left], [right]) => left.localeCompare(right));
  return parts.map(([key, value]) => `${key}=${value}`).join("|");
}

function inferUnit(item, row, measureField = "value") {
  const text = `${row.txt ?? ""} ${row.txten ?? ""}`.toLocaleLowerCase();
  if (
    item.id === "macro-indicators" &&
    row.id_api === "lmss_fund_pay_wage" &&
    row.tzep === "N_ONE"
  ) {
    return "грн";
  }
  if (
    ["uonia", "swap-index", "nbu-rates"].includes(item.id) ||
    /(_ir|PC|Rate)/i.test(String(row.tzep))
  ) {
    return "%";
  }
  if (
    measureField === "AvgLevel" ||
    measureField === "auk_proc" ||
    text.includes("%") ||
    text.includes("відсот")
  ) {
    return "%";
  }
  if (/T071USD/i.test(String(row.tzep))) return "USD";
  if (/T071EUR/i.test(String(row.tzep))) return "EUR";
  if (/T070|t070|f_m_v/.test(String(row.tzep))) return "млн грн";
  if (measureField === "Attraction") return `${row.ValCode ?? ""}`.trim();
  if (row.cc) return `грн / ${row.cc}`;
  if (item.id === "cash-fx-flows") return "USD";
  if (item.id === "fx-market") return "од. валюти";
  if (
    item.category === "Зовнішній сектор" ||
    /дол\.|usd|євро|eur/.test(text)
  ) {
    return "млн од. валюти";
  }
  if (/кільк|number|banks/.test(text)) return "од.";
  if (/курс|rate/.test(text) && row.cc) return `грн / ${row.cc}`;
  return "значення НБУ";
}

function selectIndicators(item, rows, maximum = null) {
  if (item.id === "exchange-rates") {
    return ["USD", "EUR", "PLN"]
      .map((code) => rows.find((row) => row.cc === code))
      .filter(Boolean);
  }

  const latestBySeries = new Map();
  for (const row of rows) {
    if (!numericValue(row)) continue;
    const source = datasetSources[item.id].sources.find(
      (candidate) => candidate.id === row._source,
    );
    const key = source?.allHistory
      ? `${row._source}|${row.id_api ?? row.cc ?? row.txt}|${row.tzep ?? ""}`
      : `${row._source}|${identity(row)}`;
    const existing = latestBySeries.get(key);
    const rowDate = sourceDate([row]) ?? "";
    const existingDate = existing ? sourceDate([existing]) ?? "" : "";
    if (!existing || rowDate >= existingDate) latestBySeries.set(key, row);
  }
  const definition = datasetSources[item.id];
  const limit =
    maximum ??
    definition.indicatorLimit ??
    Math.max(
      5,
      definition.sources.reduce(
        (total, source) => total + (source.indicatorCount ?? 1),
        0,
      ),
    );
  const scored = [...latestBySeries.values()]
    .filter((row) => numericValue(row))
    .map((row) => {
      let score = rowScore(row);
      const preferred = [
        ...(preferredIdsBySource[item.id]?.[row._source] ?? []),
        ...(preferredIds[item.id] ?? []),
      ];
      const preferredIndex = preferred.indexOf(row.id_api);
      if (preferredIndex >= 0) score += 100 - preferredIndex * 8;
      if (/T071USD|USD/i.test(String(row.tzep))) score += 7;
      if (/(_ir|PC|Rate)/i.test(String(row.tzep))) score += 4;
      return { row, score };
    })
    .sort(
      (left, right) =>
        right.score - left.score ||
        Math.abs(Number(numericValue(right.row)[1])) -
          Math.abs(Number(numericValue(left.row)[1])),
    );
  const selected = [];
  const seen = new Set();

  function add(row) {
    const sourcePrefersDistinctIds = Boolean(
      preferredIdsBySource[item.id]?.[row._source]?.length,
    );
    const key = sourcePrefersDistinctIds
      ? `${row._source}|${row.id_api ?? row.cc ?? row.StockCode ?? row.cpcode ?? row.txt}`
      : `${row._source}|${row.id_api ?? row.cc ?? row.StockCode ?? row.cpcode ?? row.txt}|${row.tzep ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    selected.push(row);
    return true;
  }

  for (const source of definition.sources) {
    let sourceCount = 0;
    const sourceScored = scored.filter(({ row }) => row._source === source.id);
    const sourcePreferred = preferredIdsBySource[item.id]?.[source.id] ?? [];
    for (const id of sourcePreferred) {
      if (sourceCount >= (source.indicatorCount ?? 1)) break;
      const candidate = sourceScored.find(({ row }) => row.id_api === id)?.row;
      if (candidate && add(candidate)) sourceCount += 1;
    }
    for (const { row } of sourceScored) {
      if (
        sourceCount >= (source.indicatorCount ?? 1)
      ) {
        continue;
      }
      if (add(row)) sourceCount += 1;
    }
  }
  for (const { row } of scored) {
    if (selected.length >= limit) break;
    add(row);
  }
  return selected.slice(0, limit);
}

function indicatorFromRow(item, row, index) {
  const [measureField, value] = numericValue(row);
  let title =
    row.txt ??
    row.cpdescr ??
    (row.cc ? `${row.cc} / UAH` : null) ??
    row.StockCode ??
    `${item.title} ${index + 1}`;
  if (item.id === "uonia" || item.id === "swap-index") {
    title = item.title;
  } else if (item.id === "ovdp-auctions") {
    title = `Залучено: ${row.ValCode}, погашення ${row.RepayDate}`;
  } else if (item.id === "bank-financial-statements") {
    title = `${title}: ${row.fullname ?? `банк ${row.nkb}`}`;
  } else if (item.id === "bank-account-turnover") {
    title = `${title}: банк ${row.nkb}, рахунок ${row.r020}`;
  }
  return {
    id: `${item.id}-${index + 1}`,
    seriesKey: identity(row),
    sourceId: row._source,
    sourceLabel:
      datasetSources[item.id].sources.find(
        (source) => source.id === row._source,
      )?.label ?? row._source,
    idApi: row.id_api ?? null,
    title: String(title).trim(),
    value: Number(value),
    date: toIso(
      row.dt ??
        row.exchangedate ??
        row.AuctionDate ??
        row.razm_date ??
        row.pgs_date,
    ),
    unit: inferUnit(item, row, measureField),
    measureField,
    dimensions: Object.fromEntries(
      Object.entries(row).filter(
        ([key, dimension]) =>
          filterFields.has(key) &&
          dimension !== null &&
          dimension !== undefined,
      ),
    ),
    series: [],
    notes: [],
    observationStatus: "latest",
    sourceLatestDate: null,
    _row: row,
  };
}

function matchIdentity(row, selected) {
  return identity(row) === selected.seriesKey;
}

function rowsToSeries(rows, selected) {
  return rows
    .filter((row) => matchIdentity(row, selected))
    .map((row) => {
      const value = Number(row[selected.measureField] ?? row.value);
      const date = toIso(
        row.dt ??
          row.exchangedate ??
          row.AuctionDate ??
          row.razm_date ??
          row.pgs_date,
      );
      return { date, value };
    })
    .filter((point) => point.date && Number.isFinite(point.value))
    .sort((left, right) => left.date.localeCompare(right.date));
}

function annualCandidate(source, year, latestDate) {
  if (year === current.year && latestDate && source.cadence !== "year") {
    const [candidateYear, month, day] = latestDate.split("-").map(Number);
    return { year: candidateYear, month, day };
  }
  if (source.cadence === "day") {
    return { year, month: 12, day: 31 };
  }
  return { year: year + 1, month: 1, day: 1 };
}

async function buildAnnualHistory(item, source, latestRows, indicators, latestDate) {
  const relevant = indicators.filter((indicator) => indicator.sourceId === source.id);
  if (!relevant.length) return;
  const startYear = Math.max(
    datasetSources[item.id].coverageYear,
    source.coverageYear ?? datasetSources[item.id].coverageYear,
  );
  const endYear = Math.min(
    current.year,
    source.coverageEndYear ?? current.year,
  );
  const years = Array.from(
    { length: Math.max(0, endYear - startYear + 1) },
    (_, index) => startYear + index,
  );

  await mapLimit(years, 4, async (year) => {
    const candidate = annualCandidate(source, year, latestDate);
    if (fullAnnual || latestRows.length < 5_000) {
      const key = `annual-${year}`;
      const result = await tryFetch(
        item.id,
        source.id,
        key,
        buildDatedUrl(source, candidate),
      );
      if (!result) return;
      const rows = result.rows.map((row) => ({ ...row, _source: source.id }));
      for (const indicator of relevant) {
        const match = rows.find((row) => matchIdentity(row, indicator));
        const value = Number(match?.[indicator.measureField] ?? match?.value);
        if (match && Number.isFinite(value)) {
          const partial = year === current.year;
          indicator.series.push({
            date: partial
              ? result.date ?? latestDate ?? `${year}-12-31`
              : `${year}-12-31`,
            value,
            partial,
            asOf: partial ? result.date ?? latestDate ?? null : null,
          });
        }
      }
      return;
    }

    await mapLimit(relevant, 2, async (indicator) => {
      const key = `annual-${year}-${indicator.id}`;
      let result = await tryFetch(
        item.id,
        source.id,
        key,
        buildDatedUrl(source, candidate, indicator._row),
      );
      if (!result && indicator._row.id_api) {
        result = await tryFetch(
          item.id,
          source.id,
          `${key}-id-only`,
          buildDatedUrl(source, candidate, {
            id_api: indicator._row.id_api,
          }),
        );
      }
      if (!result) return;
      const rows = result.rows.map((row) => ({ ...row, _source: source.id }));
      const match = rows.find((row) => matchIdentity(row, indicator));
      const value = Number(match?.[indicator.measureField] ?? match?.value);
      if (match && Number.isFinite(value)) {
        const partial = year === current.year;
        indicator.series.push({
          date: partial
            ? result.date ?? latestDate ?? `${year}-12-31`
            : `${year}-12-31`,
          value,
          partial,
          asOf: partial ? result.date ?? latestDate ?? null : null,
        });
      }
    });
  });
}

async function buildExchangeHistory(indicators) {
  await mapLimit(indicators, 3, async (indicator) => {
    const code = indicator._row.cc;
    const years = Array.from(
      { length: current.year - 1996 + 1 },
      (_, index) => 1996 + index,
    );
    await mapLimit(years, 4, async (year) => {
      const firstMonth = year === 1996 ? 9 : 1;
      const firstDay = year === 1996 ? 2 : 1;
      const lastMonth = year === current.year ? current.month : 12;
      const lastDay =
        year === current.year ? current.day : daysInMonth(year, lastMonth);
      const url =
        "https://bank.gov.ua/NBU_Exchange/exchange_site" +
        `?start=${nbuDate(year, firstMonth, firstDay)}` +
        `&end=${nbuDate(year, lastMonth, lastDay)}` +
        `&valcode=${code}&sort=exchangedate&order=asc&json`;
      const result = await tryFetch(
        "exchange-rates",
        `history-${code}`,
        String(year),
        url,
      );
      if (!result) return;
      const values = result.rows
        .map((row) => Number(row.rate_per_unit ?? row.rate))
        .filter(Number.isFinite);
      if (!values.length) return;
      indicator.series.push({
        date:
          year === current.year
            ? sourceDate(result.rows) ?? `${year}-12-31`
            : `${year}-12-31`,
        value: round(
          values.reduce((total, value) => total + value, 0) / values.length,
          4,
        ),
        partial: year === current.year,
        asOf: year === current.year ? sourceDate(result.rows) ?? null : null,
      });
    });
  });
}

async function buildRangeHistory(item, source, indicator) {
  const startYear = datasetSources[item.id].coverageYear;
  const years = Array.from(
    { length: current.year - startYear + 1 },
    (_, index) => startYear + index,
  );
  await mapLimit(years, 3, async (year) => {
    const start = nbuDate(year, 1, 1);
    const end =
      year === current.year
        ? nbuDate(current.year, current.month, current.day)
        : nbuDate(year, 12, 31);
    const params = new URLSearchParams({ start, end });
    for (const [key, value] of Object.entries(indicator._row)) {
      if (
        queryFilterFields.has(key) &&
        value != null &&
        typeof value !== "object"
      ) {
        params.set(key, String(value));
      }
    }
    params.set("json", "");
    const url = `${stat}/${source.path}?${params.toString().replace(/json=$/, "json")}`;
    const result = await tryFetch(
      item.id,
      source.id,
      `annual-${year}-${indicator.id}`,
      url,
    );
    if (!result) return;
    const rows = result.rows.map((row) => ({ ...row, _source: source.id }));
    const matching = rows.filter(
      (row) =>
        row.id_api === indicator._row.id_api &&
        (indicator._row.tzep == null || row.tzep === indicator._row.tzep),
    );
    const values = matching.map((row) => Number(row.value)).filter(Number.isFinite);
    if (!values.length) return;
    indicator.series.push({
      date:
        year === current.year
          ? sourceDate(matching) ?? `${year}-12-31`
          : `${year}-12-31`,
      value: round(values.reduce((total, value) => total + value, 0), 4),
      partial: year === current.year,
      asOf: year === current.year ? sourceDate(matching) ?? null : null,
    });
  });
}

function compactSeries(points, cadence) {
  if (points.length <= 180 || cadence !== "day") return points;
  const monthly = new Map();
  for (const point of points) {
    const key = point.date.slice(0, 7);
    const bucket = monthly.get(key) ?? [];
    bucket.push(point.value);
    monthly.set(key, bucket);
  }
  return [...monthly.entries()].map(([month, values]) => ({
    date: `${month}-01`,
    value: round(
      values.reduce((total, value) => total + value, 0) / values.length,
      4,
    ),
  }));
}

function isCumulativeIndicator(item, indicator) {
  const text = `${indicator.title} ${indicator._row?.txten ?? ""}`;
  return (
    /кумулятив|з початку року|cumulative|year.to.date|\bytd\b/i.test(text) ||
    item.id === "bank-income-expenses" ||
    indicator.sourceId === "budget-monthly" ||
    String(indicator._row?.tzep ?? "").toUpperCase() === "PCCP_"
  );
}

function cleanIndicator(item, indicator, source) {
  const { _row, ...clean } = indicator;
  clean.series = compactSeries(
    [...clean.series].sort((left, right) => left.date.localeCompare(right.date)),
    source?.cadence,
  );

  const documentedMissingPoints = clean.series.filter(
    (point) =>
      point.value === 0 &&
      indicator.sourceId === "labor-monthly" &&
      source?.limitation,
  );
  const documentedMissingZero = documentedMissingPoints.length > 0;
  if (documentedMissingZero) {
    clean.series = clean.series.filter(
      (point) => !documentedMissingPoints.includes(point),
    );
    const lastPublished = clean.series.findLast((point) => point.value !== 0);
    if (lastPublished && clean.value === 0) {
      clean.value = lastPublished.value;
      clean.date = lastPublished.date;
      clean.observationStatus = "last-published";
      clean.sourceLatestDate = indicator.date;
    }
  }

  if (!clean.series.length && clean.date) {
    clean.series = [{ date: clean.date, value: clean.value }];
  }
  const intervals = clean.series
    .slice(1)
    .map(
      (point, index) =>
        new Date(point.date).valueOf() -
        new Date(clean.series[index].date).valueOf(),
    )
    .filter((interval) => Number.isFinite(interval) && interval > 0)
    .sort((left, right) => left - right);
  const medianInterval = intervals[Math.floor(intervals.length / 2)];
  if (medianInterval) {
    clean.series = clean.series.map((point, index) => {
      if (!index) return point;
      const interval =
        new Date(point.date).valueOf() -
        new Date(clean.series[index - 1].date).valueOf();
      return interval > medianInterval * 1.75
        ? { ...point, gapBefore: true }
        : point;
    });
  }

  clean.notes = [];
  if (source?.limitation) {
    clean.notes.push(
      `Доступні спостереження показано без заповнення прогалин. ${source.limitation}`,
    );
  }
  if (documentedMissingZero) {
    clean.notes.push(
      clean.observationStatus === "last-published"
        ? `Нульові службові значення НБУ вилучено з графіка. Використано останнє опубліковане значення станом на ${clean.date}.`
        : "Нульові службові значення за період без публікацій вилучено; розрив показано без з’єднувальної лінії.",
    );
  }
  if (isCumulativeIndicator(item, indicator)) {
    clean.notes.push(
      "Це кумулятивне значення від початку року або відповідного періоду, а не результат лише за окремий місяць.",
    );
  }
  const partial = clean.series.findLast((point) => point.partial);
  if (partial) {
    clean.notes.push(
      `${current.year} показано за останнім доступним спостереженням станом на ${partial.asOf ?? partial.date}; це не фінальний річний підсумок.`,
    );
  }
  return clean;
}

function buildRegionalPerspective(item, rows) {
  const field = Object.keys(regionCodebooks).find((candidate) =>
    rows.some(
      (row) =>
        row[candidate] != null &&
        String(row[candidate]).toLocaleLowerCase() !== "total",
    ),
  );
  if (!field) {
    return {
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
  }

  const codebook = regionCodebooks[field];
  const regionalRows = rows.filter(
    (row) =>
      row[field] != null &&
      String(row[field]).toLocaleLowerCase() !== "total",
  );
  const regions = new Map();
  const series = new Set();
  for (const row of regionalRows) {
    const code = String(row[field]);
    const existing = regions.get(code) ?? {
      code,
      name: codebook.names[code] ?? `Регіон ${code}`,
      rowCount: 0,
      latestDate: null,
    };
    existing.rowCount += 1;
    const date = sourceDate([row]);
    if (date && (!existing.latestDate || date > existing.latestDate)) {
      existing.latestDate = date;
    }
    regions.set(code, existing);
    if (row.id_api) series.add(row.id_api);
  }

  return {
    available: true,
    field,
    codeSystem: codebook.codeSystem,
    description: codebook.description,
    joinNote: codebook.joinNote,
    regionCount: regions.size,
    rowCount: regionalRows.length,
    seriesCount: series.size,
    regions: [...regions.values()].sort(
      (left, right) => Number(left.code) - Number(right.code),
    ),
    source: "Національний банк України",
    datasetId: item.id,
  };
}

function buildSourceCoverage(item, sourceResults, indicators) {
  return sourceResults.map((result) => {
    const snapshots = getSourceSnapshots.all(item.id, result.source.id);
    const annual = snapshots.filter(
      (snapshot) =>
        snapshot.snapshot_key.startsWith("annual-") &&
        snapshot.row_count > 0,
    );
    const annualYears = annual
      .map((snapshot) =>
        Number(snapshot.snapshot_key.match(/^annual-(\d{4})/)?.[1]),
      )
      .filter(Number.isFinite)
      .sort((left, right) => left - right);
    const chartedPoints = indicators
      .filter((indicator) => indicator.sourceId === result.source.id)
      .reduce((total, indicator) => total + indicator.series.length, 0);

    return {
      id: result.source.id,
      label: result.source.label ?? result.source.id,
      status: "included",
      description:
        result.source.description ??
        `Офіційний зріз НБУ: ${result.source.label ?? result.source.id}.`,
      availability:
        result.source.availability ??
        `Історичне покриття перевіряється від ${result.source.coverageYear ?? datasetSources[item.id].coverageYear} року.`,
      limitation: result.source.limitation ?? null,
      latestDate: result.date,
      latestRows: result.rows.length,
      latestUrl: result.url,
      cadence: result.source.cadence ?? "snapshot",
      chartedPoints,
      cache: {
        snapshots: snapshots.length,
        rows: snapshots.reduce(
          (total, snapshot) => total + snapshot.row_count,
          0,
        ),
        bytes: snapshots.reduce(
          (total, snapshot) => total + snapshot.byte_count,
          0,
        ),
      },
      annualSnapshots: {
        count: annual.length,
        firstYear: annualYears.at(0) ?? null,
        lastYear: annualYears.at(-1) ?? null,
        rows: annual.reduce(
          (total, snapshot) => total + snapshot.row_count,
          0,
        ),
      },
    };
  });
}

function coverageMarkdown(report) {
  const lines = [
    "# Аудит покриття NBU Data Corner",
    "",
    `Згенеровано: ${report.generatedAt}. Наборів: ${report.datasetCount}. Офіційних підджерел: ${report.sourceCount}. Регіональний зріз: ${report.regionalDatasetCount} набори.`,
    "",
    "Статус «включено» означає, що джерело прочитано, останній зріз експортовано, а доступні річні зрізи збережено у локальному SQLite. Обмеження НБУ не заповнюються припущеннями.",
    "",
  ];
  for (const dataset of report.datasets) {
    lines.push(`## ${dataset.number}. ${dataset.title}`, "");
    lines.push(
      `Остання дата: ${dataset.latestDate || "не визначено"}. Рядків у поточному експорті: ${dataset.latestRows}.`,
      "",
    );
    if (dataset.regionalPerspective.available) {
      lines.push(
        `Регіональна перспектива: ${dataset.regionalPerspective.regionCount} кодів, ${dataset.regionalPerspective.rowCount} рядків; поле ${dataset.regionalPerspective.field}.`,
        "",
      );
    }
    for (const source of dataset.sources) {
      const years = source.annualSnapshots.count
        ? `${source.annualSnapshots.firstYear}–${source.annualSnapshots.lastYear}`
        : "окремі річні зрізи не застосовуються";
      lines.push(
        `- **${source.label}** — включено ${source.latestRows} рядків; річний кеш: ${years} (${source.annualSnapshots.count} зрізів). ${source.description}`,
      );
      lines.push(`  Доступність: ${source.availability}`);
      if (source.limitation) lines.push(`  Обмеження: ${source.limitation}`);
    }
    lines.push("");
  }
  return `${lines.join("\n")}\n`;
}

function csvEscape(value) {
  if (value == null) return "";
  const text = typeof value === "object" ? JSON.stringify(value) : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function rowsToCsv(rows, fields) {
  return [
    fields.map(csvEscape).join(","),
    ...rows.map((row) => fields.map((field) => csvEscape(row[field])).join(",")),
  ].join("\n");
}

async function writeDatasetFiles(item, rows, schema, summary) {
  const directory = resolve(outputRoot, item.id);
  await mkdir(directory, { recursive: true });
  const cleanRows = rows.map(({ _source, ...row }) => ({
    source: _source,
    ...row,
  }));
  const fields = ["source", ...schema.map((field) => field.field)];
  const jsonChunks = [];
  const csvChunks = [];
  for (let index = 0; index < cleanRows.length; index += chunkSize) {
    const number = String(Math.floor(index / chunkSize) + 1).padStart(3, "0");
    const name = `latest-${number}.json`;
    const slice = cleanRows.slice(index, index + chunkSize);
    await writeFile(resolve(directory, name), JSON.stringify(slice));
    jsonChunks.push({
      url: `/data/dataroom/${item.id}/${name}`,
      rows: slice.length,
    });
  }
  for (let index = 0; index < cleanRows.length; index += csvChunkSize) {
    const number = String(Math.floor(index / csvChunkSize) + 1).padStart(3, "0");
    const name = `latest-${number}.csv`;
    const slice = cleanRows.slice(index, index + csvChunkSize);
    await writeFile(resolve(directory, name), `${rowsToCsv(slice, fields)}\n`);
    csvChunks.push({
      url: `/data/dataroom/${item.id}/${name}`,
      rows: slice.length,
    });
  }
  const annualRows = summary.indicators.flatMap((indicator) =>
    indicator.series.map((point) => ({
      series_id: indicator.id,
      indicator: indicator.title,
      date: point.date,
      as_of: point.asOf ?? point.date,
      value: point.value,
      unit: indicator.unit,
      partial: point.partial ?? false,
    })),
  );
  const regionsJson = summary.regionalPerspective.available
    ? `/data/dataroom/${item.id}/regions.json`
    : null;
  const exports = {
    jsonChunks,
    csvChunks,
    annualCsv: `/data/dataroom/${item.id}/annual.csv`,
    regionsJson,
  };
  const writes = [
    writeFile(
      resolve(directory, "summary.json"),
      `${JSON.stringify({
        ...summary,
        exports,
      })}\n`,
    ),
    writeFile(
      resolve(directory, "schema.json"),
      `${JSON.stringify(schema, null, 2)}\n`,
    ),
    writeFile(
      resolve(directory, "annual.csv"),
      `${rowsToCsv(annualRows, [
        "series_id",
        "indicator",
        "date",
        "as_of",
        "value",
        "unit",
        "partial",
      ])}\n`,
    ),
    writeFile(
      resolve(directory, "README.md"),
      `# ${item.title}\n\n${summary.description}\n\n## Просте питання\n\n${summary.question}\n\n## Навіщо стежити\n\n${summary.why}\n\n- Остання дата: ${summary.freshness.latestDate || "не визначено"}\n- Рядків у найновішому зрізі: ${summary.freshness.rowCount.toLocaleString("uk-UA")}\n- Полів: ${schema.length}\n- Частота: ${item.frequency}\n- Регіональна перспектива: ${summary.regionalPerspective.available ? `${summary.regionalPerspective.regionCount} кодів у полі ${summary.regionalPerspective.field}` : "у цьому наборі відсутня"}\n\nДжерело: Національний банк України. Згенеровано ${generatedAt}.\n`,
    ),
  ];
  if (regionsJson) {
    writes.push(
      writeFile(
        resolve(directory, "regions.json"),
        `${JSON.stringify(
          {
            ...summary.regionalPerspective,
            generatedAt,
            dataFiles: jsonChunks,
          },
          null,
          2,
        )}\n`,
      ),
    );
  }
  await Promise.all(writes);
  return exports;
}

function dashboardCard(item, summary) {
  const lead = summary.indicators[0];
  return {
    id: item.id,
    number: item.number,
    title: item.title,
    category: item.category,
    description: summary.description,
    question: summary.question,
    frequency: item.frequency,
    coverageStart: item.coverageStart,
    latestDate: summary.freshness.latestDate,
    rowCount: summary.freshness.rowCount,
    fieldCount: summary.schema.length,
    value: lead?.value ?? null,
    unit: lead?.unit ?? "",
    indicatorTitle: lead?.title ?? "Останній доступний зріз",
    sparkline: (lead?.series ?? []).slice(-16),
    regional: {
      available: summary.regionalPerspective.available,
      field: summary.regionalPerspective.field,
      regionCount: summary.regionalPerspective.regionCount,
      rowCount: summary.regionalPerspective.rowCount,
    },
    url: `/dataset/${item.id}`,
  };
}

const cards = [];
const failures = [];
const coverageEntries = [];

for (const item of catalogue) {
  const definition = datasetSources[item.id];
  if (!definition) {
    failures.push({ id: item.id, error: "No source definition" });
    continue;
  }
  console.log(`Fetching ${String(item.number).padStart(2, "0")} ${item.id}...`);
  try {
    const sourceResults = await mapLimit(definition.sources, 3, async (source) => {
      const result = await fetchLatestSource(item.id, source);
      return {
        source,
        ...result,
        rows: result.rows.map((row) => ({ ...row, _source: source.id })),
      };
    });
    const rows = sourceResults.flatMap((result) => result.rows);
    const schema = profileSchema(rows);
    const selectedRows = selectIndicators(item, rows);
    const indicators = selectedRows.map((row, index) =>
      indicatorFromRow(item, row, index),
    );

    if (definition.history.mode === "exchange") {
      await buildExchangeHistory(indicators);
    } else if (definition.history.mode === "rows") {
      for (const indicator of indicators) {
        const source = sourceResults.find(
          (candidate) => candidate.source.id === indicator.sourceId,
        );
        indicator.series = rowsToSeries(source?.rows ?? [], indicator);
      }
    } else if (definition.history.mode === "annual-range") {
      const source = definition.sources[0];
      await mapLimit(indicators.slice(0, 3), 2, (indicator) =>
        buildRangeHistory(item, source, indicator),
      );
    } else {
      await mapLimit(sourceResults, 2, async (result) => {
        await buildAnnualHistory(
          item,
          result.source,
          result.rows,
          indicators,
          result.date,
        );
      });
    }

    const cleanIndicators = indicators.map((indicator) =>
      cleanIndicator(
        item,
        indicator,
        definition.sources.find((source) => source.id === indicator.sourceId),
      ),
    );
    deleteSeries.run(item.id);
    for (const indicator of cleanIndicators) {
      for (const point of indicator.series) {
        putSeriesPoint.run(
          item.id,
          indicator.id,
          point.date,
          point.value,
          indicator.title,
          indicator.unit,
        );
      }
    }
    const latestDate = sourceResults
      .map((result) => result.date)
      .filter(Boolean)
      .sort()
      .at(-1);
    const content = datasetContent[item.id];
    const coverage = buildSourceCoverage(
      item,
      sourceResults,
      cleanIndicators,
    );
    const regionalPerspective = buildRegionalPerspective(item, rows);
    const summary = {
      ...item,
      status: "live",
      description: content.description,
      question: content.question,
      why: content.why,
      freshness: {
        generatedAt,
        latestDate,
        rowCount: rows.length,
        bytes: sourceResults.reduce(
          (total, result) => total + Buffer.byteLength(JSON.stringify(result.rows)),
          0,
        ),
        sources: sourceResults.map((result) => ({
          id: result.source.id,
          label: result.source.label ?? result.source.id,
          latestDate: result.date,
          rowCount: result.rows.length,
          url: result.url,
        })),
      },
      schema,
      indicators: cleanIndicators,
      coverage,
      regionalPerspective,
    };
    const exports = await writeDatasetFiles(item, rows, schema, summary);
    summary.exports = exports;
    putDataset.run(
      item.id,
      generatedAt,
      latestDate ?? null,
      rows.length,
      schema.length,
      JSON.stringify(summary),
    );
    cards.push(dashboardCard(item, summary));
    coverageEntries.push({
      id: item.id,
      number: item.number,
      title: item.title,
      latestDate,
      latestRows: rows.length,
      sources: coverage,
      regionalPerspective,
    });
  } catch (error) {
    console.error(`  ${item.id}: ${(error).message}`);
    failures.push({ id: item.id, error: String((error).message ?? error) });
  }
}

const coverageReport = {
  generatedAt,
  datasetCount: coverageEntries.length,
  regionalDatasetCount: coverageEntries.filter(
    (dataset) => dataset.regionalPerspective.available,
  ).length,
  sourceCount: coverageEntries.reduce(
    (total, dataset) => total + dataset.sources.length,
    0,
  ),
  datasets: coverageEntries.sort(
    (left, right) => left.number - right.number,
  ),
};

const manifest = {
  meta: {
    generatedAt,
    source: "Національний банк України",
    sourceUrl: "https://bank.gov.ua/ua/open-data/api-dev",
    datasetCount: catalogue.length,
    liveDatasetCount: cards.length,
    failedDatasetCount: failures.length,
    regionalDatasetCount: cards.filter(
      (dataset) => dataset.regional.available,
    ).length,
    localDatabase: "data/nbu-dataroom.sqlite",
    storageModel: "SQLite source of truth + partitioned static JSON/CSV/MD",
    coverageReport: {
      json: "/data/dataroom/coverage-report.json",
      markdown: "/data/dataroom/coverage-report.md",
    },
  },
  datasets: cards.sort((left, right) => left.number - right.number),
  failures,
};

await Promise.all([
  writeFile(
    resolve(outputRoot, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
  ),
  writeFile(
    resolve(outputRoot, "coverage-report.json"),
    `${JSON.stringify(coverageReport, null, 2)}\n`,
  ),
  writeFile(
    resolve(outputRoot, "coverage-report.md"),
    coverageMarkdown(coverageReport),
  ),
]);
db.close();

if (failures.length) {
  await rm(outputRoot, { recursive: true, force: true });
  throw new Error(
    `Dataroom build aborted with ${failures.length} failed datasets; the live static release was not replaced.`,
  );
}

await rm(liveOutputRoot, { recursive: true, force: true });
await rename(outputRoot, liveOutputRoot);

console.log(
  `Dataroom generated: ${cards.length}/${catalogue.length} live datasets, ${failures.length} failures.`,
);
console.log(`SQLite: ${databasePath}`);
console.log(`Static manifest: ${resolve(liveOutputRoot, "manifest.json")}`);
if (!fullAnnual) {
  console.log(
    "Primary-series annual mode used. Set RI_FULL_ANNUAL=1 to cache complete annual snapshots.",
  );
}
