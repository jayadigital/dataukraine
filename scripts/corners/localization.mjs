import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { dataRoot } from "./common-paths.mjs";

let translations = {};
try {
  translations = JSON.parse(
    readFileSync(resolve(dataRoot, "title-translations.json"), "utf8"),
  );
} catch {
  // Builders remain usable before the optional translation cache is generated.
}

const sourceNames = {
  nbu: { uk: "НБУ", en: "the National Bank of Ukraine" },
  stat: { uk: "Держстату", en: "the State Statistics Service of Ukraine" },
  budget: { uk: "Open Budget", en: "Open Budget" },
  oecd: { uk: "OECD", en: "OECD" },
  wb: { uk: "Світового банку", en: "the World Bank" },
  ilostat: { uk: "ILOSTAT", en: "ILOSTAT" },
  imf: { uk: "МВФ", en: "the IMF" },
  eurostat: { uk: "Eurostat", en: "Eurostat" },
  comtrade: { uk: "UN Comtrade", en: "UN Comtrade" },
  tradingeconomics: { uk: "Trading Economics", en: "Trading Economics" },
  industrial: { uk: "RI", en: "RI" },
  worldsteel: { uk: "Всесвітньої асоціації сталі", en: "the World Steel Association" },
  owid: { uk: "Our World in Data", en: "Our World in Data" },
  ukraine: { uk: "Ukraine Dataroom", en: "Ukraine Dataroom" },
};

function containsUkrainian(value) {
  return /[А-Яа-яІіЇїЄєҐґ]/u.test(value);
}

function localizedTitle(title) {
  const cached = translations[title];
  if (cached?.uk && cached?.en) return cached;
  return containsUkrainian(title)
    ? { uk: title, en: title, originalLanguage: "uk" }
    : { uk: title, en: title, originalLanguage: "en" };
}

function periodText(frequency, locale) {
  const value = String(frequency ?? "").toLocaleLowerCase();
  if (/daily|щоденн/u.test(value)) return locale === "uk" ? "дню" : "day";
  if (/week|тиж/u.test(value)) return locale === "uk" ? "тижню" : "week";
  if (/month|місяч/u.test(value)) return locale === "uk" ? "місяцю" : "month";
  if (/quarter|кварт/u.test(value)) return locale === "uk" ? "кварталу" : "quarter";
  if (/half|півр/u.test(value)) return locale === "uk" ? "півріччю" : "half-year";
  return locale === "uk" ? "року або опублікованому періоду" : "year or published period";
}

function readerGuide(dataset, corner, titleUa, titleEn) {
  const source = sourceNames[corner] ?? sourceNames.ukraine;
  const periodUa = periodText(dataset.frequency, "uk");
  const periodEn = periodText(dataset.frequency, "en");
  return {
    ua: {
      what: `Набір «${titleUa}» показує, як цей показник змінюється для України у даних ${source.uk}.`,
      how: `Кожна точка відповідає ${periodUa}; читайте її разом з одиницею виміру, датою та параметрами ряду.`,
      use: `Використовуйте ряд, щоб побачити напрямок, масштаб і момент зміни, а потім перевірити можливі причини в інших показниках.`,
      caution: "Один графік показує, що змінилося, але сам по собі не доводить, чому це сталося. Прогнози, оцінки й неповні періоди позначаються окремо.",
    },
    en: {
      what: `“${titleEn}” shows how this indicator changes for Ukraine in ${source.en} data.`,
      how: `Each point represents a ${periodEn}; read it together with its unit, date and series parameters.`,
      use: "Use the series to identify the direction, scale and timing of a change, then check possible causes in other indicators.",
      caution: "One chart shows what changed, but cannot prove why it changed. Forecasts, estimates and incomplete periods are marked separately.",
    },
  };
}

export function localizeDataset(dataset, corner) {
  const originalTitle = dataset.originalTitle ?? dataset.title;
  const translated = localizedTitle(originalTitle);
  const titleUa = dataset.titleUa ?? translated.uk;
  const titleEn = dataset.titleEn ?? translated.en;
  return {
    ...dataset,
    title: titleUa,
    titleOriginal: originalTitle,
    titleUa,
    titleEn,
    originalLanguage: dataset.originalLanguage ?? translated.originalLanguage,
    descriptionUa: dataset.descriptionUa ?? dataset.description,
    descriptionEn:
      dataset.descriptionEn ??
      `${titleEn}. All published observations for Ukraine are retained with their dates, units and source dimensions.`,
    readerGuide: dataset.readerGuide ?? readerGuide(dataset, corner, titleUa, titleEn),
  };
}
