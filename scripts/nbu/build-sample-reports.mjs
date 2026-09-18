import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { fetchJson, nbuDate, nbuMonth, dottedDate, round } from "./lib.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../..");
const output = resolve(root, "public/data/reports");
const stat = "https://bank.gov.ua/NBUStatService/v1/statdirectory";
const now = new Date();
const generatedAt = now.toISOString();
const today = {
  year: now.getUTCFullYear(),
  month: now.getUTCMonth() + 1,
  day: now.getUTCDate(),
};

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

function mean(rows, field = "value") {
  const values = rows.map((row) => Number(row[field])).filter(Number.isFinite);
  return values.length
    ? values.reduce((total, value) => total + value, 0) / values.length
    : null;
}

function find(rows, id, extra = () => true) {
  return rows.find((row) => row.id_api === id && extra(row));
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
  return text;
}

function latestDate(rows) {
  return rows
    .map((row) => toIso(row.dt ?? row.exchangedate))
    .filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date))
    .sort()
    .at(-1);
}

function dateParts(iso) {
  const [year, month, day] = iso.split("-").map(Number);
  return { year, month, day };
}

function offsetDay(parts, amount) {
  const date = new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day + amount),
  );
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

function offsetMonth(parts, amount) {
  const date = new Date(Date.UTC(parts.year, parts.month - 1 + amount, 1));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 };
}

function labelDate(iso) {
  return new Intl.DateTimeFormat("uk-UA", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${iso}T00:00:00Z`));
}

function labelMonth(iso) {
  return new Intl.DateTimeFormat("uk-UA", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${iso.slice(0, 7)}-01T00:00:00Z`));
}

function monthComparisonTitle(currentIso, previousIso) {
  const nominative = [
    "січень",
    "лютий",
    "березень",
    "квітень",
    "травень",
    "червень",
    "липень",
    "серпень",
    "вересень",
    "жовтень",
    "листопад",
    "грудень",
  ];
  const genitive = [
    "січня",
    "лютого",
    "березня",
    "квітня",
    "травня",
    "червня",
    "липня",
    "серпня",
    "вересня",
    "жовтня",
    "листопада",
    "грудня",
  ];
  const current = dateParts(currentIso);
  const previous = dateParts(previousIso);
  const title = `${nominative[current.month - 1]} ${current.year} проти ${genitive[previous.month - 1]} ${previous.year}`;
  return `${title[0].toLocaleUpperCase("uk")}${title.slice(1)}`;
}

function displayValue(value, unit) {
  const formatted = Number(value).toLocaleString("uk-UA", {
    maximumFractionDigits: Math.abs(value) < 100 ? 2 : 1,
  });
  return unit === "%" ? `${formatted}%` : `${formatted} ${unit}`.trim();
}

function deltaLabel(delta, deltaPct, unit) {
  const value = unit === "%" ? delta : deltaPct;
  if (value === null) return "без бази порівняння";
  const suffix = unit === "%" ? " п.п." : "%";
  return `${value > 0 ? "+" : ""}${value.toLocaleString("uk-UA", {
    maximumFractionDigits: 2,
  })}${suffix}`;
}

function observation(
  id,
  label,
  unit,
  current,
  previous,
  currentDate,
  previousDate,
  options = {},
) {
  const currentValue = Number(current);
  const previousValue = Number(previous);
  if (!Number.isFinite(currentValue) || !Number.isFinite(previousValue)) {
    return null;
  }
  const delta = round(currentValue - previousValue, 4);
  const deltaPct =
    previousValue === 0
      ? null
      : round((delta / Math.abs(previousValue)) * 100, 2);
  const magnitude = options.percentagePoint
    ? Math.abs(delta)
    : Math.abs(deltaPct ?? 0);
  const level =
    magnitude >= (options.critical ?? 3)
      ? "critical"
      : magnitude >= (options.watch ?? 1)
        ? "watch"
        : magnitude > 0
          ? "context"
          : "stable";
  const movement =
    delta === 0
      ? "без зміни"
      : `рух ${deltaLabel(delta, deltaPct, unit)}`;
  const insightBody = `${label}: ${displayValue(
    currentValue,
    unit,
  )}; ${movement}`;
  const insight = `${insightBody}${insightBody.endsWith(".") ? "" : "."}`;
  return {
    id,
    label,
    unit,
    current: round(currentValue, 4),
    previous: round(previousValue, 4),
    currentDate,
    previousDate,
    delta,
    deltaPct,
    level,
    comparison: options.comparison,
    insight: insight.slice(0, 200),
  };
}

