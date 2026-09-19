import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  buildPublicRelease,
  createCornerDatabase,
  generatedAt,
  insertDatasets,
  publicRoot,
  root,
} from "./common.mjs";

const cornerDefinitions = [
  {
    id: "nbu",
    name: "NBU",
    title: "Національний банк України",
    titleEn: "National Bank of Ukraine",
    url: "https://dataukraine.proto.fund/corner/nbu",
    manifestUrl: "https://nbu.proto.fund/api/nbu-data/dataroom/manifest.json",
    localDataRoot: resolve(publicRoot, "nbu"),
    role: "Гроші, банки, валютний ринок і зовнішній сектор",
    roleEn: "Money, banks, the FX market and the external sector",
    description: "Як рухаються гривня, ставки, кредити, резерви та платіжний баланс.",
    descriptionEn: "See how the hryvnia, rates, credit, reserves and the balance of payments move.",
  },
  {
    id: "stat",
    name: "STAT",
    title: "Держстат України",
    titleEn: "State Statistics Service of Ukraine",
    url: "https://dataukraine.proto.fund/corner/stat",
    manifestUrl: "https://stat.proto.fund/api/stat-data/dataroom/manifest.json",
    localDataRoot: resolve(publicRoot, "stat"),
    role: "Офіційна економіка, люди, регіони й виробництво",
    roleEn: "The official economy, people, regions and production",
    description: "Що реально виробляє, продає, заробляє і споживає країна та її регіони.",
    descriptionEn: "What Ukraine and its regions produce, sell, earn and consume.",
  },
  {
    id: "budget",
    name: "BUDGET",
    title: "Open Budget",
    titleEn: "Open Budget",
    url: "https://dataukraine.proto.fund/corner/budget",
    role: "Доходи, видатки, фінансування і кредитування бюджету",
    roleEn: "Budget revenue, spending, financing and lending",
    description: "Звідки держава бере гроші та на що їх витрачає.",
    descriptionEn: "Where public money comes from and what the government spends it on.",
  },
  {
    id: "oecd",
    name: "OECD",
    title: "OECD Data Explorer",
    titleEn: "OECD Data Explorer",
    url: "https://dataukraine.proto.fund/corner/oecd",
    role: "Міжнародно зіставні політики, допомога і викиди",
    roleEn: "Internationally comparable policy, aid and emissions data",
    description: "Як Україна виглядає у підтверджених рядах OECD.",
    descriptionEn: "How Ukraine appears in verified OECD series.",
  },
  {
    id: "wb",
    name: "WORLD BANK",
    title: "World Bank",
    titleEn: "World Bank",
    url: "https://dataukraine.proto.fund/corner/wb",
    role: "Розвиток, люди, інфраструктура і прогноз зростання",
    roleEn: "Development, people, infrastructure and growth forecasts",
    description: "Довга міжнародна картина України та прогноз Global Economic Prospects.",
    descriptionEn: "A long international view of Ukraine plus the Global Economic Prospects forecast.",
  },
  {
    id: "ilostat",
    name: "ILOSTAT",
    title: "International Labour Organization",
    titleEn: "International Labour Organization",
    url: "https://dataukraine.proto.fund/corner/ilostat",
    role: "Зайнятість, безробіття, зарплати й структура праці",
    roleEn: "Employment, unemployment, wages and the structure of work",
    description: "Хто працює, хто шукає роботу і як змінюються умови праці.",
    descriptionEn: "Who works, who is looking for work and how working conditions change.",
  },
  {
    id: "imf",
    name: "IMF",
    title: "International Monetary Fund",
    titleEn: "International Monetary Fund",
    url: "https://dataukraine.proto.fund/corner/imf",
    role: "Макроекономіка, державні фінанси, борг і прогнози",
    roleEn: "Macroeconomics, public finance, debt and forecasts",
    description: "Історія та прогноз IMF з чіткою межею між фактом і сценарієм.",
    descriptionEn: "IMF history and forecasts with a visible boundary between observations and scenarios.",
  },
  {
    id: "eurostat",
    name: "EUROSTAT",
    title: "Eurostat",
    titleEn: "Eurostat",
    url: "https://dataukraine.proto.fund/corner/eurostat",
    role: "Україна у європейських класифікаціях",
    roleEn: "Ukraine in European statistical classifications",
    description: "Економіка, люди, енергія, довкілля, агро і торгівля у форматі ЄС.",
    descriptionEn: "Economy, people, energy, environment, agriculture and trade in EU formats.",
  },
  {
    id: "comtrade",
    name: "COMTRADE",
    title: "UN Comtrade",
    titleEn: "UN Comtrade",
    url: "https://dataukraine.proto.fund/corner/comtrade",
    role: "Торгівля за товарами і партнерами",
    roleEn: "Trade by product and partner",
    description: "Що Україна продає світу, що купує і від кого залежить.",
    descriptionEn: "What Ukraine sells to the world, what it buys and which partners matter.",
  },
  {
    id: "tradingeconomics",
    name: "TRADING ECONOMICS",
    title: "Trading Economics",
    titleEn: "Trading Economics",
    url: "https://dataukraine.proto.fund/corner/tradingeconomics",
    role: "Короткий модельний прогноз і ринковий консенсус",
    roleEn: "Short-horizon model forecasts and market consensus",
    description: "Зовнішній прогнозний погляд для зіставлення з IMF та World Bank.",
    descriptionEn: "An external forecast view to compare with the IMF and World Bank.",
  },
  {
    id: "industrial",
    name: "INDUSTRY",
    title: "Промисловість RI",
    titleEn: "RI Industrial Economy",
    url: "https://dataukraine.proto.fund/corner/industrial",
    role: "Промисловість, енергія, інфраструктура та сценарні розрахунки",
    roleEn: "Industry, energy, infrastructure and scenario calculations",
    description: "Виробничі потужності, випуск, торгівля, ресурси та сценарні ряди з RI buckets 08–11.",
    descriptionEn: "Capacity, output, trade, resources and scenario series from RI buckets 08–11.",
  },
  {
    id: "worldsteel",
    name: "WORLDSTEEL",
    title: "Всесвітня асоціація сталі",
    titleEn: "World Steel Association",
    url: "https://dataukraine.proto.fund/corner/worldsteel",
    role: "Місячне та річне виробництво сирої сталі",
    roleEn: "Monthly and annual crude steel production",
    description: "Україна, Польща, Румунія та Туреччина на одній шкалі виробництва сталі.",
    descriptionEn: "Ukraine, Poland, Romania and Turkiye on one steel-production scale.",
  },
  {
    id: "owid",
    name: "OWID",
    title: "Our World in Data",
    titleEn: "Our World in Data",
    url: "https://dataukraine.proto.fund/corner/owid",
    role: "Довгі міжнародні ряди для регіонального порівняння",
    roleEn: "Long international series for regional comparison",
    description: "Праця, населення, ВВП, енергія, сталь, торгівля, цифровізація та клімат.",
    descriptionEn: "Labour, population, GDP, energy, steel, trade, digitalisation and climate.",
  },
];

