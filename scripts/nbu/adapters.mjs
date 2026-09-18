import { metricRegistry } from "./registry.mjs";
import {
  currentDateParts,
  daysInMonth,
  dottedDate,
  fetchJson,
  isoDate,
  mapLimit,
  mean,
  monthCandidates,
  nbuDate,
  nbuMonth,
  round,
} from "./lib.mjs";

const stat = "https://bank.gov.ua/NBUStatService/v1/statdirectory";
const current = currentDateParts();

const metricDefinitions = Object.fromEntries(
  metricRegistry.map((metric) => [metric.id, metric]),
);

function years(from, to = current.year) {
  return Array.from({ length: to - from + 1 }, (_, index) => from + index);
}

function toIso(value) {
  if (/^\d{8}$/.test(value)) {
    return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
  }
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(value)) {
    const [day, month, year] = value.split(".");
    return `${year}-${month}-${day}`;
  }
  return value;
}

function latestAndPrevious(rows, dateKey = "dt") {
  const sorted = [...rows].sort((a, b) =>
    toIso(a[dateKey]).localeCompare(toIso(b[dateKey])),
  );
  return {
    latest: sorted.at(-1) ?? null,
    previous: sorted.at(-2) ?? null,
  };
}

async function fetchLatestMonthly(buildUrl, pickRow) {
  const found = [];
  for (const candidate of monthCandidates(current.year, current.month, 18)) {
    const rows = await fetchJson(buildUrl(candidate.year, candidate.month));
    const row = pickRow(rows);
    if (row) found.push(row);
    if (found.length === 2) break;
  }
  if (!found.length) throw new Error("No recent monthly NBU observations found");
  return { latest: found[0], previous: found[1] ?? null };
}

function metricResult(id, series, latest, previous, comparisonLabel) {
  const definition = metricDefinitions[id];
  const currentValue = Number(latest.value);
  const previousValue = previous ? Number(previous.value) : null;
  const deltaAbs =
    previousValue === null ? null : round(currentValue - previousValue, 4);
  const deltaPct =
    previousValue === null || previousValue === 0
      ? null
      : round(((currentValue - previousValue) / Math.abs(previousValue)) * 100, 2);

  return {
    ...definition,
    current: round(currentValue, 4),
    currentDate: toIso(latest.dt),
    previous: previousValue === null ? null : round(previousValue, 4),
    previousDate: previous ? toIso(previous.dt) : null,
    deltaAbs,
    deltaPct,
    comparisonLabel,
    series: series.filter((point) => point.value !== null),
  };
}

async function fetchFx() {
  const annual = await mapLimit(years(1996), 6, async (year) => {
    const firstMonth = year === 1996 ? 9 : 1;
    const firstDay = year === 1996 ? 2 : 1;
    const lastMonth = year === current.year ? current.month : 12;
    const lastDay =
      year === current.year
        ? current.day
        : daysInMonth(year, lastMonth);
    const rows = await fetchJson(
      `https://bank.gov.ua/NBU_Exchange/exchange_site?start=${nbuDate(
        year,
        firstMonth,
        firstDay,
      )}&end=${nbuDate(year, lastMonth, lastDay)}&valcode=usd&sort=exchangedate&order=asc&json`,
    );
    const value = mean(rows, (row) => row.rate_per_unit ?? row.rate);
    return value === null
      ? null
      : {
          date: isoDate(year, 12, 31),
          year,
          value: round(value, 4),
          partial: year === current.year,
        };
  });

  const rangeStart = new Date(
    Date.UTC(current.year, current.month - 1, current.day - 14),
  );
  const recentRows = await fetchJson(
    `https://bank.gov.ua/NBU_Exchange/exchange_site?start=${nbuDate(
      rangeStart.getUTCFullYear(),
      rangeStart.getUTCMonth() + 1,
      rangeStart.getUTCDate(),
    )}&end=${nbuDate(
      current.year,
      current.month,
      current.day,
    )}&valcode=usd&sort=exchangedate&order=asc&json`,
  );
  const uniqueBusinessDays = recentRows.filter(
    (row, index, all) =>
      index === 0 || row.calcdate !== all[index - 1]?.calcdate,
  );
  const pair = latestAndPrevious(uniqueBusinessDays, "exchangedate");
  return metricResult(
    "fx_usd",
    annual.filter(Boolean),
    {
      dt: pair.latest.exchangedate,
      value: pair.latest.rate_per_unit ?? pair.latest.rate,
    },
    pair.previous
      ? {
          dt: pair.previous.exchangedate,
          value: pair.previous.rate_per_unit ?? pair.previous.rate,
        }
      : null,
    "до попер. робочого дня",
  );
}