function report(
  id,
  period,
  title,
  kicker,
  deck,
  observations,
  notes,
) {
  const rank = { critical: 0, watch: 1, context: 2, stable: 3 };
  const sorted = observations
    .filter(Boolean)
    .sort((left, right) => rank[left.level] - rank[right.level]);
  if (!sorted.length) throw new Error(`No observations generated for ${id}`);
  const lead = sorted[0];
  return {
    id,
    period,
    title,
    kicker,
    deck: deck.slice(0, 200),
    brief: `Найпомітніша зміна — ${lead.insight}`.slice(0, 200),
    generatedAt,
    source: "Національний банк України",
    observations: sorted,
    lead,
    notes,
  };
}

function toMarkdown(item) {
  const rows = item.observations
    .map(
      (row) =>
        `| ${row.label} | ${row.previous} | ${row.current} | ${row.delta > 0 ? "+" : ""}${row.delta} | ${row.insight} |`,
    )
    .join("\n");
  return `# ${item.title}\n\n**${item.kicker}**\n\n${item.deck}\n\n> ${item.brief}\n\n| Показник | Було | Стало | Зміна | Що це каже |\n|---|---:|---:|---:|---|\n${rows}\n\n## Як читати\n\n${item.notes.join("\n\n")}\n\n---\n\nДжерело: відкриті дані Національного банку України. Порівняння описує числа і не приписує їм неперевірених причин. Згенеровано ${item.generatedAt}.\n`;
}

async function marketRange(start, end) {
  const [fx, uonia, swap] = await Promise.all([
    fetchJson(
      `https://bank.gov.ua/NBU_Exchange/exchange_site?start=${nbuDate(
        start.year,
        start.month,
        start.day,
      )}&end=${nbuDate(
        end.year,
        end.month,
        end.day,
      )}&valcode=usd&sort=exchangedate&order=asc&json`,
    ),
    fetchJson(
      `https://bank.gov.ua/NBU_uonia?id_api=UONIA_UnsecLoansDepo&start=${dottedDate(
        start.year,
        start.month,
        start.day,
      )}&end=${dottedDate(end.year, end.month, end.day)}&sort=dt&order=asc&json`,
    ),
    fetchJson(
      `https://bank.gov.ua/NBU_uonia?id_api=REF-SWAP_Swaps&start=${dottedDate(
        start.year,
        start.month,
        start.day,
      )}&end=${dottedDate(end.year, end.month, end.day)}&sort=dt&order=asc&json`,
    ),
  ]);
  return { fx, uonia, swap };
}

function valueOn(rows, iso, field = "value") {
  const row = rows.find(
    (candidate) =>
      toIso(candidate.dt ?? candidate.exchangedate) === iso &&
      Number.isFinite(Number(candidate[field])),
  );
  return row ? Number(row[field]) : null;
}

async function policyOn(iso) {
  const parts = dateParts(iso);
  const rows = await fetchJson(
    `${stat}/key?date=${nbuDate(parts.year, parts.month, parts.day)}&json`,
  );
  return Number(find(rows, "KEY_PolicyRate")?.value);
}

async function dailyFrames() {
  const start = offsetDay(today, -20);
  const market = await marketRange(start, today);
  const fxDates = new Set(
    market.fx.map((row) => toIso(row.exchangedate)).filter(Boolean),
  );
  const dates = [
    ...new Set(market.uonia.map((row) => toIso(row.dt)).filter(Boolean)),
  ]
    .filter((date) => fxDates.has(date))
    .sort()
    .slice(-2);
  if (dates.length < 2) {
    throw new Error("NBU does not expose two common recent market days");
  }
  const policies = await Promise.all(dates.map(policyOn));
  return dates.map((date, index) => ({
    date,
    fx:
      valueOn(market.fx, date, "rate_per_unit") ??
      valueOn(market.fx, date, "rate"),
    uonia: valueOn(market.uonia, date),
    swap: valueOn(market.swap, date),
    policy: policies[index],
  }));
}