async function readManifest(definition) {
  if (definition.localDataRoot) {
    try {
      return JSON.parse(
        await readFile(resolve(definition.localDataRoot, "dataroom/manifest.json"), "utf8"),
      );
    } catch {
      // Fall back to the published alias when a local source has not been built.
    }
  }
  if (definition.manifestUrl) {
    const response = await fetch(definition.manifestUrl);
    if (!response.ok) {
      throw new Error(`${definition.id} manifest HTTP ${response.status}`);
    }
    return response.json();
  }
  return JSON.parse(
    await readFile(
      resolve(publicRoot, definition.id, "dataroom/manifest.json"),
      "utf8",
    ),
  );
}

async function readReportManifest(definition) {
  if (definition.localDataRoot) {
    try {
      return JSON.parse(
        await readFile(resolve(definition.localDataRoot, "reports/manifest.json"), "utf8"),
      );
    } catch {
      // Fall back to the published alias when local reports are unavailable.
    }
  }
  if (definition.manifestUrl) {
    const reportUrl = definition.manifestUrl.replace(
      "dataroom/manifest.json",
      "reports/manifest.json",
    );
    const response = await fetch(reportUrl);
    if (!response.ok) return [];
    return response.json();
  }
  try {
    return JSON.parse(
      await readFile(
        resolve(publicRoot, definition.id, "reports/manifest.json"),
        "utf8",
      ),
    );
  } catch {
    return [];
  }
}