async function fetchPolicyRate() {
  const annual = await mapLimit(years(1992), 8, async (year) => {
    const queryDate =
      year === current.year
        ? nbuDate(current.year, current.month, current.day)
        : nbuDate(year, 12, 31);
    const rows = await fetchJson(`${stat}/key?date=${queryDate}&json`);
    const row = rows.find((item) => item.id_api === "KEY_PolicyRate");
    return row
      ? {
          date: isoDate(year, 12, 31),
          year,
          value: Number(row.value),
          partial: year === current.year,
        }
      : null;
  });

  const previousDate = new Date(
    Date.UTC(current.year, current.month - 1, current.day - 7),
  );
  const [latestRows, previousRows] = await Promise.all([
    fetchJson(
      `${stat}/key?date=${nbuDate(current.year, current.month, current.day)}&json`,
    ),
    fetchJson(
      `${stat}/key?date=${nbuDate(
        previousDate.getUTCFullYear(),
        previousDate.getUTCMonth() + 1,
        previousDate.getUTCDate(),
      )}&json`,
    ),
  ]);
  const latest = latestRows.find((row) => row.id_api === "KEY_PolicyRate");
  const previous = previousRows.find((row) => row.id_api === "KEY_PolicyRate");
  return metricResult(
    "policy_rate",
    annual.filter(Boolean),
    latest,
    previous,
    "за 7 календарних днів",
  );
}

async function fetchUonia() {
  const annual = await mapLimit(years(2020), 4, async (year) => {
    const startMonth = year === 2020 ? 6 : 1;
    const startDay = year === 2020 ? 22 : 1;
    const endMonth = year === current.year ? current.month : 12;
    const endDay =
      year === current.year ? current.day : daysInMonth(year, endMonth);
    const rows = await fetchJson(
      `https://bank.gov.ua/NBU_uonia?id_api=UONIA_UnsecLoansDepo&start=${dottedDate(
        year,
        startMonth,
        startDay,
      )}&end=${dottedDate(
        year,
        endMonth,
        endDay,
      )}&sort=dt&order=asc&json`,
    );
    const value = mean(rows);
    return value === null
      ? null
      : {
          date: isoDate(year, 12, 31),
          year,
          value: round(value, 4),
          partial: year === current.year,
        };
  });

  const rangeStart = new Date(
    Date.UTC(current.year, current.month - 1, current.day - 14),
  );
  const recent = await fetchJson(
    `https://bank.gov.ua/NBU_uonia?id_api=UONIA_UnsecLoansDepo&start=${dottedDate(
      rangeStart.getUTCFullYear(),
      rangeStart.getUTCMonth() + 1,
      rangeStart.getUTCDate(),
    )}&end=${dottedDate(
      current.year,
      current.month,
      current.day,
    )}&sort=dt&order=asc&json`,
  );
  const pair = latestAndPrevious(recent);
  return metricResult(
    "uonia",
    annual.filter(Boolean),
    pair.latest,
    pair.previous,
    "до попер. робочого дня",
  );
}

async function fetchReserves() {
  const recent = await fetchLatestMonthly(
    (year, month) => `${stat}/res?date=${nbuMonth(year, month)}&json`,
    (rows) => rows.find((row) => row.id_api === "RES_OffReserveAssets"),
  );
  const annual = await mapLimit(years(2002, current.year - 1), 8, async (year) => {
    const rows = await fetchJson(`${stat}/res?date=${nbuMonth(year + 1, 1)}&json`);
    const row = rows.find((item) => item.id_api === "RES_OffReserveAssets");
    return row
      ? { date: isoDate(year, 12, 31), year, value: Number(row.value) }
      : null;
  });
  annual.push({
    date: toIso(recent.latest.dt),
    year: current.year,
    value: Number(recent.latest.value),
    partial: true,
  });
  return metricResult(
    "reserves",
    annual.filter(Boolean),
    recent.latest,
    recent.previous,
    "до попер. звітного місяця",
  );
}

