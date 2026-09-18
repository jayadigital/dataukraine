import {
  buildPublicRelease,
  createCornerDatabase,
  fetchCached,
  insertDatasets,
  mapConcurrent,
  slugify,
  toNumber,
} from "./common.mjs";

const api = "https://www.imf.org/external/datamapper/api/v2";
const indicatorPayload = JSON.parse(
  (await fetchCached(`${api}/indicators`, "imf/indicators.json")).toString("utf8"),
);
const indicatorEntries = Object.entries(indicatorPayload.indicators ?? {});

const results = await mapConcurrent(indicatorEntries, 8, async ([id, metadata]) => {
  try {
    const body = await fetchCached(
      `${api}/${encodeURIComponent(id)}/UKR`,
      `imf/data/${slugify(id)}.json`,
      { signal: AbortSignal.timeout(45_000) },
    );
    const payload = JSON.parse(body.toString("utf8"));
    const values = payload.values?.[id]?.UKR ?? {};
    return { id, metadata, values };
  } catch (error) {
    return { id, metadata, error: error.message };
  }
});

const heroIds = [
  "NGDP_RPCH",
  "NGDPD",
  "NGDPDPC",
  "PCPIPCH",
  "PCPIEPCH",
  "LUR",
  "BCA_NGDPD",
  "GGXONLB_NGDP",
  "GGXWDG_NGDP",
  "FM_LS",
  "FM_GGXWDG_NGDP",
  "GDD",
];

function categoryFor(metadata) {
  const dataset = metadata.dataset ?? "";
  if (dataset === "WEO") return "Світовий економічний прогноз";
  if (/FM|FISCAL/iu.test(dataset)) return "Державні фінанси";
  if (/DEBT|GDD|HPDD/iu.test(`${dataset} ${metadata.source}`)) return "Борг";
  if (/ARA|RESERVE/iu.test(`${dataset} ${metadata.source}`)) return "Резерви";
  if (/AIPI|AI Preparedness/iu.test(`${dataset} ${metadata.source}`)) {
    return "Цифрова готовність";
  }
  if (/Capital Flow|Openness/iu.test(metadata.source ?? "")) {
    return "Капітал і відкритість";
  }
  return "Інші індикатори IMF";
}

function unitFor(unit) {
  if (/percent|% of|percentage/iu.test(unit ?? "")) return "%";
  return unit || "значення";
}

const failures = [];
const available = [];
for (const result of results) {
  if (result.error) {
    failures.push({ id: result.id, error: result.error });
    continue;
  }
  const points = Object.entries(result.values)
    .filter(([year, value]) => /^\d{4}$/u.test(year) && toNumber(value) !== null);
  if (!points.length) {
    failures.push({
      id: result.id,
      error: "The DataMapper indicator currently has no Ukraine observations.",
    });
    continue;
  }
  available.push({ ...result, points });
}

available.sort((a, b) => {
  const ai = heroIds.indexOf(a.id);
  const bi = heroIds.indexOf(b.id);
  if (ai !== -1 || bi !== -1) return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  return (a.metadata.label ?? a.id).localeCompare(b.metadata.label ?? b.id);
});

const datasets = available.map(({ id, metadata, points }, index) => {
  const projectionYear = Number(metadata["projection-year"]) || null;
  const title = String(metadata.label ?? id).trim();
  const rows = points
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([year, value]) => ({
      timePeriod: year,
      date: `${year}-12-31`,
      value: toNumber(value),
      indicatorCode: id,
      indicatorLabel: title,
      unit: unitFor(metadata.unit),
      freq: "A",
      action: projectionYear && Number(year) >= projectionYear ? "F" : "I",
      dimensions: {
        economy: "UKR",
        dataset: metadata.dataset,
      },
      attributes: {
        source: metadata.source,
        projectionYear,
        lastModified: metadata["last-modified"],
      },
      raw: {
        economy: "UKR",
        indicator: id,
        year,
        value,
        unit: metadata.unit,
        dataset: metadata.dataset,
        source: metadata.source,
        projection_year: projectionYear,
      },
    }));
  return {
    id: slugify(id),
    number: index + 1,
    flowId: id,
    title,
    category: categoryFor(metadata),
    priority: heroIds.includes(id) ? "hero" : index < 30 ? "top" : "deep",
    frequency: "Річна",
    officialUrl: "https://data.imf.org/en/Resource-Pages/IMF-API",
    sourceUrl: `${api}/${encodeURIComponent(id)}/UKR`,
    fetchMode: "complete Ukraine time series from the public IMF DataMapper v2 API",
    description: metadata.description || `${title}. Повна доступна річна серія України у IMF DataMapper.`,
    question: `Що IMF бачить у показнику «${title}» для України?`,
    why: "IMF поєднує історію та власний макроекономічний прогноз. Позначка прогнозу важлива: це сценарій, а не вже виміряний результат.",
    annualization: projectionYear
      ? `Річні значення; ${projectionYear}+ позначено як прогноз IMF`
      : "Офіційні річні значення IMF без заповнення пропусків",
    limitation: projectionYear
      ? `Роки від ${projectionYear} є прогнозом IMF і можуть переглядатися у наступному випуску.`
      : null,
    rows,
  };
});

const { db, databasePath } = await createCornerDatabase("imf");
insertDatasets(db, datasets);
await buildPublicRelease("imf", db, datasets, failures);
db.close();
console.log(
  `IMF corner: ${datasets.length} rooms, ${failures.length} unavailable indicators -> ${databasePath}`,
);