const manifests = await Promise.all(cornerDefinitions.map(readManifest));
const reportManifests = await Promise.all(
  cornerDefinitions.map(readReportManifest),
);
const corners = cornerDefinitions.map((definition, index) => {
  const manifest = manifests[index];
  const cards = manifest.datasets ?? [];
  const coverageStarts = cards.map((item) => item.coverageStart).filter(Boolean).sort();
  const latestDates = cards.map((item) => item.latestDate).filter(Boolean).sort();
  const { localDataRoot: _localDataRoot, ...publicDefinition } = definition;
  return {
    ...publicDefinition,
    datasetCount: manifest.meta?.liveDatasetCount ?? cards.length,
    deferredCount: manifest.meta?.failedDatasetCount ?? manifest.failures?.length ?? 0,
    observationCount: cards.reduce((sum, item) => sum + Number(item.rowCount ?? 0), 0),
    coverageStart: coverageStarts[0] ?? null,
    latestDate: latestDates.at(-1) ?? null,
    categories: [...new Set(cards.map((item) => item.category).filter(Boolean))],
    status: "live",
  };
});

const comparisonMatrix = [
  {
    id: "steel-output",
    title: "Виробництво сталі",
    unit: "тис. тонн",
    sources: [
      { corner: "worldsteel", code: "P1_CRUDE_STEEL_TOTAL", role: "офіційний річний випуск" },
      { corner: "worldsteel", code: "MCSP_CRUDE_STEEL_MONTHLY", role: "ранній місячний сигнал" },
      { corner: "owid", code: "STEEL-PRODUCTION", role: "довга міжнародна історія" },
    ],
    caveat: "Місячні значення не можна порівнювати з річними без підсумовування повних 12 місяців.",
  },
  {
    id: "gdp-growth",
    title: "Зростання реального ВВП",
    unit: "%",
    sources: [
      { corner: "stat", code: "GDP / national accounts", role: "офіційний факт" },
      { corner: "wb", code: "NY.GDP.MKTP.KD.ZG", role: "міжнародна історія" },
      { corner: "wb", code: "NYGDPMKTPKDZ", role: "GEP forecast" },
      { corner: "imf", code: "NGDP_RPCH", role: "WEO forecast" },
      { corner: "eurostat", code: "enpe_nama_10_gdp", role: "EU-comparable history" },
      { corner: "tradingeconomics", code: "gdp-growth-annual", role: "short-term model" },
    ],
    caveat: "Порівнюйте однаковий рік і дату випуску; квартальний прогноз TE не є річним WEO.",
  },
  {
    id: "inflation",
    title: "Інфляція",
    unit: "%",
    sources: [
      { corner: "stat", code: "CPI", role: "офіційний індекс" },
      { corner: "nbu", code: "inflation / macro", role: "монетарний контекст" },
      { corner: "wb", code: "FP.CPI.TOTL.ZG", role: "міжнародна історія" },
      { corner: "imf", code: "PCPIPCH", role: "середньорічний прогноз" },
      { corner: "eurostat", code: "enpe_cpi", role: "EU-comparable history" },
      { corner: "tradingeconomics", code: "inflation-cpi", role: "quarterly model" },
    ],
    caveat: "Середньорічна, річна до грудня і поточна р/р інфляція є різними показниками.",
  },
  {
    id: "unemployment",
    title: "Безробіття",
    unit: "%",
    sources: [
      { corner: "stat", code: "labour market", role: "національне обстеження" },
      { corner: "ilostat", code: "UNE_DEAP_SEX_AGE_RT", role: "harmonised labour rate" },
      { corner: "wb", code: "SL.UEM.TOTL.ZS", role: "international estimate" },
      { corner: "imf", code: "LUR", role: "WEO history/forecast" },
      { corner: "eurostat", code: "enpe_lfsa_urgan", role: "EU-comparable rate" },
    ],
    caveat: "Воєнні прогалини та модельні оцінки треба показувати окремо від прямого опитування.",
  },
  {
    id: "public-debt",
    title: "Державний борг",
    unit: "% ВВП",
    sources: [
      { corner: "budget", code: "financing-debt", role: "виконання бюджету" },
      { corner: "wb", code: "GC.DOD.TOTL.GD.ZS", role: "international history" },
      { corner: "imf", code: "GGXWDG_NGDP", role: "WEO forecast" },
      { corner: "tradingeconomics", code: "government-debt-to-gdp", role: "external forecast" },
    ],
    caveat: "Валовий борг, центральний уряд і бюджетне фінансування мають різне охоплення.",
  },
  {
    id: "external-balance",
    title: "Зовнішній баланс",
    unit: "% ВВП / USD",
    sources: [
      { corner: "nbu", code: "balance of payments", role: "офіційний зовнішній сектор" },
      { corner: "comtrade", code: "trade-totals", role: "товарна торгівля" },
      { corner: "wb", code: "BN.CAB.XOKA.GD.ZS", role: "current account history" },
      { corner: "imf", code: "BCA_NGDPD", role: "WEO current account" },
      { corner: "eurostat", code: "enpe_bop_c6_a", role: "EU-comparable BOP" },
      { corner: "tradingeconomics", code: "current-account-to-gdp", role: "external forecast" },
    ],
    caveat: "Торговельний баланс товарів не дорівнює поточному рахунку платіжного балансу.",
  },
];