async function fetchM3() {
  const buildUrl = (year, month) =>
    `${stat}/monetary?date=${nbuDate(
      year,
      month,
      1,
    )}&id_api=M3&k076=Total&json`;
  const recent = await fetchLatestMonthly(buildUrl, (rows) =>
    rows.find((row) => row.id_api === "M3" && row.k076 === "Total"),
  );
  const annual = await mapLimit(years(2003, current.year - 1), 8, async (year) => {
    const nextYearRows = await fetchJson(buildUrl(year + 1, 1));
    const row = nextYearRows.find(
      (item) => item.id_api === "M3" && item.k076 === "Total",
    );
    return row
      ? { date: isoDate(year, 12, 31), year, value: Number(row.value) }
      : null;
  });
  annual.push({
    date: toIso(recent.latest.dt),
    year: current.year,
    value: Number(recent.latest.value),
    partial: true,
  });
  return metricResult(
    "m3",
    annual.filter(Boolean),
    recent.latest,
    recent.previous,
    "до попер. звітного місяця",
  );
}

function bankBalanceUrl(kind, year, month) {
  const isLoan = kind === "loan";
  const id = isLoan ? "Loans_Res" : "Deposits_Res";
  const maturity = isLoan ? "ods183ld" : "ods183dd";
  return `${stat}/${kind}?date=${nbuDate(
    year,
    month,
    1,
  )}&id_api=${id}&odkodter=total&odr030=total&${maturity}=total&odk111=total&odk051=total&odf074=total${
    isLoan ? "&k040=000" : ""
  }&k140=%23&json`;
}

async function fetchBankBalance(kind) {
  const isLoan = kind === "loan";
  const metricId = isLoan ? "loans" : "deposits";
  const nbuId = isLoan ? "Loans_Res" : "Deposits_Res";
  const recent = await fetchLatestMonthly(
    (year, month) => bankBalanceUrl(kind, year, month),
    (rows) => rows.find((row) => row.id_api === nbuId),
  );
  const annual = await mapLimit(years(2016, current.year - 1), 6, async (year) => {
    const rows = await fetchJson(bankBalanceUrl(kind, year + 1, 1));
    const row = rows.find((item) => item.id_api === nbuId);
    return row
      ? { date: isoDate(year, 12, 31), year, value: Number(row.value) }
      : null;
  });
  annual.push({
    date: toIso(recent.latest.dt),
    year: current.year,
    value: Number(recent.latest.value),
    partial: true,
  });
  return metricResult(
    metricId,
    annual.filter(Boolean),
    recent.latest,
    recent.previous,
    "до попер. звітного місяця",
  );
}

function pickNationalCpi(rows, periodicity) {
  return rows.find(
    (row) =>
      row.id_api === "prices_price_cpi_" &&
      row.mcrd081 === "Total" &&
      row.ku == null &&
      row.tzep === periodicity,
  );
}

async function fetchInflation() {
  const recent = await fetchLatestMonthly(
    (year, month) =>
      `${stat}/inflation?period=m&date=${nbuMonth(year, month)}&json`,
    (rows) => pickNationalCpi(rows, "PCCM_"),
  );
  const annual = await mapLimit(years(2007, current.year - 1), 6, async (year) => {
    const rows = await fetchJson(
      `${stat}/inflation?period=y&date=${nbuMonth(year + 1, 1)}&json`,
    );
    const row = pickNationalCpi(rows, "DTPY_");
    return row
      ? { date: isoDate(year, 12, 31), year, value: Number(row.value) }
      : null;
  });
  annual.push({
    date: toIso(recent.latest.dt),
    year: current.year,
    value: Number(recent.latest.value),
    partial: true,
  });
  return metricResult(
    "inflation",
    annual.filter(Boolean),
    recent.latest,
    recent.previous,
    "до попер. звітного місяця",
  );
}

const loaders = {
  fx_usd: fetchFx,
  policy_rate: fetchPolicyRate,
  uonia: fetchUonia,
  reserves: fetchReserves,
  m3: fetchM3,
  loans: () => fetchBankBalance("loan"),
  deposits: () => fetchBankBalance("deposit"),
  inflation: fetchInflation,
};

export async function fetchMetricById(id) {
  const loader = loaders[id];
  if (!loader) {
    throw new Error(
      `Unknown metric "${id}". Available: ${Object.keys(loaders).join(", ")}`,
    );
  }
  return loader();
}

export async function fetchAllMetrics() {
  return Promise.all(metricRegistry.map((metric) => fetchMetricById(metric.id)));
}