async function annualMarketFrame(year, month, day) {
  const start = { year, month: 1, day: 1 };
  const end = { year, month, day };
  const market = await marketRange(start, end);
  return {
    date: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    fx: mean(market.fx, "rate_per_unit") ?? mean(market.fx, "rate"),
    uonia: mean(market.uonia),
    policy: await policyOn(
      `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    ),
  };
}

function totalBankUrl(kind, year, month) {
  const loan = kind === "loan";
  const id = loan ? "Loans_Res" : "Deposits_Res";
  const maturity = loan ? "ods183ld" : "ods183dd";
  return `${stat}/${kind}?date=${nbuDate(
    year,
    month,
    1,
  )}&id_api=${id}&odkodter=total&odr030=total&${maturity}=total&odk111=total&odk051=total&odf074=total${
    loan ? "&k040=000" : ""
  }&k140=%23&json`;
}

async function monthlyFrame(year, month) {
  const [reserves, monetary, loans, deposits, inflation] = await Promise.all([
    fetchJson(`${stat}/res?date=${nbuMonth(year, month)}&json`),
    fetchJson(
      `${stat}/monetary?date=${nbuDate(year, month, 1)}&id_api=M3&k076=Total&json`,
    ),
    fetchJson(totalBankUrl("loan", year, month)),
    fetchJson(totalBankUrl("deposit", year, month)),
    fetchJson(`${stat}/inflation?period=m&date=${nbuMonth(year, month)}&json`),
  ]);
  const nationalCpi = inflation.find(
    (row) =>
      row.id_api === "prices_price_cpi_" &&
      row.mcrd081 === "Total" &&
      row.ku == null &&
      row.tzep === "PCCM_",
  );
  const frame = {
    request: { year, month },
    date:
      latestDate(reserves) ??
      latestDate(monetary) ??
      latestDate(inflation) ??
      `${year}-${String(month).padStart(2, "0")}-01`,
    reserves: Number(find(reserves, "RES_OffReserveAssets")?.value),
    m3: Number(
      monetary.find(
        (row) => row.id_api === "M3" && row.k076 === "Total",
      )?.value,
    ),
    loans: Number(find(loans, "Loans_Res")?.value),
    deposits: Number(find(deposits, "Deposits_Res")?.value),
    inflation: Number(nationalCpi?.value),
  };
  return Object.values(frame)
    .slice(2)
    .every((value) => Number.isFinite(value))
    ? frame
    : null;
}

async function latestMonthlyFrames() {
  const frames = [];
  for (let offset = 0; offset > -12 && frames.length < 2; offset -= 1) {
    const candidate = offsetMonth(today, offset);
    const frame = await monthlyFrame(candidate.year, candidate.month);
    if (frame && !frames.some((item) => item.date === frame.date)) {
      frames.push(frame);
    }
  }
  if (frames.length < 2) {
    throw new Error("NBU does not expose two complete recent monthly frames");
  }
  return frames;
}

const [previousDay, currentDay] = await dailyFrames();
const daily = report(
  `daily-${currentDay.date}`,
  "daily",
  `${labelDate(currentDay.date)}: день до дня`,
  `${labelDate(previousDay.date)} → ${labelDate(currentDay.date)}`,
  "Короткий ринковий зріз: курс, UONIA, swap-індекс та облікова ставка на дві останні спільні дати.",
  [
    observation(
      "fx",
      "USD/UAH",
      "грн / USD",
      currentDay.fx,
      previousDay.fx,
      currentDay.date,
      previousDay.date,
      { watch: 0.7, critical: 1.5 },
    ),
    observation(
      "uonia",
      "UONIA",
      "%",
      currentDay.uonia,
      previousDay.uonia,
      currentDay.date,
      previousDay.date,
      { percentagePoint: true, watch: 0.25, critical: 0.5 },
    ),
    observation(
      "swap",
      "Swap-індекс",
      "%",
      currentDay.swap,
      previousDay.swap,
      currentDay.date,
      previousDay.date,
      { percentagePoint: true, watch: 0.25, critical: 0.5 },
    ),
    observation(
      "policy",
      "Облікова ставка",
      "%",
      currentDay.policy,
      previousDay.policy,
      currentDay.date,
      previousDay.date,
      { percentagePoint: true, watch: 0.25, critical: 0.5 },
    ),
  ],
  [
    "День порівнюється з попередньою датою, на яку одночасно є курс і UONIA.",
    "Відсутній swap не перетворюється на нуль: такий рядок не потрапляє до таблиці.",
  ],
);

const [currentMonth, previousMonth] = await latestMonthlyFrames();
const monthly = report(
  `monthly-${currentMonth.date.slice(0, 7)}`,
  "monthly",
  monthComparisonTitle(currentMonth.date, previousMonth.date),
  "Останні два повні місячні зрізи",
  "Резерви, гроші, кредити, депозити й інфляція показують, як змінився баланс економіки за один звітний місяць.",
  [
    observation(
      "reserves",
      "Міжнародні резерви",
      "млн USD",
      currentMonth.reserves,
      previousMonth.reserves,
      currentMonth.date,
      previousMonth.date,
      { watch: 1.5, critical: 3 },
    ),
    observation(
      "m3",
      "Грошова маса M3",
      "млн грн",
      currentMonth.m3,
      previousMonth.m3,
      currentMonth.date,
      previousMonth.date,
      { watch: 1, critical: 2.5 },
    ),
    observation(
      "loans",
      "Кредити",
      "млн грн",
      currentMonth.loans,
      previousMonth.loans,
      currentMonth.date,
      previousMonth.date,
      { watch: 1, critical: 2.5 },
    ),
    observation(
      "deposits",
      "Депозити",
      "млн грн",
      currentMonth.deposits,
      previousMonth.deposits,
      currentMonth.date,
      previousMonth.date,
      { watch: 1, critical: 2.5 },
    ),
    observation(
      "inflation",
      "Інфляція р/р",
      "%",
      currentMonth.inflation,
      previousMonth.inflation,
      currentMonth.date,
      previousMonth.date,
      { percentagePoint: true, watch: 0.5, critical: 1 },
    ),
  ],
  [
    "Запаси порівнюються між двома звітними датами, а не сумуються.",
    "Інфляція у відсотках порівнюється у відсоткових пунктах.",
  ],
);

const currentEnd = dateParts(currentDay.date);
const previousYear = currentEnd.year - 1;
const [currentAnnualMarket, previousAnnualMarket, previousYearMonth] =
  await Promise.all([
    annualMarketFrame(currentEnd.year, currentEnd.month, currentEnd.day),
    annualMarketFrame(previousYear, currentEnd.month, currentEnd.day),
    monthlyFrame(
      currentMonth.request.year - 1,
      currentMonth.request.month,
    ),
  ]);

if (!previousYearMonth) {
  throw new Error("NBU does not expose the matching prior-year monthly frame");
}

const annual = report(
  `annual-${previousYear}-${currentEnd.year}`,
  "annual",
  `${previousYear} → ${currentEnd.year}: однаковий відрізок`,
  `1 січня – ${labelDate(currentDay.date)}`,
  "Однакові календарні вікна показують річний рух без помилки від порівняння повного року з неповним.",
  [
    observation(
      "fx",
      "Середній USD/UAH",
      "грн / USD",
      currentAnnualMarket.fx,
      previousAnnualMarket.fx,
      currentAnnualMarket.date,
      previousAnnualMarket.date,
      { watch: 3, critical: 8 },
    ),
    observation(
      "uonia",
      "Середня UONIA",
      "%",
      currentAnnualMarket.uonia,
      previousAnnualMarket.uonia,
      currentAnnualMarket.date,
      previousAnnualMarket.date,
      { percentagePoint: true, watch: 1, critical: 3 },
    ),
    observation(
      "policy",
      "Облікова ставка",
      "%",
      currentAnnualMarket.policy,
      previousAnnualMarket.policy,
      currentAnnualMarket.date,
      previousAnnualMarket.date,
      { percentagePoint: true, watch: 1, critical: 3 },
    ),
    observation(
      "reserves",
      "Міжнародні резерви",
      "млн USD",
      currentMonth.reserves,
      previousYearMonth.reserves,
      currentMonth.date,
      previousYearMonth.date,
      { watch: 5, critical: 12 },
    ),
    observation(
      "m3",
      "Грошова маса M3",
      "млн грн",
      currentMonth.m3,
      previousYearMonth.m3,
      currentMonth.date,
      previousYearMonth.date,
      { watch: 8, critical: 18 },
    ),
    observation(
      "loans",
      "Кредити",
      "млн грн",
      currentMonth.loans,
      previousYearMonth.loans,
      currentMonth.date,
      previousYearMonth.date,
      { watch: 8, critical: 18 },
    ),
    observation(
      "deposits",
      "Депозити",
      "млн грн",
      currentMonth.deposits,
      previousYearMonth.deposits,
      currentMonth.date,
      previousYearMonth.date,
      { watch: 8, critical: 18 },
    ),
    observation(
      "inflation",
      "Інфляція р/р",
      "%",
      currentMonth.inflation,
      previousYearMonth.inflation,
      currentMonth.date,
      previousYearMonth.date,
      { percentagePoint: true, watch: 1, critical: 3 },
    ),
  ],
  [
    "Денні ставки й курс усереднено за однакові календарні вікна.",
    "Місячні показники зіставлено за однаковим звітним місяцем.",
  ],
);

const reports = [annual, monthly, daily];
await Promise.all(
  reports.flatMap((item) => [
    writeFile(
      resolve(output, `${item.id}.json`),
      `${JSON.stringify(item, null, 2)}\n`,
    ),
    writeFile(resolve(output, `${item.id}.md`), toMarkdown(item)),
  ]),
);
await writeFile(
  resolve(output, "manifest.json"),
  `${JSON.stringify(
    reports.map((item) => ({
      id: item.id,
      period: item.period,
      title: item.title,
      kicker: item.kicker,
      deck: item.deck,
      brief: item.brief,
      generatedAt: item.generatedAt,
      lead: item.lead,
      json: `/data/reports/${item.id}.json`,
      markdown: `/data/reports/${item.id}.md`,
      url: `/report/${item.id}`,
    })),
    null,
    2,
  )}\n`,
);

console.log(`Generated ${reports.length} comparison reports in ${output}`);
