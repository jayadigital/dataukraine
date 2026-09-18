const stat = "https://bank.gov.ua/NBUStatService/v1/statdirectory";

const monthly = (id, path, coverageYear, options = {}) => ({
  ...options,
  id,
  mode: "dated",
  cadence: "month",
  coverageYear,
  path,
  dateFormat: options.dateFormat ?? "ymd",
  lookback: options.lookback ?? 18,
});

const quarterly = (id, path, coverageYear, options = {}) => ({
  ...options,
  id,
  mode: "dated",
  cadence: "quarter",
  coverageYear,
  path,
  dateFormat: options.dateFormat ?? "ym",
  lookback: options.lookback ?? 12,
});

const yearly = (id, path, coverageYear, options = {}) => ({
  ...options,
  id,
  mode: "dated",
  cadence: "year",
  coverageYear,
  path,
  dateFormat: options.dateFormat ?? "ym",
  period: options.period ?? "y",
  lookback: options.lookback ?? 5,
});

const staticSource = (id, url, options = {}) => ({
  ...options,
  id,
  mode: "static",
  url,
  allHistory: options.allHistory ?? false,
});

export const datasetSources = {
  "exchange-rates": {
    coverageYear: 1996,
    sources: [
      staticSource("exchange", `${stat}/exchange?json`, {
        label: "Офіційні курси та метали",
      }),
    ],
    history: { mode: "exchange", series: ["USD", "EUR", "PLN"] },
  },
  uonia: {
    coverageYear: 2020,
    sources: [
      staticSource(
        "uonia",
        "https://bank.gov.ua/NBU_uonia?id_api=UONIA_UnsecLoansDepo&start=22.06.2020&sort=dt&order=asc&json",
        { allHistory: true, cadence: "day" },
      ),
    ],
    history: { mode: "rows" },
  },
  "swap-index": {
    coverageYear: 2020,
    sources: [
      staticSource(
        "swap",
        "https://bank.gov.ua/NBU_uonia?id_api=REF-SWAP_Swaps&start=22.06.2020&sort=dt&order=asc&json",
        { allHistory: true, cadence: "day" },
      ),
    ],
    history: { mode: "rows" },
  },
  "nbu-rates": {
    coverageYear: 1992,
    sources: [
      {
        id: "rates",
        label: "Ставки НБУ",
        mode: "dated",
        cadence: "day",
        coverageYear: 1992,
        path: "key",
        dateFormat: "ymd",
        lookback: 20,
      },
    ],
    history: { mode: "annual-snapshots" },
  },
  "ovdp-auctions": {
    coverageYear: 2011,
    sources: [
      staticSource("auctions", "https://bank.gov.ua/NBU_ovdp?json", {
        label: "Останній аукціон",
      }),
    ],
    history: { mode: "rows" },
  },
  loans: {
    coverageYear: 2016,
    sources: [monthly("loans", "loan", 2016)],
    history: { mode: "annual-snapshots" },
  },
  deposits: {
    coverageYear: 2016,
    sources: [monthly("deposits", "deposit", 2016)],
    history: { mode: "annual-snapshots" },
  },
  "bank-securities": {
    coverageYear: 2016,
    sources: [monthly("securities", "securities", 2016)],
    history: { mode: "annual-snapshots" },
  },
  "bank-interest-rates": {
    coverageYear: 2016,
    sources: [monthly("rates", "mir", 2016)],
    history: { mode: "annual-snapshots" },
  },
  "bank-income-expenses": {
    coverageYear: 2009,
    sources: [
      monthly("income-monthly", "banksincexp", 2009, {
        label: "Щомісячні доходи та витрати",
        period: "m",
        lookback: 24,
        description: "Накопичені з початку року доходи, витрати та результат банків.",
        availability: "Щомісячно з січня 2009 року.",
        indicatorCount: 2,
      }),
      quarterly("income-quarterly", "banksincexp", 2018, {
        label: "Квартальні доходи та витрати",
        period: "q",
        dateFormat: "ymd",
        lookback: 16,
        description: "Квартальний офіційний зріз прибутків і витрат банків.",
        availability: "Щоквартально з 2018 року.",
        indicatorCount: 1,
      }),
    ],
    history: { mode: "annual-snapshots" },
    indicatorLimit: 6,
  },
  "bank-indicators": {
    coverageYear: 2015,
    sources: [
      monthly("indicators-monthly", "basindbank", 2015, {
        label: "Щомісячні показники банків",
        period: "m",
        lookback: 24,
        description: "Активи, зобов’язання, капітал і кількість банків.",
        availability: "Щомісячно з грудня 2015 року.",
        indicatorCount: 2,
      }),
      quarterly("indicators-quarterly", "basindbank", 2018, {
        label: "Квартальні показники банків",
        period: "q",
        dateFormat: "ymd",
        lookback: 16,
        description: "Офіційний квартальний зріз основних показників системи.",
        availability: "Щоквартально з 2018 року.",
        indicatorCount: 1,
      }),
    ],
    history: { mode: "annual-snapshots" },
    indicatorLimit: 6,
  },
  "bank-financial-statements": {
    coverageYear: 2012,
    sources: [
      monthly("statements-monthly", "banksfinrep", 2018, {
        label: "Щомісячна фінансова звітність",
        period: "m",
        lookback: 24,
        description: "Детальні балансові рядки за банками.",
        availability: "Щомісячно з 2018 року.",
        indicatorCount: 2,
      }),
      quarterly("statements-quarterly", "banksfinrep", 2012, {
        label: "Квартальні балансові залишки",
        period: "q",
        dateFormat: "ymd",
        lookback: 16,
        description: "Історичний квартальний зріз звітності за банками.",
        availability: "Щоквартально з квітня 2012 року.",
        indicatorCount: 2,
      }),
    ],
    history: { mode: "annual-snapshots" },
    indicatorLimit: 8,
  },
  "business-surveys": {
    coverageYear: 2015,
    sources: [
      monthly("monthly", "survey", 2019, {
        label: "Щомісячні очікування",
        period: "m",
        lookback: 24,
        description: "Індекс очікувань ділової активності підприємств.",
        availability: "Щомісячно з липня 2019 року.",
        limitation: "Немає публікацій за березень–травень 2022 року.",
        indicatorCount: 2,
      }),
      quarterly("quarterly", "qsurvey", 2015, {
        label: "Квартальні очікування",
        dateFormat: "ymd",
        description: "Очікування бізнесу щодо виробництва, цін, зайнятості та курсу.",
        availability: "Щоквартально з I кварталу 2015 року.",
        indicatorCount: 2,
      }),
    ],
    history: { mode: "annual-snapshots" },
    indicatorLimit: 6,
  },
  "macro-indicators": {
    coverageYear: 2003,
    sources: [
      monthly("prices-monthly", "inflation", 2007, {
        label: "Ціни — місяць",
        period: "m",
        dateFormat: "ym",
        description: "Інфляція споживчих і промислових цін за місяцями.",
        availability: "Щомісячні ряди з 2007 року.",
        indicatorCount: 2,
      }),
      yearly("prices-annual", "inflation", 2007, {
        label: "Ціни — рік",
        description: "Офіційні річні індекси споживчих і виробничих цін.",
        availability: "Річні ряди з 2007 року.",
        indicatorCount: 2,
      }),
      monthly("activity-monthly", "economicactivity", 2010, {
        label: "Економічна активність — місяць",
        period: "m",
        dateFormat: "ym",
        lookback: 60,
        description: "Промисловість, аграрне виробництво, торгівля і будівництво.",
        availability: "Щомісячні ряди переважно з 2010 року.",
        limitation: "Окремі ряди мають перерви або завершуються раніше за інші.",
        indicatorCount: 2,
      }),
      quarterly("activity-quarterly", "economicactivity", 2010, {
        label: "Економічна активність — квартал",
        period: "q",
        dateFormat: "ym",
        lookback: 28,
        description: "Квартальний ВВП та його складові.",
        availability: "Квартальні ряди з 2010 року.",
        indicatorCount: 2,
      }),
      yearly("activity-annual", "economicactivity", 2010, {
        label: "Економічна активність — рік",
        description: "Річний ВВП, виробництво, торгівля та інші показники активності.",
        availability: "Річні ряди переважно з 2010 року.",
        indicatorCount: 2,
      }),
      monthly("labor-monthly", "labormarket", 2003, {
        label: "Ринок праці — місяць",
        period: "m",
        dateFormat: "ym",
        lookback: 60,
        description: "Зарплати, реальна зарплата та борги із зарплати.",
        availability: "Реальна зарплата з 2003 року; інші місячні ряди з 2013 року.",
        limitation: "Частина рядів зупинилася у січні 2022 року; публікацію зарплат поновлено у липні 2025 року.",
        indicatorCount: 3,
      }),
      quarterly("labor-quarterly", "labormarket", 2004, {
        label: "Ринок праці — квартал",
        period: "q",
        dateFormat: "ym",
        lookback: 28,
        coverageEndYear: 2021,
        description: "Зайнятість, безробіття, робоча сила та фонд оплати праці.",
        availability: "Квартальні ряди з 2004 року до IV кварталу 2021 року.",
        limitation: "Після 2021 року квартальні показники ринку праці в цьому API відсутні.",
        indicatorCount: 3,
      }),
      monthly("budget-monthly", "budget", 2011, {
        label: "Державні фінанси — місяць",
        period: "m",
        dateFormat: "ym",
        lookback: 60,
        description: "Доходи, видатки, дефіцит і фінансування бюджету.",
        availability: "Щомісячні ряди з 2011 року.",
        indicatorCount: 2,
      }),
      yearly("budget-annual", "budget", 2011, {
        label: "Державні фінанси — рік",
        description: "Офіційні річні підсумки сектору державних фінансів.",
        availability: "Річні ряди з 2011 року.",
        indicatorCount: 2,
      }),
    ],
    history: { mode: "annual-snapshots" },
    indicatorLimit: 20,
  },
  "monetary-aggregates": {
    coverageYear: 2003,
    sources: [monthly("monetary", "monetary", 2003)],
    history: { mode: "annual-snapshots" },
  },
  "loans-by-debtor-class": {
    coverageYear: 2017,
    sources: [monthly("classes", "klk", 2017)],
    history: { mode: "annual-snapshots" },
  },
  "bank-account-turnover": {
    coverageYear: 2003,
    sources: [monthly("accounts", "osb", 2003)],
    history: { mode: "annual-snapshots" },
  },
  "financial-corporation-surveys": {
    coverageYear: 2002,
    sources: [
      monthly("sr1", "sr1", 2002, { label: "Баланс НБУ" }),
      monthly("re", "re", 2002, { label: "Огляд НБУ" }),
      monthly("sr2", "sr2", 2002, { label: "Баланс банків" }),
      monthly("depcor", "depcor", 2002, { label: "Огляд банків" }),
      monthly("depcornbu", "depcornbu", 2002, {
        label: "Огляд депозитних корпорацій",
      }),
      quarterly("sr4", "sr4", 2008, {
        label: "Баланс інших фінансових корпорацій",
        dateFormat: "ymd",
      }),
      quarterly("ofcs", "ofcs", 2008, {
        label: "Огляд інших фінансових корпорацій",
        dateFormat: "ymd",
      }),
      quarterly("fcs", "fcs", 2008, {
        label: "Огляд фінансових корпорацій",
        dateFormat: "ymd",
      }),
    ],
    history: { mode: "annual-snapshots" },
    indicatorLimit: 12,
  },
  "international-reserves": {
    coverageYear: 2002,
    sources: [
      monthly("reserves", "res", 2002, {
        dateFormat: "ym",
      }),
    ],
    history: { mode: "annual-snapshots" },
  },
  "balance-of-payments": {
    coverageYear: 2010,
    sources: [
      {
        id: "bop",
        label: "Платіжний баланс",
        mode: "range-window",
        path: "balanceofpayments",
        months: 12,
      },
    ],
    history: { mode: "annual-range" },
  },
  "international-investment-position": {
    coverageYear: 2001,
    sources: [
      quarterly("iip", "interinvestpos", 2001, {
        dateFormat: "ym",
      }),
    ],
    history: { mode: "annual-snapshots" },
  },
  "foreign-direct-investment": {
    coverageYear: 2015,
    sources: [
      staticSource("positions", `${stat}/fdis?json`, {
        label: "Запаси",
        allHistory: true,
      }),
      staticSource("flows", `${stat}/fdif?json`, {
        label: "Потоки",
        allHistory: true,
      }),
    ],
    history: { mode: "rows" },
  },
  "gross-external-debt": {
    coverageYear: 2003,
    sources: [
      quarterly("debt", "grossextdebt", 2003, {
        dateFormat: "ym",
      }),
    ],
    history: { mode: "annual-snapshots" },
  },
  "short-term-external-debt": {
    coverageYear: 2003,
    sources: [
      quarterly("debt", "shotextdebt", 2003, {
        dateFormat: "ym",
      }),
    ],
    history: { mode: "annual-snapshots" },
  },
  "fx-market": {
    coverageYear: 2017,
    sources: [
      {
        id: "daily",
        label: "Щоденні показники",
        mode: "dated",
        cadence: "day",
        coverageYear: 2017,
        path: "kursf",
        dateFormat: "ymd",
        period: "d",
        lookback: 20,
      },
      monthly("monthly", "kursf", 2017, {
        label: "Місячні показники",
        period: "m",
      }),
    ],
    history: { mode: "annual-snapshots" },
  },
  "cash-fx-flows": {
    coverageYear: 2012,
    sources: [
      monthly("cash-monthly", "casflow", 2012, {
        label: "Готівкова валюта — місяць",
        period: "m",
        lookback: 24,
        description: "Щомісячне ввезення та вивезення готівкової валюти банками.",
        availability: "Щомісячно з лютого 2012 року.",
        indicatorCount: 2,
      }),
      yearly("cash-annual", "casflow", 2012, {
        label: "Готівкова валюта — рік",
        period: "Y",
        dateFormat: "ymd",
        description: "Річний офіційний підсумок потоків готівкової валюти.",
        availability: "Річні ряди з 2012 року.",
        indicatorCount: 2,
      }),
    ],
    history: { mode: "annual-snapshots" },
    indicatorLimit: 6,
  },
};

export { stat };
