import {
  buildPublicRelease,
  createCornerDatabase,
  fetchCached,
  insertDatasets,
  parseCsv,
  periodToDate,
  slugify,
  toNumber,
} from "./common.mjs";

const base = "https://sdmx.oecd.org/public/rest/v1";
const candidates = [
  ["OECD.CTP.TPS", "DSD_REV_GLOBAL@DF_REVUKR", "2.1", "Податкові й неподаткові доходи України", "Податки"],
  ["OECD.TAD.ADM", "DSD_FFS@DF_FFS_UKR", "3.0", "Підтримка викопного палива в Україні", "Енергія і клімат"],
  ["OECD.ECO.MAD", "DSD_EO@DF_EO", "1.5", "OECD Economic Outlook", "Макроекономіка"],
  ["OECD.DCD.FSD", "DSD_DAC2@DF_DAC2A", "1.6", "Допомога Україні: виплати", "Міжнародна допомога"],
  ["OECD.DCD.FSD", "DSD_DAC2@DF_DAC3A", "1.6", "Допомога Україні: зобов’язання", "Міжнародна допомога"],
  ["OECD.DCD.FSD", "DSD_GDFF@DF_IND", "1.0", "Показники країн-отримувачів допомоги", "Міжнародна допомога"],
  ["OECD.DCD.FSD", "DSD_GNDR@DF_GENDER", "1.6", "Допомога для гендерної рівності", "Міжнародна допомога"],
  ["OECD.DCD.FSD", "DSD_RIOMRKR@DF_RIOMARKERS", "1.6", "Кліматичні цілі міжнародної допомоги", "Міжнародна допомога"],
  ["OECD.DAF.INV", "DSD_FDIRRI_SCORES@DF_FDIRRI_SCORES", "2.0", "Обмеження для прямих іноземних інвестицій", "Інвестиції"],
  ["OECD.ELS.IMD", "DSD_MIG@DF_MIG", "1.0", "Міжнародна міграція", "Люди і міграція"],
  ["OECD.ELS.HD", "DSD_HEALTH_WFMI@DF_HEALTH_WFMI", "1.0", "Міграція медичних працівників", "Люди і міграція"],
  ["OECD.ENV.EPI", "DSD_AIR_GHG@DF_AIR_GHG", "1.0", "Викиди парникових газів", "Енергія і клімат"],
  ["OECD.ENV.EPI", "DSD_CAPMF@DF_CAPMF", "1.0", "Кліматичні дії та політики", "Енергія і клімат"],
  ["OECD.ECO.MAD", "DSD_EPS@DF_EPS", "1.0", "Жорсткість екологічної політики", "Енергія і клімат"],
  ["OECD.STI.PIE", "DSD_BTIGE@DF_BTIGE", "1.0", "Торгівля товарами за кінцевим використанням", "Торгівля"],
  ["OECD.STI.PIE", "DSD_ICIO_GHG_MAIN_2025@DF_ICIO_GHG_MAIN_2025", "1.0", "Вуглецевий слід економіки", "Енергія і клімат"],
  ["OECD.GOV.GIP", "DSD_GOV@DF_GOV_2025", "1.0", "Уряд під поглядом OECD", "Державне управління"],
  ["OECD.GOV.GIP", "DSD_QDD_GOV_REG@DF_GOV_REG", "1.0", "Якість регуляторного управління", "Державне управління"],
  ["OECD.CFE.RDG", "DSD_SNG_WOFI@DF_FINANCE", "1.0", "Фінанси місцевого самоврядування", "Державне управління"],
  ["OECD.EDU.IMEP", "DSD_EAG_UOE_FIN@DF_UOE_INDIC_FIN_GDP", "1.0", "Видатки на освіту у відсотках ВВП", "Освіта"],
];

function constraintUrl(agency, id) {
  return `${base}/contentconstraint/${agency}/CR_A_${id}/latest?references=all`;
}

function findConstraint(payload) {
  const stack = [payload];
  while (stack.length) {
    const item = stack.pop();
    if (!item || typeof item !== "object") continue;
    if (Array.isArray(item)) {
      stack.push(...item);
    } else {
      if (Array.isArray(item.cubeRegions)) return item;
      stack.push(...Object.values(item));
    }
  }
  return null;
}

function filterComponent(constraint) {
  const values = constraint?.cubeRegions?.[0]?.keyValues ?? [];
  const priorities = [
    "RECIPIENT",
    "REF_AREA",
    "COUNTRY",
    "REPORTER",
    "ORIGIN",
    "PARTNER",
    "COUNTERPART_AREA",
  ];
  return values
    .filter((item) => item.values?.includes("UKR"))
    .sort((a, b) => {
      const ai = priorities.indexOf(a.id);
      const bi = priorities.indexOf(b.id);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    })[0] ?? null;
}

function dataUrl(agency, id, version, constraint, component) {
  const values = constraint?.cubeRegions?.[0]?.keyValues ?? [];
  const dimensions = values.filter((item) => item.id !== "TIME_PERIOD");
  const key = dimensions.map((item) => item.id === component?.id ? "UKR" : "").join(".");
  const params = new URLSearchParams({
    startPeriod: "1991",
    dimensionAtObservation: "AllDimensions",
  });
  return `${base}/data/${agency},${id},${version}/${key}?${params}`;
}