async function summary(corner, id) {
  return JSON.parse(
    await readFile(resolve(publicRoot, corner, "dataroom", id, "summary.json"), "utf8"),
  );
}

const teManifest = manifests[cornerDefinitions.findIndex((item) => item.id === "tradingeconomics")];
const teGdpId = teManifest.datasets.find((item) => item.title === "GDP Annual Growth Rate")?.id;
const nbuForecast = {
  indicators: [{
    unit: "%",
    series: [
      { date: "2026-12-31", year: 2026, value: 1.8, forecast: true },
      { date: "2027-12-31", year: 2027, value: 2.8, forecast: true },
      { date: "2028-12-31", year: 2028, value: 3.7, forecast: true },
    ],
  }],
  endpoint: "https://bank.gov.ua/en/news/all/inflyatsiya-bude-pomirnoyu-u-20262028-rokah-a-ekonomika-postupovo-zrostatime--inflyatsiyniy-zvit",
  annualization: "Офіційний прогноз НБУ, Інфляційний звіт за січень 2026 року; опубліковано 5 лютого 2026 року.",
};
const forecastSources = [
  {
    corner: "nbu",
    label: "NBU",
    labelUa: "НБУ",
    color: "#00bfe9",
    summary: nbuForecast,
    releaseDate: "2026-02-05",
  },
  {
    corner: "imf",
    label: "IMF WEO",
    labelUa: "IMF WEO",
    color: "#ff312e",
    summary: await summary("imf", "ngdp_rpch"),
  },
  {
    corner: "wb",
    label: "World Bank GEP",
    labelUa: "World Bank GEP",
    color: "#ffd400",
    summary: await summary("wb", "gep-gdp-growth-forecast"),
  },
  ...(teGdpId ? [{
    corner: "tradingeconomics",
    label: "Trading Economics",
    labelUa: "Trading Economics",
    color: "#76e000",
    summary: await summary("tradingeconomics", teGdpId),
  }] : []),
];
const forecasts = forecastSources.map((item) => {
  const indicator = item.summary.indicators[0];
  return {
    corner: item.corner,
    label: item.label,
    labelUa: item.labelUa,
    color: item.color,
    unit: indicator.unit,
    sourceUrl: item.summary.endpoint,
    points: indicator.series.filter((point) => point.year >= 2023),
    note: item.summary.annualization,
    releaseDate: item.releaseDate ?? item.summary.freshness?.generatedAt?.slice(0, 10) ?? null,
  };
});

const frameDefinitions = [
  { id: "gdpGrowth", summaryId: "ngdp_rpch", title: "Зростання реального ВВП", titleEn: "Real GDP growth", unit: "%" },
  { id: "inflation", summaryId: "pcpipch", title: "Середня інфляція", titleEn: "Average inflation", unit: "%" },
  { id: "unemployment", summaryId: "lur", title: "Безробіття", titleEn: "Unemployment", unit: "%" },
  { id: "publicDebt", summaryId: "ggxwdg_ngdp", title: "Валовий державний борг", titleEn: "General government gross debt", unit: "% ВВП" },
  { id: "currentAccount", summaryId: "bca_ngdpd", title: "Поточний рахунок", titleEn: "Current account balance", unit: "% ВВП" },
];
const frameSummaries = Object.fromEntries(
  await Promise.all(
    frameDefinitions.map(async (definition) => [
      definition.id,
      await summary("imf", definition.summaryId),
    ]),
  ),
);

