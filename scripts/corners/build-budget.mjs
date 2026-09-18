import {
  buildPublicRelease,
  createCornerDatabase,
  fetchCached,
  generatedAt,
  insertDatasets,
  parseCsv,
  periodToDate,
  toNumber,
} from "./common.mjs";

const currentYear = Number(generatedAt.slice(0, 4));
const sourceBase = "https://api.openbudget.gov.ua/api/public/generalData";
const officialUrl = "https://api.openbudget.gov.ua/swagger-ui.html#/BudgetIndicators/getDataByGeneralBudgetsUsingGET";
const dictionaryUrl = "https://api.openbudget.gov.ua/items/BUDG";
const regionNames = {
  "01": "Автономна Республіка Крим",
  "02": "Вінницька область",
  "03": "Волинська область",
  "04": "Дніпропетровська область",
  "05": "Донецька область",
  "06": "Житомирська область",
  "07": "Закарпатська область",
  "08": "Запорізька область",
  "09": "Івано-Франківська область",
  "10": "Київська область",
  "11": "Кіровоградська область",
  "12": "Луганська область",
  "13": "Львівська область",
  "14": "Миколаївська область",
  "15": "Одеська область",
  "16": "Полтавська область",
  "17": "Рівненська область",
  "18": "Сумська область",
  "19": "Тернопільська область",
  "20": "Харківська область",
  "21": "Херсонська область",
  "22": "Хмельницька область",
  "23": "Черкаська область",
  "24": "Чернівецька область",
  "25": "Чернігівська область",
  "26": "місто Київ",
  "27": "місто Севастополь",
  "99": "Державний бюджет України",
};

const dictionary = JSON.parse(
  (await fetchCached(
    dictionaryUrl,
    "budget/dictionaries/BUDG.json",
  )).toString("utf8"),
);
const activeDate = generatedAt.slice(0, 10);
const activeByCode = new Map();
for (const item of dictionary) {
  if ((item.endDate ?? "9999-12-31") < activeDate || !item.codebudg) continue;
  const previous = activeByCode.get(item.codebudg);
  if (!previous || (item.beginDate ?? "") > (previous.beginDate ?? "")) {
    activeByCode.set(item.codebudg, item);
  }
}
const activeBudgets = [...activeByCode.values()].map((item) => ({
  code: item.codebudg,
  name: item.namebudg ?? item.nameLocalGov ?? item.codebudg,
  regionCode: item.codeRegion ?? null,
  validFrom: item.beginDate ?? null,
  validTo: item.endDate ?? null,
  raw: item,
}));
const regions = Object.entries(
  Object.groupBy(
    activeBudgets.filter((item) => item.regionCode),
    (item) => item.regionCode,
  ),
).map(([code, items]) => ({
  code,
  name: regionNames[code] ?? `Регіон ${code}`,
  rowCount: items.length,
  latestDate: activeDate,
}));
console.log(
  `Budget dictionary: ${dictionary.length} historical records, ${activeBudgets.length} active budgets`,
);
const combinations = [
  ["incomes", "Доходи бюджету", "INCOMES", null, "Доходи", "Скільки грошей надійшло до державного, місцевих і зведеного бюджетів?"],
  ["expenses-program", "Видатки за програмами", "EXPENSES", "PROGRAM", "Видатки", "На які державні програми спрямовано бюджетні кошти?"],
  ["expenses-functional", "Видатки за функціями", "EXPENSES", "FUNCTIONAL", "Видатки", "Скільки витрачено на освіту, здоров’я, оборону та соціальний захист?"],
  ["expenses-economic", "Видатки за економічною суттю", "EXPENSES", "ECONOMIC", "Видатки", "Кошти пішли на зарплати, товари, трансферти чи капітальні витрати?"],
  ["financing-debt", "Фінансування за борговим зобов’язанням", "FINANCING_DEBTS", null, "Фінансування", "Як позики й погашення боргу змінюють фінансування бюджету?"],
  ["financing-creditor", "Фінансування за типом кредитора", "FINANCING_CREDITOR", null, "Фінансування", "Хто надає кошти бюджету і кому повертають борги?"],
  ["credits-program", "Кредитування за програмами", "CREDITS", "PROGRAM", "Кредитування", "За якими програмами держава надає та повертає кредити?"],
  ["credits-functional", "Кредитування за функціями", "CREDITS", "FUNCTIONAL", "Кредитування", "У яких сферах бюджет кредитує економіку й громади?"],
  ["credits-class", "Кредитування за класифікацією", "CREDITS", "CREDIT", "Кредитування", "Які види бюджетних кредитів видано або повернуто?"],
];

