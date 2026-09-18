const memoryCache = new Map();

export function pad(value) {
  return String(value).padStart(2, "0");
}

export function isoDate(year, month = 1, day = 1) {
  return `${year}-${pad(month)}-${pad(day)}`;
}

export function nbuDate(year, month = 1, day = 1) {
  return `${year}${pad(month)}${pad(day)}`;
}

export function nbuMonth(year, month = 1) {
  return `${year}${pad(month)}`;
}

export function dottedDate(year, month = 1, day = 1) {
  return `${pad(day)}.${pad(month)}.${year}`;
}

export function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function currentDateParts() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Kyiv",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  return Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );
}

export function monthCandidates(year, month, count = 18) {
  const result = [];
  let cursorYear = year;
  let cursorMonth = month;
  for (let index = 0; index < count; index += 1) {
    result.push({ year: cursorYear, month: cursorMonth });
    cursorMonth -= 1;
    if (cursorMonth === 0) {
      cursorMonth = 12;
      cursorYear -= 1;
    }
  }
  return result;
}

export async function fetchJson(url, options = {}) {
  const { retries = 3, cache = true } = options;
  if (cache && memoryCache.has(url)) return memoryCache.get(url);

  let lastError;
  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          accept: "application/json",
          "user-agent": "RI-NBU-Data-Corner/0.1",
        },
      });
      const text = await response.text();
      if (!response.ok || text.startsWith("Error ")) {
        throw new Error(`${response.status}: ${text.slice(0, 160)}`);
      }
      const parsed = JSON.parse(text);
      if (cache) memoryCache.set(url, parsed);
      return parsed;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) =>
        setTimeout(resolve, 300 * 2 ** attempt),
      );
    }
  }
  throw new Error(`NBU request failed: ${url}\n${lastError}`);
}

export async function mapLimit(items, limit, mapper) {
  const result = new Array(items.length);
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      result[index] = await mapper(items[index], index);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker()),
  );
  return result;
}

export function mean(rows, selector = (row) => row.value) {
  if (!rows.length) return null;
  return (
    rows.reduce((total, row) => total + Number(selector(row)), 0) / rows.length
  );
}

export function round(value, digits = 4) {
  if (value === null || value === undefined) return null;
  return Number(Number(value).toFixed(digits));
}

export function previousMonth(year, month) {
  return month === 1
    ? { year: year - 1, month: 12 }
    : { year, month: month - 1 };
}