const datasets = [];
const failures = [];
for (let index = 0; index < candidates.length; index += 1) {
  const [agency, id, version, title, category] = candidates[index];
  try {
    const constraintBody = await fetchCached(
      constraintUrl(agency, id),
      `oecd/constraints/${slugify(`${agency}-${id}`)}.json`,
      {
        headers: {
          accept: "application/vnd.sdmx.structure+json;version=1.0",
          "accept-language": "en",
        },
      },
    );
    const constraint = findConstraint(JSON.parse(constraintBody.toString("utf8")));
    const component = filterComponent(constraint);
    const explicitUkraine = /REVUKR|FFS_UKR/.test(id);
    if (!component && !explicitUkraine) {
      failures.push({
        id,
        error: "Актуальне обмеження OECD не підтверджує код UKR у вимірах цього dataflow.",
      });
      console.log(`OECD skip ${id}: UKR not in constraint`);
      continue;
    }
    const url = dataUrl(agency, id, version, constraint, component);
    const body = await fetchCached(
      url,
      `oecd/data/${slugify(`${agency}-${id}`)}.csv`,
      { headers: { accept: "text/csv", "accept-language": "en" } },
    );
    const parsed = parseCsv(body.toString("utf8"), ",");
    if (!parsed.length) {
      failures.push({ id, error: "OECD підтвердив вимір UKR, але поточний data query повернув 0 рядків." });
      continue;
    }
    const rows = parsed
      .map((raw) => {
        const rawValue = toNumber(raw["OBS_VALUE"] ?? raw["Observation value"]);
        const multiplier =
          toNumber(raw["UNIT_MULT"] ?? raw["Unit multiplier"]) ?? 0;
        const value = rawValue === null ? null : rawValue * (10 ** multiplier);
        const timePeriod = raw.TIME_PERIOD ?? raw["Time period"];
        const dimensions = Object.fromEntries(
          Object.entries(raw).filter(([field]) =>
            !["OBS_VALUE", "Observation value", "TIME_PERIOD", "Time period"].includes(field)
          ),
        );
        const indicatorFields = [
          "MEASURE",
          "TRANSACTION",
          "INDICATOR",
          "TAX",
          "FLOW",
          "FUEL",
          "SECTOR",
          "PURPOSE",
        ];
        const indicatorCode = indicatorFields
          .map((field) => raw[field])
          .filter(Boolean)
          .join("|") || id;
        const labelFields = [
          "Measure",
          "Transaction",
          "Indicator",
          "Tax",
          "Flow",
          "Fuel",
          "Sector",
          "Purpose",
        ];
        const indicatorLabel = labelFields
          .map((field) => raw[field])
          .filter(Boolean)
          .join(" · ") || title;
        const rawUnit =
          raw["Unit of measure"] ?? raw.UNIT_MEASURE ?? "значення";
        return {
          timePeriod,
          date: periodToDate(timePeriod),
          value,
          indicatorCode,
          indicatorLabel,
          unit: /^PT(?:_|$)/.test(rawUnit) ? "%" : rawUnit,
          freq: raw.FREQ ?? "A",
          dimensions,
          attributes: {
            status: raw["Observation status"] ?? raw.OBS_STATUS,
            multiplier,
          },
          raw,
        };
      })
      .filter((row) => row.value !== null && /^\d{4}/.test(row.timePeriod ?? ""));
    if (!rows.length) {
      failures.push({ id, error: "Відповідь OECD не містить числових часових спостережень після нормалізації." });
      continue;
    }
    datasets.push({
      id: slugify(id.replace("@", "-")),
      number: datasets.length + 1,
      flowId: `${agency}:${id}`,
      version,
      title,
      category,
      priority: datasets.length < 8 ? "hero" : "top",
      frequency: "Річна та/або висока частота",
      officialUrl: `https://data-explorer.oecd.org/vis?df[ag]=${agency}&df[id]=${encodeURIComponent(id)}`,
      sourceUrl: url,
      fetchMode: component ? `complete UKR slice via ${component.id}` : "Ukraine-specific dataflow",
      description: `${title}: усі числові спостереження, які поточна структура OECD прямо пов’язує з Україною.`,
      question: `Що дані OECD говорять про Україну у темі «${title}»?`,
      why: "OECD робить показники країн зіставними. Спочатку перевір одиницю, частоту й визначення, а вже потім порівнюй зміни.",
      annualization: "Річні точки показано прямо; місячні й квартальні ряди не сумуються без методологічної підстави",
      limitation: null,
      availability: Object.fromEntries(
        (constraint?.cubeRegions?.[0]?.keyValues ?? []).map((item) => [
          item.id,
          (item.values ?? []).map((code) => ({ code, label: code })),
        ]),
      ),
      rows,
    });
    console.log(`OECD ${id}: ${rows.length} rows`);
  } catch (error) {
    failures.push({ id, error: error.message });
    console.log(`OECD failed ${id}: ${error.message}`);
  }
}

const { db, databasePath } = await createCornerDatabase("oecd");
insertDatasets(db, datasets);
await buildPublicRelease("oecd", db, datasets, failures);
db.close();
console.log(`OECD corner: ${datasets.length} rooms, ${failures.length} rejected candidates -> ${databasePath}`);
