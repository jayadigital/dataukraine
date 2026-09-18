import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  buildPublicRelease,
  createCornerDatabase,
  insertDatasets,
  root,
} from "./common.mjs";

const sourceRoot = resolve(root, "../dataukraine-platform/data/connectors/worldsteel");
const countryCodes = new Set(["UKR", "POL", "ROU", "TUR"]);
const metadata = JSON.parse(await readFile(resolve(sourceRoot, "viewer-metadata.json"), "utf8"));
const countryName = (code) => metadata.geoitems?.[code]?.label ?? code;

async function values(file, indicator) {
  const payload = JSON.parse(await readFile(resolve(sourceRoot, file), "utf8"));
  return payload.indicators?.[indicator]?.values ?? {};
}

function rowsFrom(valuesByCountry, monthly) {
  return Object.entries(valuesByCountry)
    .filter(([country]) => countryCodes.has(country))
    .flatMap(([country, periods]) => Object.entries(periods).map(([period, value]) => {
      const year = period.slice(0, 4);
      const month = monthly ? period.slice(4, 6) : "12";
      return {
        timePeriod: monthly ? `${year}-${month}` : year,
        date: monthly ? `${year}-${month}-01` : `${year}-12-31`,
        value: Number(value),
        indicatorCode: monthly ? "MCSP_CRUDE_STEEL_MONTHLY" : "P1_CRUDE_STEEL_TOTAL",
        indicatorLabel: monthly ? "Виробництво сирої сталі за місяць" : "Виробництво сирої сталі за рік",
        unit: "тис. тонн",
        freq: monthly ? "M" : "A",
        action: "I",
        dimensions: { countryCode: country, countryName: countryName(country) },
        raw: { country, country_name: countryName(country), period, value },
      };
    }));
}

const monthlyRows = rowsFrom(
  await values("MCSP_crude_steel_monthly.json", "MCSP_crude_steel_monthly"),
  true,
);
const annualRows = rowsFrom(
  await values("P1_crude_steel_total_pub.json", "P1_crude_steel_total_pub"),
  false,
);
const datasets = [
  {
    id: "crude-steel-monthly",
    number: 1,
    flowId: "WSA_MCSP_CRUDE_STEEL_MONTHLY",
    title: "Виробництво сирої сталі за місяць",
    titleUa: "Виробництво сирої сталі за місяць",
    titleEn: "Monthly crude steel production",
    originalLanguage: "en",
    category: "Сталь і промисловість",
    priority: "hero",
    frequency: "Місячна",
    officialUrl: "https://worldsteel.org/data/world-steel-in-figures/",
    sourceUrl: "https://worldsteel.org/data/world-steel-in-figures/",
    fetchMode: "public Worldsteel monthly crude steel viewer snapshot",
    description: "Місячний випуск сирої сталі в Україні, Польщі, Румунії та Туреччині.",
    descriptionUa: "Місячний випуск сирої сталі в Україні, Польщі, Румунії та Туреччині.",
    descriptionEn: "Monthly crude steel output in Ukraine, Poland, Romania and Turkiye.",
    question: "Як швидко змінюється випуск сталі в Україні та сусідніх виробничих економіках?",
    why: "Місячний ряд раніше за річну статистику показує зупинки, відновлення й зміну промислового темпу.",
    annualization: "Офіційні місячні значення Worldsteel; не перетворюються на річні без підсумовування повних 12 місяців",
    limitation: "Публічний viewer має коротший горизонт, ніж ліцензовані історичні таблиці Worldsteel; це обсяг виробництва, не ціна сталі.",
    rows: monthlyRows,
  },
  {
    id: "crude-steel-annual",
    number: 2,
    flowId: "WSA_P1_CRUDE_STEEL_TOTAL",
    title: "Виробництво сирої сталі за рік",
    titleUa: "Виробництво сирої сталі за рік",
    titleEn: "Annual crude steel production",
    originalLanguage: "en",
    category: "Сталь і промисловість",
    priority: "hero",
    frequency: "Річна",
    officialUrl: "https://worldsteel.org/data/world-steel-in-figures/",
    sourceUrl: "https://worldsteel.org/data/world-steel-in-figures/",
    fetchMode: "public Worldsteel annual crude steel viewer snapshot",
    description: "Річний випуск сирої сталі в Україні, Польщі, Румунії та Туреччині.",
    descriptionUa: "Річний випуск сирої сталі в Україні, Польщі, Румунії та Туреччині.",
    descriptionEn: "Annual crude steel output in Ukraine, Poland, Romania and Turkiye.",
    question: "Який масштаб сталевого виробництва України порівняно з регіональними орієнтирами?",
    why: "Річний ряд придатний для порівняння структурного масштабу, а не коротких місячних коливань.",
    annualization: "Опубліковані Worldsteel річні підсумки без інтерполяції",
    limitation: "Публічна серія починається з 2021 року; давніші таблиці Worldsteel можуть вимагати ліцензії.",
    rows: annualRows,
  },
];

const { db, databasePath } = await createCornerDatabase("worldsteel");
insertDatasets(db, datasets);
await buildPublicRelease("worldsteel", db, datasets);
db.close();
console.log(`Worldsteel corner: ${datasets.length} rooms -> ${databasePath}`);