function frameNarrative(year, metrics) {
  const gdp = metrics.find((item) => item.id === "gdpGrowth")?.value;
  const inflation = metrics.find((item) => item.id === "inflation")?.value;
  const debt = metrics.find((item) => item.id === "publicDebt")?.value;
  const current = metrics.find((item) => item.id === "currentAccount")?.value;
  return {
    ua: year === 2026
      ? `Сценарій ${year}: IMF очікує зростання ВВП ${gdp}%, середню інфляцію ${inflation}% і борг ${debt}% ВВП. Це прогноз, не завершений річний факт.`
      : `${year}: ВВП змінився на ${gdp}%, середня інфляція становила ${inflation}%, а поточний рахунок — ${current}% ВВП. Рамка показує масштаб, не причину.`,
    en: year === 2026
      ? `${year} scenario: the IMF expects ${gdp}% GDP growth, ${inflation}% average inflation and debt at ${debt}% of GDP. This is a forecast, not a final annual result.`
      : `${year}: GDP changed by ${gdp}%, average inflation was ${inflation}%, and the current account was ${current}% of GDP. The frame shows scale, not causality.`,
  };
}

const frames = Array.from({ length: 7 }, (_, index) => 2020 + index).map((year) => {
  const metrics = frameDefinitions.map((definition) => {
    const data = frameSummaries[definition.id].indicators[0].series.find(
      (point) => point.year === year,
    );
    return {
      id: definition.id,
      title: definition.title,
      titleEn: definition.titleEn,
      unit: definition.unit,
      value: data?.value ?? null,
      forecast: Boolean(data?.forecast),
      sourceCode: definition.summaryId.toUpperCase(),
    };
  });
  return {
    year,
    status: metrics.some((metric) => metric.forecast) ? "forecast" : "historical",
    source: "IMF WEO / DataMapper",
    sourceUrl: frameSummaries.gdpGrowth.endpoint,
    metrics,
    narrative: frameNarrative(year, metrics),
  };
});

const forecastHorizon = {
  startYear: 2026,
  endYear: 2035,
  metric: "real-gdp-growth",
  title: "Зростання реального ВВП: опубліковані прогнози",
  titleEn: "Real GDP growth: published forecasts",
  description: "Показуємо лише значення, опубліковані джерелом. Порожні 2032–2035 роки не екстраполюємо.",
  descriptionEn: "Only source-published values are shown. Missing years in 2032–2035 are not extrapolated.",
  years: Array.from({ length: 10 }, (_, index) => {
    const year = 2026 + index;
    const values = forecasts
      .map((forecast) => {
        const point = forecast.points.find((item) => item.year === year);
        return point
          ? { corner: forecast.corner, label: forecast.label, value: point.value, unit: forecast.unit }
          : null;
      })
      .filter(Boolean);
    return {
      year,
      status: values.length ? "published" : "not-published",
      values,
    };
  }),
  sources: forecasts.map(({ corner, label, labelUa, sourceUrl, releaseDate }) => ({
    corner,
    label,
    labelUa,
    sourceUrl,
    releaseDate,
  })),
};

const datasets = corners.map((corner, index) => ({
  id: corner.id,
  number: index + 1,
  flowId: `OSNOVA_${corner.id.toUpperCase()}`,
  title: corner.title,
  category: "Публічні куточки",
  priority: index < 5 ? "hero" : "top",
  frequency: "Реєстр",
  officialUrl: corner.url,
  sourceUrl: corner.url,
  fetchMode: "live public corner manifest",
  description: `${corner.description} ${corner.datasetCount.toLocaleString("uk-UA")} живих наборів у поточному релізі.`,
  question: `Які дані дає ${corner.title} про Україну?`,
  why: corner.role,
  annualization: "Показано кількість живих наборів у поточному публічному релізі",
  limitation: corner.deferredCount
    ? `${corner.deferredCount} джерел або схем позначено як deferred у власному аудиті куточка.`
    : null,
  rows: [{
    timePeriod: generatedAt.slice(0, 10),
    date: generatedAt.slice(0, 10),
    value: corner.datasetCount,
    indicatorCode: `${corner.id}_DATASETS`,
    indicatorLabel: "Живі набори",
    unit: "наборів",
    freq: "S",
    action: "I",
    dimensions: { corner: corner.id, url: corner.url },
    attributes: {
      observationCount: corner.observationCount,
      deferredCount: corner.deferredCount,
      coverageStart: corner.coverageStart,
      latestDate: corner.latestDate,
    },
    raw: corner,
  }],
}));

