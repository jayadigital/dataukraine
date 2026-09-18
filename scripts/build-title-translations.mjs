import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = resolve(root, "data/title-translations.json");
const apiOutputPath = resolve(root, "../osnova-data-plane/src/title-translations.json");
const localCorners = [
  "budget",
  "oecd",
  "wb",
  "ilostat",
  "imf",
  "eurostat",
  "comtrade",
  "tradingeconomics",
  "industrial",
];
const remoteManifests = [
  "https://nbu.proto.fund/api/nbu-data/dataroom/manifest.json",
  "https://stat.proto.fund/api/stat-data/dataroom/manifest.json",
];

function hasUkrainian(value) {
  return /[А-Яа-яІіЇїЄєҐґ]/u.test(value);
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function existingCache() {
  try {
    return await readJson(outputPath);
  } catch (error) {
    if (error.code === "ENOENT") return {};
    throw error;
  }
}

async function translate(text, source, target) {
  const url = new URL("https://translate.googleapis.com/translate_a/single");
  url.searchParams.set("client", "gtx");
  url.searchParams.set("sl", source);
  url.searchParams.set("tl", target);
  url.searchParams.set("dt", "t");
  url.searchParams.set("q", text);
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const response = await fetch(url, {
      headers: { "user-agent": "Ukraine Dataroom title localization/1.0" },
    });
    if (response.ok) {
      const payload = await response.json();
      const result = payload?.[0]?.map((item) => item?.[0] ?? "").join("").trim();
      if (result) return result;
    }
    if (attempt === 5) {
      throw new Error(`Translation failed (${response.status}) for: ${text}`);
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, attempt * 500));
  }
}

async function mapConcurrent(items, concurrency, mapper) {
  const results = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await mapper(items[index], index);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
  );
  return results;
}

const manifests = [];
for (const corner of localCorners) {
  manifests.push(
    await readJson(resolve(root, `public/data/${corner}/dataroom/manifest.json`)),
  );
}
for (const url of remoteManifests) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
  manifests.push(await response.json());
}

const titles = [
  ...new Set(
    manifests
      .flatMap((manifest) => manifest.datasets ?? [])
      .map((dataset) =>
        String(dataset.titleOriginal ?? dataset.originalTitle ?? dataset.title ?? "").trim()
      )
      .filter(Boolean),
  ),
].sort((left, right) => left.localeCompare(right));
const cache = await existingCache();
const missing = titles.filter((title) => !cache[title]?.uk || !cache[title]?.en);

await mapConcurrent(missing, 10, async (title, index) => {
  const source = hasUkrainian(title) ? "uk" : "en";
  const target = source === "uk" ? "en" : "uk";
  const translated = await translate(title, source, target);
  cache[title] = source === "uk"
    ? { uk: title, en: translated, originalLanguage: "uk" }
    : { uk: translated, en: title, originalLanguage: "en" };
  if ((index + 1) % 100 === 0 || index === missing.length - 1) {
    console.log(`Localized ${index + 1}/${missing.length} missing titles`);
  }
});

await mkdir(dirname(outputPath), { recursive: true });
const serialized = `${JSON.stringify(
    Object.fromEntries(
      Object.entries(cache).sort(([left], [right]) => left.localeCompare(right)),
    ),
    null,
    2,
  )}\n`;
await writeFile(outputPath, serialized);
await writeFile(apiOutputPath, serialized);
console.log(`${titles.length} dataset titles available in Ukrainian and English.`);
