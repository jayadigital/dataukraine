import { readFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import {
  buildPublicRelease,
  createCornerDatabase,
  insertDatasets,
  parseCsv,
  root,
  slugify,
  toNumber,
} from "./common.mjs";

const sourceRoot = resolve(root, "../dataukraine-platform/data/connectors/owid");
const countries = new Set(["UKR", "POL", "ROU", "TUR"]);
const files = [
  ["unemployment-rate.csv", "Рівень безробіття", "Unemployment rate", "Ринок праці", "%"],
  ["manufacturing-share-of-total-employment.csv", "Частка зайнятих у переробній промисловості", "Manufacturing share of total employment", "Промисловість і праця", "%"],
  ["minerals-steel-production.csv", "Виробництво сталі", "Steel production", "Сталь і промисловість", "тонн"],
  ["gdp-worldbank.csv", "Валовий внутрішній продукт", "Gross domestic product", "Економіка", "USD, постійні ціни"],
  ["trade-as-share-of-gdp.csv", "Торгівля як частка ВВП", "Trade as a share of GDP", "Торгівля", "% ВВП"],
  ["population.csv", "Населення", "Population", "Населення", "осіб"],
  ["life-expectancy.csv", "Очікувана тривалість життя", "Life expectancy", "Люди і здоров'я", "років"],
  ["number-of-internet-users.csv", "Кількість користувачів інтернету", "Number of internet users", "Цифрова економіка", "осіб"],
  ["co-emissions-per-capita.csv", "Викиди CO2 на одну особу", "CO2 emissions per capita", "Енергія і клімат", "тонн на особу"],
  ["military-spending-sipri.csv", "Військові видатки", "Military expenditure", "Державні видатки", "USD, постійні ціни"],
  ["per-capita-energy-stacked.csv", "Споживання енергії на одну особу за джерелом", "Energy use per person by source", "Енергія і клімат", "кВт-год на особу"],
];

const ignoredColumns = new Set(["Entity", "Code", "Year", "World region according to OWID"]);

const datasets = [];
for (const [file, titleUa, titleEn, category, unit] of files) {
  const records = parseCsv(await readFile(resolve(sourceRoot, file), "utf8"));
  const valueColumns = Object.keys(records[0] ?? {}).filter((key) => !ignoredColumns.has(key));
  const rows = records
    .filter((row) => countries.has(row.Code) && Number(row.Year) >= 1900)
    .flatMap((raw) => valueColumns.map((column) => ({ raw, column, value: toNumber(raw[column]) })))
    .filter((item) => item.value !== null)
    .map(({ raw, column, value }) => ({
      timePeriod: raw.Year,
      date: `${raw.Year}-12-31`,
      value,
      indicatorCode: slugify(column).toLocaleUpperCase(),
      indicatorLabel: valueColumns.length === 1 ? titleUa : column,
      unit,
      freq: "A",
      action: "I",
      dimensions: {
        countryCode: raw.Code,
        countryName: raw.Entity,
      },
      raw,
    }));
  datasets.push({
    id: basename(file, ".csv"),
    number: datasets.length + 1,
    flowId: `OWID_${basename(file, ".csv").replaceAll("-", "_").toLocaleUpperCase()}`,
    title: titleUa,
    titleUa,
    titleEn,
    originalLanguage: "en",
    category,
    priority: datasets.length < 5 ? "hero" : "top",
    frequency: "Річна",
    officialUrl: "https://ourworldindata.org/",
    sourceUrl: `https://ourworldindata.org/grapher/${basename(file, ".csv")}`,
    fetchMode: "versioned OWID Grapher CSV; Ukraine, Poland, Romania and Turkiye",
    description: `${titleUa}: зіставні річні ряди для України, Польщі, Румунії та Туреччини.`,
    descriptionUa: `${titleUa}: зіставні річні ряди для України, Польщі, Румунії та Туреччини.`,
    descriptionEn: `${titleEn}: comparable annual series for Ukraine, Poland, Romania and Turkiye.`,
    question: `Як змінювався показник «${titleUa}» у чотирьох країнах?`,
    why: "Спільна шкала допомагає відрізнити українську траєкторію від ширшого регіонального руху.",
    annualization: "Річні значення OWID Grapher без інтерполяції; показано опубліковані роки з 1900 року",
    limitation: "OWID поєднує дані первинних установ; метод і первинне джерело треба читати на сторінці конкретного графіка.",
    rows,
  });
}

const { db, databasePath } = await createCornerDatabase("owid");
insertDatasets(db, datasets);
await buildPublicRelease("owid", db, datasets);
db.close();
console.log(`OWID corner: ${datasets.length} rooms -> ${databasePath}`);