const sourceReports = cornerDefinitions.map((definition, index) => ({
  corner: definition.id,
  name: definition.name,
  reports: reportManifests[index].map((report) => ({
    id: report.id,
    period: report.period,
    title: report.title,
    brief: report.brief ?? report.deck,
    generatedAt: report.generatedAt,
    lead: report.lead ?? null,
    url: `${definition.url}${report.url}`,
  })),
}));
const reportHighlights = sourceReports
  .flatMap((source) =>
    source.reports
      .filter((report) => report.lead)
      .map((report) => ({
        corner: source.corner,
        source: source.name,
        period: report.period,
        title: report.title,
        brief: report.brief,
        lead: report.lead,
        url: report.url,
      })),
  )
  .sort((a, b) => Math.abs(b.lead.deltaPct ?? b.lead.delta ?? 0) -
    Math.abs(a.lead.deltaPct ?? a.lead.delta ?? 0));
const latestDaily =
  reportHighlights.find((item) => item.corner === "nbu" && item.period === "daily") ??
  reportHighlights.find((item) => item.period === "daily" && !/свіж|fresh/i.test(item.title));
const latestMonthly =
  reportHighlights.find((item) => item.corner === "nbu" && item.period === "monthly") ??
  reportHighlights.find((item) => item.period === "monthly");
const latestAnnual = reportHighlights.find((item) => item.period === "annual");
const reportHeadlineUa = (
  latestDaily?.brief ??
  latestMonthly?.brief ??
  "Оновлено каталог, річні кадри та горизонти прогнозів."
).slice(0, 200);
const reportHeadlineEn = (
  latestDaily
    ? `${latestDaily.source}: the latest high-frequency signal is available with its comparison period and source link.`
    : "The catalogue, annual frames and forecast horizons have been refreshed."
).slice(0, 200);

const { db, databasePath } = await createCornerDatabase("ukraine");
insertDatasets(db, datasets);
await buildPublicRelease("ukraine", db, datasets, []);
db.close();