function codeFields(row) {
  const codeField = Object.keys(row).find((field) => /^COD_/.test(field) && !field.endsWith("_NAME"));
  const nameField = codeField ? `${codeField}_NAME` : null;
  return {
    code: row[codeField] || "TOTAL",
    label: row[nameField] || "Загальний показник",
  };
}

const datasets = [];
for (let index = 0; index < combinations.length; index += 1) {
  const [id, title, budgetItem, classificationType, category, question] = combinations[index];
  const rows = [];
  for (let year = 2018; year <= currentYear; year += 1) {
    const params = new URLSearchParams({ budgetItem, year: String(year) });
    if (classificationType) params.set("classificationType", classificationType);
    const url = `${sourceBase}?${params}`;
    const body = await fetchCached(url, `budget/${id}/${year}.csv`);
    const parsed = parseCsv(body.toString("utf8"), ";");
    const periods = parsed.map((row) => row.REP_PERIOD).filter(Boolean).sort();
    const latestPeriod = periods.at(-1);
    for (const raw of parsed.filter((row) => row.REP_PERIOD === latestPeriod)) {
      const { code, label } = codeFields(raw);
      const value = toNumber(raw.DONE_PERIOD_AMT);
      if (value === null) continue;
      const date = periodToDate(raw.REP_PERIOD);
      rows.push({
        timePeriod: raw.REP_PERIOD,
        date,
        value,
        indicatorCode: `${raw.BUDG_TYP ?? "_"}|${raw.FUND_TYP ?? "_"}|${code}`,
        indicatorLabel: `${label} · ${raw.BUDG_TYP ?? "?"}/${raw.FUND_TYP ?? "?"}`,
        unit: "UAH",
        freq: "A",
        partial: year === currentYear && !String(latestPeriod).startsWith("12."),
        asOf: date,
        dimensions: {
          budgetType: raw.BUDG_TYP,
          fundType: raw.FUND_TYP,
          classificationCode: code,
        },
        raw,
      });
    }
  }
  datasets.push({
    id,
    number: index + 1,
    flowId: `${budgetItem}${classificationType ? `_${classificationType}` : ""}`,
    title,
    category,
    priority: index < 4 ? "hero" : "top",
    frequency: "Річна з місячного YTD",
    officialUrl,
    sourceUrl: `${sourceBase}?budgetItem=${budgetItem}${classificationType ? `&classificationType=${classificationType}` : ""}&year=YYYY`,
    fetchMode: "latest cumulative month for every year",
    description: `${title} показують план і фактичне виконання від початку року в розрізі рівня бюджету, фонду та офіційної класифікації.`,
    question,
    why: "Бюджет показує, звідки держава бере гроші і на що їх спрямовує. Порівнюй факт із планом та не додавай місяці між собою.",
    annualization: "Для кожного року взято останній опублікований накопичувальний місяць; місячні YTD-значення не підсумовуються",
    limitation: "Детальні окремі місцеві бюджети доступні через окремий API за кодом бюджету; у першому публічному релізі показані повні загальні зрізи D/M/Z.",
    ...(id === "incomes" ? {
      entities: activeBudgets,
      regionalPerspective: {
        available: true,
        field: "codeRegion",
        codeSystem: "OpenBudget BUDG / КАТОТТГ",
        description: "Чинний довідник місцевих бюджетів за регіонами; числові звіти завантажуються окремо за codebudg.",
        joinNote: "Приєднуй localBudgetData або localBudgetReport за codebudg; не розподіляй загальний показник між регіонами пропорційно.",
        regionCount: regions.length,
        rowCount: activeBudgets.length,
        seriesCount: 0,
        regions,
      },
    } : {}),
    rows,
  });
  console.log(`Budget ${id}: ${rows.length} annual rows`);
}

const { db, databasePath } = await createCornerDatabase("budget");
insertDatasets(db, datasets);
await buildPublicRelease("budget", db, datasets);
db.close();
console.log(`Budget corner: ${datasets.length} rooms -> ${databasePath}`);
