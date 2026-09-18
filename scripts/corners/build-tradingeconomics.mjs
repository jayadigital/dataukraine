import {
  buildPublicRelease,
  createCornerDatabase,
  fetchCached,
  generatedAt,
  insertDatasets,
  slugify,
  toNumber,
} from "./common.mjs";

const apiKey = process.env.TRADING_ECONOMICS_API_KEY;
const publicUrl = "https://tradingeconomics.com/ukraine/forecast";

function decode(value) {
  return String(value ?? "")
    .replace(/&nbsp;/giu, " ")
    .replace(/&amp;/giu, "&")
    .replace(/&quot;/giu, '"')
    .replace(/&#39;/giu, "'")
    .replace(/&minus;/giu, "-")
    .replace(/&#(\d+);/gu, (_match, code) => String.fromCodePoint(Number(code)));
}

function stripHtml(value) {
  return decode(String(value ?? "").replace(/<[^>]*>/gu, " "))
    .replace(/\s+/gu, " ")
    .trim();
}

function quarterDate(label) {
  const match = String(label).match(/^Q([1-4])\/(\d{2})$/iu);
  if (!match) return null;
  const year = 2000 + Number(match[2]);
  const month = Number(match[1]) * 3;
  const day = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function categoryFor(group, title) {
  const text = `${group} ${title}`;
  if (/market|currency|stock/iu.test(text)) return "Ринки";
  if (/gdp|overview/iu.test(text)) return "Макроекономіка";
  if (/price|inflation/iu.test(text)) return "Ціни";
  if (/money|interest|loan|deposit/iu.test(text)) return "Гроші та ставки";
  if (/trade|current account|export|import/iu.test(text)) return "Торгівля";
  if (/consumer|retail|confidence/iu.test(text)) return "Споживач";
  if (/labour|employment|unemployment|wage/iu.test(text)) return "Ринок праці";
  if (/government|debt|budget/iu.test(text)) return "Державні фінанси";
  return group || "Інші прогнози";
}

function fromApi(items) {
  return items.map((item) => {
    const points = [{
      label: "Actual",
      date: String(item.LatestValueDate ?? generatedAt).slice(0, 10),
      value: toNumber(item.LatestValue),
      action: "I",
    }];
    for (const key of ["q1", "q2", "q3", "q4"]) {
      const value = toNumber(item[key]);
      const date = String(item[`${key}_date`] ?? "").slice(0, 10);
      if (value !== null && date) points.push({ label: key.toUpperCase(), date, value, action: "F" });
    }
    return {
      key: item.HistoricalDataSymbol || item.Title || item.Category,
      href: item.URL || `/ukraine/${slugify(item.Category)}`,
      title: item.Title || item.Category,
      group: item.Category,
      unit: item.Unit || "значення",
      points,
      raw: item,
    };
  });
}

function fromHtml(html) {
  const results = [];
  const tables = [...html.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/giu)];
  for (const [, table] of tables) {
    const head = table.match(/<thead\b[^>]*>([\s\S]*?)<\/thead>/iu)?.[1] ?? "";
    const headers = [...head.matchAll(/<th\b[^>]*>([\s\S]*?)<\/th>/giu)]
      .map((match) => stripHtml(match[1]))
      .filter(Boolean);
    if (headers.length < 3 || !headers.includes("Actual")) continue;
    const group = headers[0];
    const periodLabels = headers.slice(1);
    const body = table.match(/<tbody\b[^>]*>([\s\S]*?)<\/tbody>/iu)?.[1] ?? "";
    for (const rowMatch of body.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/giu)) {
      const cells = [...rowMatch[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/giu)]
        .map((match) => match[1]);
      if (cells.length < 3) continue;
      const href = cells[0].match(/href=['"]([^'"]+)['"]/iu)?.[1];
      const linkBody = cells[0].match(/<a\b[^>]*>([\s\S]*?)<\/a>/iu)?.[1] ?? cells[0];
      const unit = stripHtml(
        cells[0].match(/table-unit[^>]*>\s*\(([\s\S]*?)\)/iu)?.[1] ?? "",
      );
      let title = stripHtml(linkBody);
      if (unit && title.endsWith(`(${unit})`)) title = title.slice(0, -unit.length - 2).trim();
      if (!href || !title) continue;
      const points = cells.slice(1).map((cell, index) => {
        const label = periodLabels[index] ?? "";
        const value = toNumber(stripHtml(cell));
        return {
          label,
          date: label === "Actual" ? generatedAt.slice(0, 10) : quarterDate(label),
          value,
          action: label === "Actual" ? "I" : "F",
        };
      }).filter((point) => point.date && point.value !== null);
      if (points.length) {
        results.push({
          key: href,
          href,
          title,
          group,
          unit: unit || "значення",
          points,
          raw: { href, title, group, unit, periodLabels },
        });
      }
    }
  }
  return [...new Map(results.map((item) => [item.href, item])).values()];
}

let sourceItems;
let fetchMode;
const failures = [];
if (apiKey) {
  const response = await fetch(
    `https://api.tradingeconomics.com/forecast/country/ukraine?c=${encodeURIComponent(apiKey)}`,
    { headers: { "user-agent": "RI Country Data Corners/0.2" } },
  );
  if (!response.ok) {
    throw new Error(`Trading Economics API ${response.status}: ${await response.text()}`);
  }
  sourceItems = fromApi(await response.json());
  fetchMode = "authenticated Trading Economics country forecast API";
} else {
  const html = (
    await fetchCached(publicUrl, "tradingeconomics/ukraine-forecast.html", {
      headers: { "user-agent": "Mozilla/5.0 RI Country Data Corners/0.2" },
    })
  ).toString("utf8");
  sourceItems = fromHtml(html);
  fetchMode = "public Ukraine forecast page snapshot; API key not configured";
  failures.push({
    id: "authenticated-api",
    error: "The Trading Economics guest account is discontinued. Set TRADING_ECONOMICS_API_KEY to add authenticated historical datasets and the complete forecast API response.",
  });
}

const heroTitles = [
  "GDP Annual Growth Rate",
  "Inflation Rate",
  "Interest Rate",
  "Unemployment Rate",
  "Government Debt to GDP",
  "Current Account to GDP",
  "Balance of Trade",
  "Currency",
];
sourceItems.sort((a, b) => {
  const ai = heroTitles.indexOf(a.title);
  const bi = heroTitles.indexOf(b.title);
  if (ai !== -1 || bi !== -1) return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  return a.title.localeCompare(b.title);
});

const datasets = sourceItems.map((item, index) => ({
  id: slugify(item.href.replace(/^\/ukraine\//u, "")),
  number: index + 1,
  flowId: item.key,
  title: item.title,
  category: categoryFor(item.group, item.title),
  priority: heroTitles.includes(item.title) ? "hero" : index < 24 ? "top" : "deep",
  frequency: "Квартальний прогнозний зріз",
  officialUrl: "https://docs.tradingeconomics.com/forecasts/indicators/",
  sourceUrl: new URL(item.href, "https://tradingeconomics.com").href,
  fetchMode,
  description: `${item.title}: останнє публічне значення та видимий квартальний прогноз Trading Economics для України.`,
  question: `Який короткостроковий напрям Trading Economics очікує для «${item.title}»?`,
  why: "Це зовнішній модельний прогноз. Його корисно порівнювати з IMF і World Bank, але не слід сприймати як офіційну статистику України.",
  annualization: "Поточний публічний прогнозний знімок; точки майбутніх кварталів позначені як forecast",
  limitation: apiKey
    ? "Trading Economics використовує власну модель; метод і значення можуть оновлюватися після нових даних."
    : "Без API-ключа доступний лише публічний прогнозний знімок, без повної історії та без права називати його API-покриттям.",
  rows: item.points.map((point) => ({
    timePeriod: point.label,
    date: point.date,
    value: point.value,
    indicatorCode: item.key,
    indicatorLabel: item.title,
    unit: /%/u.test(item.unit) ? "%" : item.unit,
    freq: point.action === "F" ? "Q" : "S",
    action: point.action,
    dimensions: {
      country: "Ukraine",
      category: item.group,
      horizon: point.label,
    },
    attributes: {
      apiAuthenticated: Boolean(apiKey),
      capturedAt: generatedAt,
    },
    raw: {
      ...item.raw,
      period: point.label,
      date: point.date,
      value: point.value,
      action: point.action,
    },
  })),
}));

const { db, databasePath } = await createCornerDatabase("tradingeconomics");
insertDatasets(db, datasets);
await buildPublicRelease("tradingeconomics", db, datasets, failures);
db.close();
console.log(
  `Trading Economics corner: ${datasets.length} public forecast rooms, authenticated=${Boolean(apiKey)} -> ${databasePath}`,
);