const universal = {
  meta: {
    generatedAt,
    title: "Ukraine Dataroom",
    titleUa: "Економіка України",
    titleEn: "Ukraine Economy",
    descriptionUa: "Макроекономіка, державні фінанси, банки, торгівля, праця, бюджет, промисловість, сталь і міжнародні порівняння.",
    descriptionEn: "Macroeconomics, public finance, banking, trade, labour, budget, industry, steel and international comparisons.",
    cornerCount: corners.length,
    datasetCount: corners.reduce((sum, corner) => sum + corner.datasetCount, 0),
    observationCount: corners.reduce((sum, corner) => sum + corner.observationCount, 0),
    comparisonCount: comparisonMatrix.length,
  },
  corners,
  comparisons: comparisonMatrix,
  forecasts,
  frames,
  forecastHorizon,
  sourceReports,
  report: {
    headlineUa: reportHeadlineUa,
    headlineEn: reportHeadlineEn,
    highlights: {
      annual: latestAnnual ?? null,
      monthly: latestMonthly ?? null,
      weeklyOrDaily: latestDaily ?? null,
    },
    json: "/data/reports/dataroom-update.json",
    markdown: "/data/reports/dataroom-update.md",
  },
};
const graphAliasItems = manifests.flatMap((manifest, index) =>
  (manifest.datasets ?? []).map((dataset) => {
    const graphCodeBase = dataset.graphCodeBase ?? `UA-${cornerDefinitions[index].id.toUpperCase()}-${String(dataset.number).padStart(4, "0")}`;
    return {
      shortId: graphCodeBase.replace(/^UA-/u, "").toLowerCase(),
      graphCodeBase,
      corner: cornerDefinitions[index].id,
      datasetId: dataset.id,
      number: dataset.number,
      title: dataset.title,
      titleUa: dataset.titleUa,
      titleEn: dataset.titleEn,
      url: `https://dataukraine.proto.fund/id/${graphCodeBase.replace(/^UA-/u, "").toLowerCase()}`,
    };
  })
);
const graphAliasIndex = {
  generatedAt,
  count: graphAliasItems.length,
  byShortId: Object.fromEntries(graphAliasItems.map((item) => [item.shortId, item])),
};
await writeFile(
  resolve(publicRoot, "ukraine/universal.json"),
  `${JSON.stringify(universal)}\n`,
);
await writeFile(
  resolve(publicRoot, "ukraine/id-index.json"),
  `${JSON.stringify(graphAliasIndex, null, 2)}\n`,
);
await writeFile(
  resolve(publicRoot, "ukraine/comparisons.json"),
  `${JSON.stringify(comparisonMatrix)}\n`,
);
await writeFile(
  resolve(publicRoot, "ukraine/frames.json"),
  `${JSON.stringify({ generatedAt, source: "IMF WEO / DataMapper", frames })}\n`,
);
await writeFile(
  resolve(publicRoot, "ukraine/forecasts.json"),
  `${JSON.stringify({ generatedAt, forecasts, forecastHorizon })}\n`,
);
const readinessAudit = cornerDefinitions.map((definition, index) => {
  const manifest = manifests[index];
  return {
    corner: definition.id,
    source: definition.titleEn,
    graphReadyDatasets: manifest.meta?.liveDatasetCount ?? manifest.datasets?.length ?? 0,
    excludedDatasets: manifest.meta?.failedDatasetCount ?? manifest.failures?.length ?? 0,
    exclusions: manifest.failures ?? [],
    rule: "At least one numeric series with two distinct published periods",
  };
});
await writeFile(
  resolve(publicRoot, "ukraine/data-readiness.json"),
  `${JSON.stringify({ generatedAt, rule: "numeric-series-two-periods", corners: readinessAudit }, null, 2)}\n`,
);
await writeFile(
  resolve(publicRoot, "ukraine/data-readiness.md"),
  `# Аудит готовності графіків\n\nКритерій публікації: щонайменше один числовий ряд із двома різними опублікованими періодами. Одноперіодні зрізи залишаються у вихідних архівах, але не створюють сторінки графіка.\n\n${readinessAudit.map((item) => `- **${item.source}:** ${item.graphReadyDatasets} готових наборів; ${item.excludedDatasets} виключено.`).join("\n")}\n`,
);
await writeFile(
  resolve(publicRoot, "ukraine/reports/dataroom-update.json"),
  `${JSON.stringify({
    generatedAt,
    title: "Ukraine Dataroom update",
    titleUa: "Оновлення економічних показників України",
    frame: frames.at(-1),
    coverage: {
      corners: corners.length,
      datasets: corners.reduce((sum, corner) => sum + corner.datasetCount, 0),
      observations: corners.reduce((sum, corner) => sum + corner.observationCount, 0),
    },
    headlineUa: reportHeadlineUa,
    headlineEn: reportHeadlineEn,
    highlights: {
      annual: latestAnnual ?? null,
      monthly: latestMonthly ?? null,
      weeklyOrDaily: latestDaily ?? null,
      largestMoves: reportHighlights.slice(0, 12),
    },
    notes: [
      "Автоматичний звіт описує рухи та покриття, але не приписує їм причин.",
      "Прогнози зберігаються окремо за джерелом і датою випуску.",
    ],
  }, null, 2)}\n`,
);
await writeFile(
  resolve(publicRoot, "ukraine/reports/dataroom-update.md"),
  `# Оновлення економічних показників України\n\n${reportHeadlineUa}\n\n${frames.at(-1).narrative.ua}\n\n## Річні показники\n\n${latestAnnual?.brief ?? "Нових зіставних річних значень не опубліковано."}\n\n## Місячні показники\n\n${latestMonthly?.brief ?? "Нових місячних значень не опубліковано."}\n\n## Щоденні та тижневі показники\n\n${latestDaily?.brief ?? "Нових щоденних або тижневих значень не опубліковано."}\n\n- Джерел: ${corners.length}\n- Наборів: ${universal.meta.datasetCount}\n- Спостережень: ${universal.meta.observationCount}\n\nПрогнози не усереднюються та не продовжуються поза горизонтом джерела.\n`,
);
console.log(
  `Ukraine Dataroom: ${corners.length} sources, ${universal.meta.datasetCount} datasets -> ${databasePath}`,
);
