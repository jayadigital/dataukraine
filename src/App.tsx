import {
  createContext,
  startTransition,
  useDeferredValue,
  useEffect,
  useContext,
  useRef,
  useState,
} from "react";
import { DataChart } from "./components/DataChart";
import { LineChart } from "./components/LineChart";
import { MiniChart } from "./components/MiniChart";
import { magazineArticle, magazineArticles } from "./magazine";
import titleTranslations from "../data/title-translations.json";
import type {
  ComparisonObservation,
  ComparisonReport,
  CoverageReport,
  DashboardData,
  DatasetFact,
  DatasetIndicator,
  DatasetLineage,
  DatasetSummary,
  DatasetTag,
  DataroomCard,
  DataroomManifest,
  GraphAliasIndex,
  GraphAliasRecord,
  Metric,
  ReportManifestItem,
  Signal,
} from "./types";

type CornerKey =
  | "nbu"
  | "stat"
  | "budget"
  | "oecd"
  | "wb"
  | "ilostat"
  | "imf"
  | "eurostat"
  | "comtrade"
  | "tradingeconomics"
  | "industrial"
  | "worldsteel"
  | "owid"
  | "uconomics"
  | "frames"
  | "scenarios"
  | "ukraine";
type SourceCornerKey = Exclude<CornerKey, "ukraine" | "uconomics" | "frames" | "scenarios">;
type StaticCornerKey = "uconomics" | "frames" | "scenarios";
type DataCornerKey = SourceCornerKey | StaticCornerKey;
const sourceCornerKeys = new Set<SourceCornerKey>([
  "nbu",
  "stat",
  "budget",
  "oecd",
  "wb",
  "ilostat",
  "imf",
  "eurostat",
  "comtrade",
  "tradingeconomics",
  "industrial",
  "worldsteel",
  "owid",
]);
const sourceCornerOrder = Array.from(sourceCornerKeys);
const dataCornerOrder: DataCornerKey[] = [...sourceCornerOrder, "uconomics", "frames", "scenarios"];
const staticCornerKeys = new Set<StaticCornerKey>(["uconomics", "frames", "scenarios"]);
const dataUkraineLogoUrl = "https://storage.googleapis.com/osnova_pub/du/du_logo_id_transparent.png";
const datasetRequestTimeoutMs = 15_000;
const graphPrefixes: Record<CornerKey, string> = {
  nbu: "NBU",
  stat: "STAT",
  budget: "BUD",
  oecd: "OECD",
  wb: "WB",
  ilostat: "ILO",
  imf: "IMF",
  eurostat: "EURO",
  comtrade: "TRADE",
  tradingeconomics: "TE",
  industrial: "RI",
  worldsteel: "WSA",
  owid: "OWID",
  uconomics: "UCO",
  frames: "FRAMES",
  scenarios: "SCEN",
  ukraine: "CORE",
};

function isSourceCorner(value: string): value is SourceCornerKey {
  return sourceCornerKeys.has(value as SourceCornerKey);
}

function isDataCorner(value: string): value is DataCornerKey {
  return isSourceCorner(value) || staticCornerKeys.has(value as StaticCornerKey);
}

function isStaticCorner(value: string): value is StaticCornerKey {
  return staticCornerKeys.has(value as StaticCornerKey);
}

type Locale = "uk" | "en";
type Theme = "day" | "night";
const SettingsContext = createContext<{
  locale: Locale;
  setLocale: (locale: Locale) => void;
  theme: Theme;
  setTheme: (theme: Theme) => void;
}>({
  locale: "uk",
  setLocale: () => undefined,
  theme: "day",
  setTheme: () => undefined,
});

function useSettings() {
  return useContext(SettingsContext);
}

const cornerConfigs: Record<
  CornerKey,
  {
    mark: string;
    source: string;
    sourceShort: string;
    hero: string;
    heroEmphasis: string;
    deck: string;
    sourceUrl: string;
  }
> = {
  nbu: {
    mark: "NBU",
    source: "Національний банк України",
    sourceShort: "NBU",
    hero: "Національний банк України",
    heroEmphasis: "",
    deck: "Курси, процентні ставки, банки, кредити, депозити, резерви, валютний ринок і зовнішній сектор.",
    sourceUrl: "https://bank.gov.ua/ua/open-data/api-dev",
  },
  stat: {
    mark: "STAT",
    source: "Держстат України",
    sourceShort: "Держстат",
    hero: "Державна статистика України",
    heroEmphasis: "",
    deck: "Населення, праця, ціни, виробництво, торгівля, регіони та національні рахунки.",
    sourceUrl: "https://stat.gov.ua/uk/page-0",
  },
  budget: {
    mark: "BUDGET",
    source: "Open Budget України",
    sourceShort: "Open Budget",
    hero: "Державний бюджет",
    heroEmphasis: "",
    deck: "Доходи, видатки, кредитування, фінансування та місцеві бюджети.",
    sourceUrl: "https://api.openbudget.gov.ua/swagger-ui.html",
  },
  oecd: {
    mark: "OECD",
    source: "OECD Data Explorer",
    sourceShort: "OECD",
    hero: "OECD: Україна",
    heroEmphasis: "",
    deck: "Міжнародно зіставні ряди про податки, енергію, допомогу, торгівлю та політики.",
    sourceUrl: "https://www.oecd.org/en/data/insights/data-explainers/2024/09/api.html",
  },
  wb: {
    mark: "WORLD BANK",
    source: "World Bank Data360",
    sourceShort: "World Bank",
    hero: "World Bank: Україна",
    heroEmphasis: "",
    deck: "World Development Indicators: економіка, населення, освіта, здоров’я, клімат та урядування.",
    sourceUrl: "https://data360.worldbank.org/en/api",
  },
  ilostat: {
    mark: "ILOSTAT",
    source: "International Labour Organization",
    sourceShort: "ILOSTAT",
    hero: "Ринок праці",
    heroEmphasis: "",
    deck: "Зайнятість, безробіття, зарплати, робочий час, професії, вік і стать у повній річній серії України.",
    sourceUrl: "https://rplumber.ilo.org/__docs__/",
  },
  imf: {
    mark: "IMF",
    source: "IMF DataMapper",
    sourceShort: "IMF",
    hero: "IMF: Україна",
    heroEmphasis: "",
    deck: "Макроекономіка, державні фінанси, борг і зовнішній сектор з видимою межею між історією та прогнозом IMF.",
    sourceUrl: "https://www.imf.org/external/datamapper/api/",
  },
  eurostat: {
    mark: "EUROSTAT",
    source: "Eurostat",
    sourceShort: "Eurostat",
    hero: "Eurostat: Україна",
    heroEmphasis: "",
    deck: "Європейські класифікації для економіки, людей, енергії, довкілля, агро, торгівлі та соціальної сфери.",
    sourceUrl: "https://ec.europa.eu/eurostat/web/ukraine",
  },
  comtrade: {
    mark: "COMTRADE",
    source: "UN Comtrade",
    sourceShort: "UN Comtrade",
    hero: "Зовнішня торгівля",
    heroEmphasis: "",
    deck: "Експорт, імпорт, товарні групи HS2 і партнери України: від загального балансу до конкретної галузі.",
    sourceUrl: "https://comtradeplus.un.org/",
  },
  tradingeconomics: {
    mark: "TRADING ECONOMICS",
    source: "Trading Economics",
    sourceShort: "Trading Economics",
    hero: "Trading Economics: Україна",
    heroEmphasis: "",
    deck: "Публічний короткостроковий прогноз України з чесною позначкою доступу: без API-ключа це snapshot, а не повна історія.",
    sourceUrl: "https://tradingeconomics.com/ukraine/forecast",
  },
  industrial: {
    mark: "INDUSTRY",
    source: "RI Industrial Economy",
    sourceShort: "Промисловість RI",
    hero: "Промисловість України",
    heroEmphasis: "",
    deck: "Металургія, енергетика, хімія, машинобудування, будівництво, агро, інфраструктура та сценарні ряди.",
    sourceUrl: "https://ukraine.proto.fund/corner/industrial",
  },
  worldsteel: {
    mark: "WORLDSTEEL",
    source: "World Steel Association",
    sourceShort: "Worldsteel",
    hero: "Сталь України та регіону",
    heroEmphasis: "",
    deck: "Місячне й річне виробництво сирої сталі в Україні, Польщі, Румунії та Туреччині.",
    sourceUrl: "https://worldsteel.org/data/world-steel-in-figures/",
  },
  owid: {
    mark: "OWID",
    source: "Our World in Data",
    sourceShort: "OWID",
    hero: "Україна у довгих міжнародних рядах",
    heroEmphasis: "",
    deck: "Праця, населення, ВВП, енергія, торгівля, сталь, цифровізація та клімат у регіональному порівнянні.",
    sourceUrl: "https://ourworldindata.org/",
  },
  uconomics: {
    mark: "UCO",
    source: "Uconomics 0.1",
    sourceShort: "Uconomics",
    hero: "Uconomics 0.1",
    heroEmphasis: "",
    deck: "Вісім груп статей про промисловість, послуги, державу, макроекономіку, фінанси, людей, відбудову та інституції.",
    sourceUrl: "https://ukraine.proto.fund/corner/uconomics",
  },
  frames: {
    mark: "FRAMES",
    source: "Foresight frames",
    sourceShort: "Frames",
    hero: "Кадри форсайту",
    heroEmphasis: "",
    deck: "Спільна база, шість траєкторій F1 і правила читання сценарної моделі.",
    sourceUrl: "https://ukraine.proto.fund/corner/frames",
  },
  scenarios: {
    mark: "SCEN",
    source: "Uconomics scenarios",
    sourceShort: "Scenarios",
    hero: "Сценарії Uconomics",
    heroEmphasis: "",
    deck: "П’ять канонічних сценаріїв, межі 2040 року та параметри користувацької траєкторії.",
    sourceUrl: "https://ukraine.proto.fund/corner/scenarios",
  },
  ukraine: {
    mark: "UKRAINE",
    source: "Ukraine Dataroom",
    sourceShort: "13 джерел",
    hero: "Економіка України",
    heroEmphasis: "",
    deck: "Макроекономіка, державні фінанси, банки, торгівля, праця, бюджет і промисловість.",
    sourceUrl: "https://ukraine.proto.fund",
  },
};

function detectCorner(): CornerKey {
  const pathCorner = window.location.pathname.match(/^\/corner\/([^/]+)/)?.[1];
  if (pathCorner === "uconomics" || pathCorner === "frames" || pathCorner === "scenarios") return pathCorner;
  if (pathCorner && isSourceCorner(pathCorner)) return "ukraine";
  const selected = new URLSearchParams(window.location.search).get("corner");
  if (
    selected === "nbu" ||
    selected === "stat" ||
    selected === "budget" ||
    selected === "oecd" ||
    selected === "wb" ||
    selected === "ilostat" ||
    selected === "imf" ||
    selected === "eurostat" ||
    selected === "comtrade" ||
    selected === "tradingeconomics" ||
    selected === "industrial" ||
    selected === "worldsteel" ||
    selected === "owid" ||
    selected === "uconomics" ||
    selected === "frames" ||
    selected === "scenarios" ||
    selected === "ukraine"
  ) {
    return selected;
  }
  if (
    window.location.hostname === "ukraine.osnova.ai" ||
    window.location.hostname === "ukraine.proto.fund" ||
    window.location.hostname === "dataukraine.proto.fund"
  ) return "ukraine";
  if (window.location.hostname.startsWith("nbu.")) return "nbu";
  if (window.location.hostname.startsWith("stat.")) return "stat";
  if (window.location.hostname.startsWith("ilostat.")) return "ilostat";
  if (window.location.hostname.startsWith("imf.")) return "imf";
  if (window.location.hostname.startsWith("eurostat.")) return "eurostat";
  if (window.location.hostname.startsWith("comtrade.")) return "comtrade";
  if (window.location.hostname.startsWith("tradingeconomics.")) {
    return "tradingeconomics";
  }
  if (window.location.hostname.startsWith("industrial.")) return "industrial";
  if (window.location.hostname.startsWith("worldsteel.")) return "worldsteel";
  if (window.location.hostname.startsWith("owid.")) return "owid";
  if (window.location.hostname.startsWith("uconomics.")) return "uconomics";
  if (window.location.hostname.startsWith("frames.")) return "frames";
  if (window.location.hostname.startsWith("scenarios.")) return "scenarios";
  if (window.location.hostname.startsWith("oecd.")) return "oecd";
  if (window.location.hostname.startsWith("wb.")) return "wb";
  return "ukraine";
}

const cornerKey = detectCorner();
const corner = cornerConfigs[cornerKey];

const categoryColors: Record<string, string> = {
  "Національні рахунки": "#0f5f8f",
  "Бізнес і фінанси": "#8f2f2f",
  "Ринок праці": "#b85c00",
  "Торгівля і виробництво": "#245f46",
  "Ціни і попит": "#6f4fb0",
  "Енергія та інфраструктура": "#2f3f52",
  "Населення і регіони": "#7a4f2a",
};

const isLocal =
  window.location.hostname === "127.0.0.1" ||
  window.location.hostname === "localhost";
const dataBase =
  import.meta.env.VITE_DATA_BASE_URL?.replace(/\/$/, "") ??
  (isLocal ? `/data/${cornerKey}` : "/api/data");

function dataUrl(path: string) {
  return path.startsWith("/data/")
    ? `${dataBase}${path.slice("/data".length)}`
    : path;
}

function cornerDataUrl(corner: DataCornerKey | "ukraine", path: string) {
  const cleanPath = path.replace(/^\/+/u, "");
  if (corner === "uconomics") {
    return isLocal ? `/data/uconomics/${cleanPath}` : `/uc/uconomics/${cleanPath}`;
  }
  if (corner === "frames" || corner === "scenarios") {
    return `/uc/${corner}/${cleanPath}`;
  }
  return isLocal ? `/data/${corner}/${cleanPath}` : `/api/corners/${corner}/data/${cleanPath}`;
}

function readDatasetSummary(payload: unknown): DatasetSummary {
  const candidate = payload && typeof payload === "object" && "data" in payload
    ? (payload as { data?: unknown }).data
    : payload;
  if (
    !candidate ||
    typeof candidate !== "object" ||
    !Array.isArray((candidate as { indicators?: unknown }).indicators)
  ) {
    throw new Error("Invalid dataset summary response");
  }
  return candidate as DatasetSummary;
}

function formatDate(value: string | null | undefined, locale: Locale = "uk") {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return value;
  return new Intl.DateTimeFormat(locale === "uk" ? "uk-UA" : "en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatNumber(
  value: number,
  unit = "",
  compact = false,
  locale: Locale = "uk",
) {
  if (!Number.isFinite(value)) return "—";
  const absolute = Math.abs(value);
  if (/UAH|грн/i.test(unit)) {
    if (absolute >= 1_000_000_000) {
      return `${(value / 1_000_000_000).toLocaleString(locale === "uk" ? "uk-UA" : "en-GB", {
        maximumFractionDigits: compact ? 0 : 1,
      })} ${locale === "uk" ? "млрд грн" : "bn UAH"}`;
    }
    if (absolute >= 1_000_000) {
      return `${(value / 1_000_000).toLocaleString(locale === "uk" ? "uk-UA" : "en-GB", {
        maximumFractionDigits: compact ? 0 : 1,
      })} ${locale === "uk" ? "млн грн" : "m UAH"}`;
    }
  }
  if (unit === "USD" || unit === "EUR") {
    const symbol = unit === "USD" ? "$" : "€";
    if (absolute >= 1_000_000_000) {
      return `${symbol}${(value / 1_000_000_000).toLocaleString(locale === "uk" ? "uk-UA" : "en-GB", {
        maximumFractionDigits: compact ? 1 : 2,
      })}${locale === "uk" ? " млрд" : "bn"}`;
    }
    if (absolute >= 1_000_000) {
      return `${symbol}${(value / 1_000_000).toLocaleString(locale === "uk" ? "uk-UA" : "en-GB", {
        maximumFractionDigits: compact ? 0 : 1,
      })}${locale === "uk" ? " млн" : "m"}`;
    }
  }
  if (/млн/.test(unit) && absolute >= 1_000) {
    return `${(value / 1_000).toLocaleString(locale === "uk" ? "uk-UA" : "en-GB", {
      maximumFractionDigits: compact ? 0 : 1,
    })} ${locale === "uk" ? "млрд" : "bn"}`;
  }
  const suffix = unit === "%" ? "%" : "";
  return `${value.toLocaleString(locale === "uk" ? "uk-UA" : "en-GB", {
    maximumFractionDigits: compact ? 1 : absolute < 100 ? 2 : 1,
  })}${suffix}`;
}

function formatMetric(metric: Metric, value = metric.current, compact = false) {
  if (!Number.isFinite(value)) return "—";
  if (metric.format === "percent") {
    return `${value.toLocaleString("uk-UA", {
      maximumFractionDigits: compact ? 1 : 2,
    })}%`;
  }
  if (metric.format === "uah_billion") {
    return `${(value / 1_000).toLocaleString("uk-UA", {
      maximumFractionDigits: compact ? 0 : 1,
    })} млрд`;
  }
  if (metric.format === "usd_billion") {
    const absolute = Math.abs(value);
    if (absolute >= 1_000_000_000) {
      return `$${(value / 1_000_000_000).toLocaleString("uk-UA", {
        maximumFractionDigits: compact ? 1 : 2,
      })} млрд`;
    }
    if (absolute >= 1_000_000) {
      return `$${(value / 1_000_000).toLocaleString("uk-UA", {
        maximumFractionDigits: compact ? 0 : 1,
      })} млн`;
    }
    return `$${value.toLocaleString("uk-UA", {
      maximumFractionDigits: compact ? 0 : 2,
    })}`;
  }
  const formatted = value.toLocaleString("uk-UA", {
    minimumFractionDigits: compact ? 0 : 2,
    maximumFractionDigits: compact ? 1 : 4,
  });
  return metric.unit && metric.unit !== "значення"
    ? `${formatted} ${metric.unit}`
    : formatted;
}

function formatDelta(observation: ComparisonObservation, locale: Locale = "uk") {
  const usePoints = observation.unit === "%";
  const value = usePoints ? observation.delta : observation.deltaPct;
  if (value === null) return "—";
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}${usePoints ? locale === "uk" ? " в. п." : " pp" : "%"}`;
}

function graphCode(
  source: CornerKey,
  datasetNumber: number | string,
  graphNumber: number,
) {
  const dataset = typeof datasetNumber === "number"
    ? String(datasetNumber).padStart(4, "0")
    : datasetNumber;
  return `UA-${graphPrefixes[source]}-${dataset}-G${String(graphNumber).padStart(2, "0")}`;
}

function datasetGraphCode(
  dataset: Pick<DatasetSummary | DataroomCard, "graphCodeBase" | "number">,
  source: CornerKey,
  graphNumber: number,
) {
  const base = dataset.graphCodeBase;
  return base
    ? `${base}-G${String(graphNumber).padStart(2, "0")}`
    : graphCode(source, dataset.number, graphNumber);
}

function datasetShortIdFromBase(
  graphCodeBase?: string,
  source?: CornerKey,
  number?: number,
) {
  const base = graphCodeBase ?? (source && number
    ? graphCode(source, number, 1).replace(/-G01$/u, "")
    : "");
  return base.replace(/^UA-/iu, "").toLocaleLowerCase();
}

function datasetPublicPath(
  source: CornerKey,
  dataset: Pick<DataroomCard | DatasetSummary, "number" | "graphCodeBase">,
) {
  return `/id/${datasetShortIdFromBase(dataset.graphCodeBase, source, dataset.number)}`;
}

function normalizePublicDatasetId(value: string) {
  const normalized = value.trim().replace(/^ua-/iu, "").toLocaleLowerCase();
  const legacyAlias = normalized.match(/^([a-z]+)-(\d{1,3})$/u);
  return legacyAlias
    ? `${legacyAlias[1]}-${legacyAlias[2].padStart(4, "0")}`
    : normalized;
}

function isPublicDatasetAlias(value: string) {
  return /^(?:ua-)?[a-z]+-\d{1,4}$/iu.test(value);
}

function aliasIndexUrl() {
  if (!isLocal) return "/uc/id-index.json";
  return cornerKey === "uconomics"
    ? "/data/ukraine/id-index.json"
    : dataUrl("/data/id-index.json");
}

let graphAliasIndexPromise: Promise<GraphAliasIndex> | null = null;

function loadGraphAliasIndex() {
  graphAliasIndexPromise ??= fetch(aliasIndexUrl(), {
    signal: AbortSignal.timeout(datasetRequestTimeoutMs),
  }).then((response) => {
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json() as Promise<GraphAliasIndex>;
  });
  return graphAliasIndexPromise;
}

function normalizeGraphSearchId(value: string) {
  return normalizePublicDatasetId(value.replace(/-g\d{1,3}$/iu, ""));
}

function isGraphSearchQuery(value: string) {
  return /^(?:\/id\/)?(?:ua-)?[a-z][a-z0-9]*-\d{1,4}(?:-g\d{1,3})?$/iu.test(value.trim());
}

function graphRecordToSearchHit(record: GraphAliasRecord): SearchHit {
  const source = isDataCorner(record.corner) ? record.corner : "uconomics";
  return {
    source,
    url: `/id/${record.shortId}`,
    id: record.datasetId,
    number: record.number,
    graphCodeBase: record.graphCodeBase,
    title: record.title,
    titleUa: record.titleUa,
    titleEn: record.titleEn,
    description: "",
    descriptionUa: "",
    descriptionEn: "",
  };
}

async function indexedGraphSearch(value: string) {
  if (!isGraphSearchQuery(value)) return null;
  const index = await loadGraphAliasIndex();
  return index.byShortId[normalizeGraphSearchId(value)] ?? null;
}

type SearchDataset = Pick<
  DataroomCard,
  | "id"
  | "number"
  | "graphCodeBase"
  | "title"
  | "titleUa"
  | "titleEn"
  | "category"
  | "description"
  | "descriptionUa"
  | "descriptionEn"
  | "question"
  | "indicatorTitle"
  | "tags"
  | "unit"
> & { source?: DataCornerKey };

function datasetSearchText(dataset: SearchDataset) {
  const graphBase = dataset.graphCodeBase ?? (dataset.source
    ? graphCode(dataset.source, dataset.number, 1).replace(/-G01$/u, "")
    : "");
  const graphCodeValue = graphBase ? `${graphBase}-G01` : "";
  const shortId = graphBase
    ? datasetShortIdFromBase(graphBase, dataset.source, dataset.number)
    : "";
  return [
    dataset.id,
    dataset.number,
    graphBase,
    graphCodeValue,
    shortId,
    dataset.title,
    dataset.titleUa,
    dataset.titleEn,
    dataset.category,
    dataset.description,
    dataset.descriptionUa,
    dataset.descriptionEn,
    dataset.question,
    dataset.indicatorTitle,
    dataset.unit,
    ...(dataset.tags ?? []).flatMap((tag) => [tag.id, tag.labelUa, tag.labelEn]),
  ].filter(Boolean).join(" ").toLocaleLowerCase();
}

function chartAnchor(graphCodeValue?: string) {
  return graphCodeValue?.toLocaleLowerCase().replace(/[^\w-]+/gu, "-") ?? "";
}

function localizedDatasetTitle(
  dataset: Pick<DataroomCard | DatasetSummary, "title" | "titleUa" | "titleEn">,
  locale: Locale,
) {
  const translated = (
    titleTranslations as Record<
      string,
      { uk: string; en: string; originalLanguage: "uk" | "en" }
    >
  )[dataset.title];
  return locale === "uk"
    ? dataset.titleUa ?? translated?.uk ?? dataset.title
    : dataset.titleEn ?? translated?.en ?? dataset.title;
}

function localizedDatasetDescription(
  dataset: Pick<
    DataroomCard | DatasetSummary,
    "title" | "titleUa" | "titleEn" | "description" | "descriptionUa" | "descriptionEn"
  >,
  locale: Locale,
) {
  const direct = locale === "uk" ? dataset.descriptionUa : dataset.descriptionEn;
  if (direct) return direct;
  const hasUkrainian = /[А-Яа-яІіЇїЄєҐґ]/u.test(dataset.description);
  if ((locale === "uk" && hasUkrainian) || (locale === "en" && !hasUkrainian)) {
    return dataset.description;
  }
  const title = localizedDatasetTitle(dataset, locale);
  return locale === "uk"
    ? `${title}. Опублікований ряд зберігає періоди, одиниці виміру та параметри першоджерела.`
    : `${title}. The published series retains source periods, units and parameters.`;
}

function activeSourceKey(): CornerKey {
  const source = window.location.pathname.match(/^\/corner\/([^/]+)/)?.[1];
  return source && isSourceCorner(source) ? source : cornerKey;
}

function localizedIndicatorTitle(
  dataset: DatasetSummary,
  indicator: DatasetIndicator,
  locale: Locale,
  index: number,
) {
  const hasUkrainian = /[А-Яа-яІіЇїЄєҐґ]/u.test(indicator.title);
  const nativeToLocale = locale === "uk" ? hasUkrainian : !hasUkrainian;
  if (nativeToLocale) return indicator.title;
  if (locale === "en" && indicator.titleEn) return indicator.titleEn;
  const datasetTitle = localizedDatasetTitle(dataset, locale);
  return dataset.indicators.length === 1
    ? datasetTitle
    : `${datasetTitle} · ${locale === "uk" ? "серія" : "series"} ${index + 1}`;
}

function localizedSchemaLabel(
  field: DatasetSummary["schema"][number],
  locale: Locale,
) {
  const dictionary: Record<string, { uk: string; en: string }> = {
    source: { uk: "Джерело", en: "Source" },
    indicator: { uk: "Показник", en: "Indicator" },
    country: { uk: "Країна", en: "Country" },
    countryiso3code: { uk: "Код країни ISO3", en: "Country ISO3 code" },
    date: { uk: "Дата або рік", en: "Date or year" },
    year: { uk: "Рік", en: "Year" },
    value: { uk: "Значення", en: "Value" },
    unit: { uk: "Одиниця виміру", en: "Unit" },
    obs_status: { uk: "Статус спостереження", en: "Observation status" },
    decimal: { uk: "Кількість десяткових знаків", en: "Decimal places" },
    TIME_PERIOD: { uk: "Період", en: "Period" },
    OBS_VALUE: { uk: "Значення", en: "Value" },
    FREQ: { uk: "Частота", en: "Frequency" },
    REF_AREA: { uk: "Територія", en: "Reference area" },
    INDICATOR: { uk: "Код показника", en: "Indicator code" },
  };
  if (dictionary[field.field]) return dictionary[field.field][locale];
  const hasUkrainian = /[А-Яа-яІіЇїЄєҐґ]/u.test(field.label);
  if ((locale === "uk" && hasUkrainian) || (locale === "en" && !hasUkrainian)) {
    return field.label;
  }
  return locale === "uk" ? `Параметр ${field.field}` : `Source parameter ${field.field}`;
}

const cornerMenuTitles: Record<SourceCornerKey, { uk: string; en: string }> = {
  nbu: { uk: "Національний банк України", en: "National Bank of Ukraine" },
  stat: { uk: "Державна статистика", en: "State Statistics Service" },
  budget: { uk: "Державний і місцеві бюджети", en: "National and local budgets" },
  oecd: { uk: "OECD: Україна", en: "OECD: Ukraine" },
  wb: { uk: "Світовий банк: Україна", en: "World Bank: Ukraine" },
  ilostat: { uk: "ILOSTAT: ринок праці", en: "ILOSTAT: labour market" },
  imf: { uk: "IMF: макроекономіка", en: "IMF: macroeconomy" },
  eurostat: { uk: "Eurostat: Україна та Європа", en: "Eurostat: Ukraine and Europe" },
  comtrade: { uk: "UN Comtrade: зовнішня торгівля", en: "UN Comtrade: foreign trade" },
  tradingeconomics: { uk: "Trading Economics", en: "Trading Economics" },
  industrial: { uk: "RI: промисловість України", en: "RI: Ukraine industry" },
  worldsteel: { uk: "Worldsteel: виробництво сталі", en: "Worldsteel: steel production" },
  owid: { uk: "Our World in Data: порівняння", en: "Our World in Data: comparisons" },
};

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="10.5" cy="10.5" r="6.25" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="m15.3 15.3 4.45 4.45" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}

function ThemeIcon({ theme }: { theme: Theme }) {
  return theme === "day" ? (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20.2 14.2A8.6 8.6 0 0 1 9.8 3.8a9.4 9.4 0 1 0 10.4 10.4Z" fill="currentColor" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="4" fill="currentColor" />
      <path d="M12 2v3m0 14v3M4.93 4.93l2.12 2.12m9.9 9.9 2.12 2.12M2 12h3m14 0h3M4.93 19.07l2.12-2.12m9.9-9.9 2.12-2.12" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
    </svg>
  );
}

function MenuIcon({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {open ? (
        <path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
      ) : (
        <path d="M4 7h16M4 12h16M4 17h16" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
      )}
    </svg>
  );
}

type SearchHit = Pick<
  DataroomCard,
  | "id"
  | "number"
  | "graphCodeBase"
  | "title"
  | "titleUa"
  | "titleEn"
  | "description"
  | "descriptionUa"
  | "descriptionEn"
> & { source: DataCornerKey; url: string };

function OverlayCloseEffects({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const originalOverflow = document.body.style.overflow;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose, open]);
  return null;
}

function DataroomSearch({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { locale } = useSettings();
  const ua = locale === "uk";
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query.trim());
  const [results, setResults] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const searchAlias = (value: string) => {
    const aliases: Array<[RegExp, string]> = [
      [/безробіт[а-яіїєґ']*/giu, "unemployment"],
      [/ввп/giu, "gdp"],
      [/інфляц[а-яіїєґ']*/giu, "inflation"],
      [/зарплат[а-яіїєґ']*/giu, "wage"],
      [/зайнят[а-яіїєґ']*/giu, "employment"],
      [/населен[а-яіїєґ']*/giu, "population"],
      [/експорт[а-яіїєґ']*/giu, "exports"],
      [/імпорт[а-яіїєґ']*/giu, "imports"],
      [/борг[а-яіїєґ']*/giu, "debt"],
      [/енерг[а-яіїєґ']*/giu, "energy"],
      [/промислов[а-яіїєґ']*/giu, "industry"],
      [/сільськ[а-яіїєґ']*\s+господар[а-яіїєґ']*/giu, "agriculture"],
    ];
    return aliases.reduce(
      (queryValue, [pattern, replacement]) => queryValue.replace(pattern, replacement),
      value,
    );
  };

  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
      return;
    }
    const timer = window.setTimeout(() => inputRef.current?.focus(), 100);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open || deferredQuery.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const indexedRecord = await indexedGraphSearch(deferredQuery);
        if (indexedRecord) {
          if (!cancelled) setResults([graphRecordToSearchHit(indexedRecord)]);
          return;
        }
        const apiQuery = searchAlias(deferredQuery);
        const responses = await Promise.all(dataCornerOrder.map(async (source) => {
          try {
            const response = isStaticCorner(source)
              ? await fetch(cornerDataUrl(source, "dataroom/manifest.json"))
              : await fetch(
                `/api/v1/ukraine/corners/${source}/datasets?limit=4&offset=0&q=${encodeURIComponent(apiQuery)}`,
              );
            if (!response.ok) return [];
            const payload = await response.json();
            const sourceDatasets = isStaticCorner(source)
              ? (payload.datasets as DataroomCard[])
              : (payload.data as DataroomCard[]);
            return sourceDatasets.map((dataset) => ({
              source,
              url: datasetPublicPath(source, dataset),
              id: dataset.id,
              number: dataset.number,
              graphCodeBase: dataset.graphCodeBase,
              title: dataset.title,
              titleUa: dataset.titleUa,
              titleEn: dataset.titleEn,
              description: dataset.description,
              descriptionUa: dataset.descriptionUa,
              descriptionEn: dataset.descriptionEn,
            }));
          } catch {
            return [];
          }
        }));
        if (!cancelled) setResults(responses.flat().slice(0, 32));
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 220);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [deferredQuery, open]);

  if (!open) return null;

  return (
    <div className="portal-overlay search-overlay" role="dialog" aria-modal="true" aria-label={ua ? "Пошук даних" : "Search data"}>
      <OverlayCloseEffects open={open} onClose={onClose} />
      <button className="portal-overlay-dismiss" type="button" onClick={onClose} aria-label={ua ? "Закрити пошук" : "Close search"} />
      <div className="search-overlay-panel">
        <div className="search-overlay-header">
          <a href="https://ukraine.proto.fund" className="brand" aria-label={ua ? "Економіка України" : "Ukraine economy"}>
            <img className="brand-logo" src={dataUkraineLogoUrl} alt="" />
          </a>
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={ua ? "Набір, показник, код графіка або джерело" : "Dataset, indicator, graph code or source"}
            aria-label={ua ? "Пошуковий запит" : "Search query"}
          />
          <button className="header-icon-button" type="button" onClick={onClose} aria-label={ua ? "Закрити" : "Close"}>
            <MenuIcon open />
          </button>
        </div>
        <div className="search-results">
          {deferredQuery.length < 2 ? (
            <p>{ua ? "Введіть щонайменше два символи. Пошук охоплює всі 14 куточків." : "Enter at least two characters. Search covers all 14 corners."}</p>
          ) : loading ? (
            <p>{ua ? "Шукаємо в каталогах…" : "Searching catalogues…"}</p>
          ) : results.length ? (
            results.map((dataset) => (
              <a href={dataset.url} key={`${dataset.source}-${dataset.id}`} onClick={onClose}>
                <span>{dataset.graphCodeBase ?? `${cornerConfigs[dataset.source].mark} · ${dataset.id}`}</span>
                <strong>{localizedDatasetTitle(dataset, locale)}</strong>
                <p>{localizedDatasetDescription(dataset, locale)}</p>
              </a>
            ))
          ) : (
            <p>{ua ? "Збігів не знайдено. Спробуйте іншу назву або код." : "No matches. Try another title or code."}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function DataroomMenu({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { locale } = useSettings();
  const ua = locale === "uk";
  if (!open) return null;
  return (
    <div className="portal-overlay menu-overlay" role="dialog" aria-modal="true" aria-label={ua ? "Меню" : "Menu"}>
      <OverlayCloseEffects open={open} onClose={onClose} />
      <button className="portal-overlay-dismiss" type="button" onClick={onClose} aria-label={ua ? "Закрити меню" : "Close menu"} />
      <aside className="menu-overlay-panel">
        <header>
          <div>
            <strong>{ua ? "Джерела даних" : "Data sources"}</strong>
            <span>{dataCornerOrder.length}</span>
          </div>
          <button className="header-icon-button" type="button" onClick={onClose} aria-label={ua ? "Закрити" : "Close"}>
            <MenuIcon open />
          </button>
        </header>
        <nav aria-label={ua ? "Джерела даних" : "Data sources"}>
          {sourceCornerOrder.map((source, index) => (
            <a href={`/corner/${source}`} key={source} onClick={onClose}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{cornerMenuTitles[source][locale]}</strong>
              <code>{graphPrefixes[source]}</code>
            </a>
          ))}
        </nav>
        <footer>
          <a href="/corner/uconomics" onClick={onClose}>
            <span>{String(sourceCornerOrder.length + 1).padStart(2, "0")}</span>
            <strong>Uconomics 0.1</strong>
            <code>UCO</code>
          </a>
          <a href="/corner/frames" onClick={onClose}>
            <span>{String(sourceCornerOrder.length + 2).padStart(2, "0")}</span>
            <strong>{ua ? "Кадри" : "Frames"}</strong>
            <code>GATE 1</code>
          </a>
          <a href="/corner/scenarios" onClick={onClose}>
            <span>{String(sourceCornerOrder.length + 3).padStart(2, "0")}</span>
            <strong>{ua ? "Сценарії" : "Scenarios"}</strong>
            <code>GATE 2</code>
          </a>
          <a href="/magazine" onClick={onClose}>
            <span>{String(sourceCornerOrder.length + 4).padStart(2, "0")}</span>
            <strong>{ua ? "Журнал" : "Magazine"}</strong>
          </a>
          <a href="/developers" onClick={onClose}>
            <span>{String(sourceCornerOrder.length + 5).padStart(2, "0")}</span>
            <strong>API</strong>
          </a>
        </footer>
      </aside>
    </div>
  );
}

function Masthead({ generatedAt }: { generatedAt?: string }) {
  const { locale, setLocale, theme, setTheme } = useSettings();
  const ua = locale === "uk";
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <>
      <header className="masthead" data-generated-at={generatedAt}>
        <a
          className="brand"
          href="https://ukraine.proto.fund"
          aria-label={ua ? "Економіка України" : "Ukraine economy"}
        >
          <img className="brand-logo" src={dataUkraineLogoUrl} alt="" />
        </a>
        <div className="header-controls" aria-label={ua ? "Пошук і налаштування" : "Search and settings"}>
        <button
          className="header-icon-button"
          type="button"
          onClick={() => {
            setMenuOpen(false);
            setSearchOpen(true);
          }}
          aria-label={ua ? "Пошук" : "Search"}
          aria-pressed={searchOpen}
        >
          <SearchIcon />
        </button>
        <button
          className="header-icon-button"
          type="button"
          onClick={() => setLocale(ua ? "en" : "uk")}
          aria-label={ua ? "Switch to English" : "Перемкнути українською"}
        >
          {ua ? "EN" : "UA"}
        </button>
        <button
          className="header-icon-button"
          type="button"
          onClick={() => setTheme(theme === "day" ? "night" : "day")}
          aria-label={ua ? "Змінити тему" : "Switch theme"}
        >
          <ThemeIcon theme={theme} />
        </button>
        <button
          className="header-icon-button"
          type="button"
          onClick={() => {
            setSearchOpen(false);
            setMenuOpen((current) => !current);
          }}
          aria-label={menuOpen ? (ua ? "Закрити меню" : "Close menu") : (ua ? "Відкрити меню" : "Open menu")}
          aria-pressed={menuOpen}
        >
          <MenuIcon open={menuOpen} />
        </button>
      </div>
      </header>
      <DataroomSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
      <DataroomMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
    </>
  );
}

function PageState({
  title,
  detail,
}: {
  title: string;
  detail?: string;
}) {
  return (
    <main className="state-page">
      <h1>{title}</h1>
      {detail && <p>{detail}</p>}
    </main>
  );
}

function MetricCard({ metric, index }: { metric: Metric; index: number }) {
  const delta =
    metric.currentPartial
      ? "YTD · попереднє"
      : metric.deltaAbs === null
      ? "нова серія"
      : metric.format === "percent"
        ? `${metric.deltaAbs > 0 ? "+" : ""}${metric.deltaAbs.toFixed(
            Math.abs(metric.deltaAbs) < 0.01 && metric.deltaAbs !== 0 ? 3 : 2,
          )} п.п.`
        : `${(metric.deltaPct ?? 0) > 0 ? "+" : ""}${(
            metric.deltaPct ?? 0
          ).toFixed(Math.abs(metric.deltaPct ?? 0) < 0.1 ? 2 : 1)}%`;
  const tone =
    metric.currentPartial ||
    metric.deltaAbs === null ||
    Math.abs(metric.deltaAbs) < 0.0001
      ? "neutral"
      : metric.deltaAbs > 0
        ? "up"
        : "down";

  return (
    <a
      className="metric-card reveal"
      style={{ "--delay": `${index * 50}ms` } as React.CSSProperties}
      href={`#chart-${metric.id}`}
    >
      <div className="metric-card-topline">
        <span>{metric.shortTitle}</span>
        <span className="metric-arrow" aria-hidden="true">
          {metric.currentPartial
            ? "•"
            : metric.deltaAbs === null
              ? "→"
              : metric.deltaAbs > 0
                ? "↗"
                : "↘"}
        </span>
      </div>
      <strong>{formatMetric(metric)}</strong>
      <div className="metric-card-footer">
        <span className={`delta delta-${tone}`}>{delta}</span>
        <span>
          {metric.currentPartial ? "не фінал року" : metric.comparisonLabel}
        </span>
      </div>
    </a>
  );
}

function SignalRow({ signal }: { signal: Signal }) {
  return (
    <article className={`signal-row signal-${signal.level}`}>
      <span className="signal-level">{signal.label}</span>
      <div>
        <h3>{signal.title}</h3>
        <p>{signal.body}</p>
      </div>
      <strong>{signal.value}</strong>
    </article>
  );
}

function CatalogueFactPreview({
  facts,
  locale,
}: {
  facts: DatasetFact[];
  locale: Locale;
}) {
  const fact = facts[0];
  const period = fact?.period && fact.period !== "scenario" ? fact.period : null;
  return (
    <div className="dataset-card-fact-preview">
      <span>{fact?.label ?? (locale === "uk" ? "Факти" : "Facts")}</span>
      <strong>{fact?.value ?? "—"}</strong>
      <small>
        {[period, fact?.unit, fact?.status].filter(Boolean).join(" · ") ||
          (locale === "uk" ? "Текстовий вихід" : "Text output")}
      </small>
    </div>
  );
}

function DatasetCard({ dataset }: { dataset: DataroomCard }) {
  const { locale } = useSettings();
  const ua = locale === "uk";
  const color = categoryColors[dataset.category] ?? "#0057b8";
  return (
    <a className="dataset-card" href={dataset.url}>
      <div className="dataset-card-top">
        <span>{String(dataset.number).padStart(2, "0")}</span>
        <div>
          {dataset.regional.available && (
            <span className="regional-label">
              {dataset.regional.regionCount} {ua ? "регіонів" : "regions"}
            </span>
          )}
          <span className={`live-label${dataset.presentation === "facts" ? " facts-label" : ""}`}>
            {dataset.presentation === "facts" ? ua ? "факти" : "facts" : "live"}
          </span>
        </div>
      </div>
      <div>
        <small>{dataset.category}</small>
        <h3>{localizedDatasetTitle(dataset, locale)}</h3>
        <div className="dataset-card-tags" aria-label={ua ? "Теги набору" : "Dataset tags"}>
          {(dataset.tags ?? []).slice(0, 4).map((tag) => (
            <span key={tag.id}>{ua ? tag.labelUa : tag.labelEn}</span>
          ))}
        </div>
      </div>
      {dataset.presentation === "facts" ? (
        <CatalogueFactPreview facts={dataset.fallbackFacts ?? []} locale={locale} />
      ) : (
        <MiniChart data={dataset.sparkline} color={color} />
      )}
      <div className="dataset-card-reading">
        <div>
          <span>
            {dataset.presentation === "facts"
              ? `${dataset.fallbackFacts?.length ?? 0} ${ua ? "фактів" : "facts"}`
              : dataset.indicatorTitle}
          </span>
          <strong>
            {dataset.presentation === "facts"
              ? ua ? "читати факти" : "read facts"
              : dataset.value === null
              ? ua ? "дивитися зріз" : "open view"
              : formatNumber(dataset.value, dataset.unit, false, locale)}
          </strong>
        </div>
        <span className="dataset-open">→</span>
      </div>
      <p>{localizedDatasetDescription(dataset, locale)}</p>
      <footer>
        <span>{dataset.rowCount.toLocaleString(ua ? "uk-UA" : "en-GB")} {ua ? "рядків" : "rows"}</span>
        <span>{dataset.fieldCount} {ua ? "полів" : "fields"}</span>
        <span>{dataset.frequency}</span>
      </footer>
    </a>
  );
}

function ReportCard({ report }: { report: ReportManifestItem }) {
  const lead = report.lead;
  return (
    <a className={`report-card report-${lead?.level ?? "stable"}`} href={report.url}>
      <span className="report-card-kicker">{report.kicker}</span>
      <h3>{report.title}</h3>
      <p>{report.deck}</p>
      <div>
        <span>{lead?.label ?? "Немає нового зіставного руху"}</span>
        <strong>{lead ? formatDelta(lead) : "—"}</strong>
      </div>
    </a>
  );
}

type UniversalCorner = {
  id: string;
  name: string;
  title: string;
  titleEn?: string;
  url: string;
  role: string;
  roleEn?: string;
  description: string;
  descriptionEn?: string;
  datasetCount: number;
  deferredCount: number;
  factOnlyCount?: number;
  observationCount: number;
  coverageStart: string | null;
  latestDate: string | null;
  categories: string[];
};

type UniversalData = {
  meta: {
    generatedAt: string;
    title: string;
    titleUa?: string;
    titleEn?: string;
    descriptionUa?: string;
    descriptionEn?: string;
    cornerCount: number;
    datasetCount: number;
    observationCount: number;
    comparisonCount: number;
  };
  corners: UniversalCorner[];
  comparisons: Array<{
    id: string;
    title: string;
    unit: string;
    sources: Array<{
      corner: string;
      code: string;
      role: string;
    }>;
    caveat: string;
  }>;
  forecasts: Array<{
    corner: string;
    label: string;
    labelUa?: string;
    color: string;
    unit: string;
    sourceUrl: string;
    note: string;
    releaseDate?: string | null;
    points: Array<{
      date: string;
      year: number;
      value: number;
      forecast?: boolean;
    }>;
  }>;
  frames: Array<{
    year: number;
    status: "historical" | "forecast";
    source: string;
    sourceUrl: string;
    narrative: { ua: string; en: string };
    metrics: Array<{
      id: string;
      title: string;
      titleEn: string;
      unit: string;
      value: number | null;
      forecast: boolean;
      sourceCode: string;
    }>;
  }>;
  forecastHorizon: {
    startYear: number;
    endYear: number;
    metric: string;
    title: string;
    titleEn: string;
    description: string;
    descriptionEn: string;
    years: Array<{
      year: number;
      status: "published" | "not-published";
      values: Array<{
        corner: string;
        label: string;
        value: number;
        unit: string;
      }>;
    }>;
  };
  report: {
    headlineUa: string;
    headlineEn: string;
    highlights: Record<
      "annual" | "monthly" | "weeklyOrDaily",
      | {
          source: string;
          period: string;
          title: string;
          brief: string;
          url: string;
          lead: {
            label: string;
            current: number;
            delta: number;
            deltaPct: number | null;
            unit: string;
          };
        }
      | null
    >;
    json: string;
    markdown: string;
  };
};

type DatasetFacet = {
  value: string;
  count: number;
};

type DatasetTagFacet = DatasetTag & {
  count: number;
};

type DatasetFacets = {
  categories: DatasetFacet[];
  frequencies: DatasetFacet[];
  coverage: DatasetFacet[];
  tags: DatasetTagFacet[];
  regionalCount: number;
  buckets: DatasetFacet[];
  lineage: DatasetFacet[];
};

type CatalogueFilters = {
  category: string;
  frequency: string;
  coverage: string;
  tags: string[];
  regional: boolean;
  bucket: string;
  lineage: string;
};

const emptyCatalogueFilters: CatalogueFilters = {
  category: "",
  frequency: "",
  coverage: "",
  tags: [],
  regional: false,
  bucket: "",
  lineage: "",
};

function datasetCoverageBand(dataset: { coverageStart: string }) {
  const year = Number(
    String(dataset.coverageStart ?? "").match(/\b(19\d{2}|20\d{2})\b/u)?.[1],
  );
  if (!year) return "unknown";
  if (year < 2000) return "pre-2000";
  if (year < 2020) return "2000-2019";
  return "2020-plus";
}

function countFacet(
  datasets: DataroomCard[],
  valueFor: (dataset: DataroomCard) => string | null | undefined,
) {
  const counts = new Map<string, number>();
  datasets.forEach((dataset) => {
    const value = valueFor(dataset);
    if (value) counts.set(value, (counts.get(value) ?? 0) + 1);
  });
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((left, right) =>
      right.count - left.count || left.value.localeCompare(right.value),
    );
}

function facetsFromDatasets(datasets: DataroomCard[]): DatasetFacets {
  return {
    categories: countFacet(datasets, (dataset) => dataset.category),
    frequencies: countFacet(datasets, (dataset) => dataset.frequency),
    coverage: countFacet(datasets, datasetCoverageBand),
    tags: tagFacetsFromDatasets(datasets),
    regionalCount: datasets.filter((dataset) => dataset.regional.available).length,
    buckets: countFacet(datasets, (dataset) => dataset.lineage?.bucket),
    lineage: countFacet(datasets, (dataset) => dataset.lineage?.mode),
  };
}

function tagFacetsFromDatasets(datasets: DataroomCard[]): DatasetTagFacet[] {
  const counts = new Map<string, DatasetTagFacet>();
  datasets.forEach((dataset) => {
    dataset.tags?.forEach((tag) => {
      const current = counts.get(tag.id);
      counts.set(tag.id, current
        ? { ...current, count: current.count + 1 }
        : { ...tag, count: 1 });
    });
  });
  return [...counts.values()].sort((left, right) =>
    right.count - left.count || left.labelUa.localeCompare(right.labelUa),
  );
}

function filterLabel(source: DataCornerKey, locale: Locale) {
  const labels: Record<DataCornerKey, [string, string]> = {
    nbu: ["Тема НБУ", "NBU topic"],
    stat: ["Тема статистики", "Statistical topic"],
    budget: ["Напрям бюджету", "Budget area"],
    oecd: ["Тема OECD", "OECD topic"],
    wb: ["Тема розвитку", "Development topic"],
    ilostat: ["Тема ринку праці", "Labour topic"],
    imf: ["Група даних МВФ", "IMF data family"],
    eurostat: ["Тема Eurostat", "Eurostat theme"],
    comtrade: ["Розділ товарів", "Commodity section"],
    tradingeconomics: ["Група індикаторів", "Indicator group"],
    industrial: ["Домен RI", "RI domain"],
    worldsteel: ["Період виробництва", "Production period"],
    owid: ["Тема порівняння", "Comparison topic"],
    uconomics: ["Група статей", "Article suite"],
    frames: ["Тип кадру", "Frame type"],
    scenarios: ["Тип сценарію", "Scenario type"],
  };
  return labels[source][locale === "uk" ? 0 : 1];
}

function compactCount(value: number, locale: Locale = "uk") {
  return new Intl.NumberFormat(locale === "uk" ? "uk-UA" : "en-GB", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

type TaggableDataset = {
  title: string;
  category: string;
  frequency: string;
  coverageStart: string;
  priority?: "hero" | "top" | "deep";
  presentation?: "chart" | "facts";
  indicatorTitle?: string;
  description?: string;
  regional?: { available: boolean };
  regionalPerspective?: { available: boolean };
  lineage?: DatasetLineage | null;
  tags?: DatasetTag[];
};

const categoryTagTranslations: Record<string, [string, string]> = {
  "Національні рахунки": ["Національні рахунки", "National accounts"],
  "Бізнес і фінанси": ["Бізнес і фінанси", "Business and finance"],
  "Ринок праці": ["Ринок праці", "Labour market"],
  "Торгівля і виробництво": ["Торгівля і виробництво", "Trade and production"],
  "Ціни і попит": ["Ціни і попит", "Prices and demand"],
  "Енергія та інфраструктура": ["Енергія та інфраструктура", "Energy and infrastructure"],
  "Населення і регіони": ["Населення і регіони", "Population and regions"],
  "Ринки та борг": ["Ринки та борг", "Markets and debt"],
  "Монетарна політика": ["Монетарна політика", "Monetary policy"],
  "Банківський сектор": ["Банківський сектор", "Banking sector"],
  "Зовнішній сектор": ["Зовнішній сектор", "External sector"],
  "Державні фінанси": ["Державні фінанси", "Public finance"],
  "Інвестиції": ["Інвестиції", "Investment"],
};

const fixedDatasetTags: Record<string, DatasetTag> = {
  "geography:ukraine": { id: "geography:ukraine", labelUa: "Україна", labelEn: "Ukraine" },
  "geography:regional": { id: "geography:regional", labelUa: "Регіональні дані", labelEn: "Regional data" },
  "format:series": { id: "format:series", labelUa: "Часовий ряд", labelEn: "Time series" },
  "format:facts": { id: "format:facts", labelUa: "Факти", labelEn: "Facts" },
  "history:pre-2000": { id: "history:pre-2000", labelUa: "Історія до 2000", labelEn: "History before 2000" },
  "history:2000-2019": { id: "history:2000-2019", labelUa: "Історія 2000–2019", labelEn: "History 2000–2019" },
  "history:2020-plus": { id: "history:2020-plus", labelUa: "Дані з 2020", labelEn: "Data from 2020" },
  "history:unknown": { id: "history:unknown", labelUa: "Початок не визначено", labelEn: "Start not specified" },
  "cadence:annual": { id: "cadence:annual", labelUa: "Річні дані", labelEn: "Annual data" },
  "cadence:quarterly": { id: "cadence:quarterly", labelUa: "Квартальні дані", labelEn: "Quarterly data" },
  "cadence:monthly": { id: "cadence:monthly", labelUa: "Місячні дані", labelEn: "Monthly data" },
  "cadence:weekly": { id: "cadence:weekly", labelUa: "Тижневі дані", labelEn: "Weekly data" },
  "cadence:daily": { id: "cadence:daily", labelUa: "Щоденні дані", labelEn: "Daily data" },
  "cadence:mixed": { id: "cadence:mixed", labelUa: "Змішана періодичність", labelEn: "Mixed frequency" },
  "priority:hero": { id: "priority:hero", labelUa: "Головний показник", labelEn: "Headline indicator" },
  "priority:top": { id: "priority:top", labelUa: "Пріоритетний показник", labelEn: "Priority indicator" },
  "priority:deep": { id: "priority:deep", labelUa: "Детальний ряд", labelEn: "Detailed series" },
  "lineage:native": { id: "lineage:native", labelUa: "Нативні дані", labelEn: "Native data" },
  "lineage:connected": { id: "lineage:connected", labelUa: "Пов’язані дані", labelEn: "Connected data" },
  "subject:macro": { id: "subject:macro", labelUa: "Макроекономіка", labelEn: "Macroeconomics" },
  "subject:labour": { id: "subject:labour", labelUa: "Праця та зайнятість", labelEn: "Labour and employment" },
  "subject:banking": { id: "subject:banking", labelUa: "Банки та кредити", labelEn: "Banking and credit" },
  "subject:public-finance": { id: "subject:public-finance", labelUa: "Державні фінанси", labelEn: "Public finance" },
  "subject:trade": { id: "subject:trade", labelUa: "Торгівля", labelEn: "Trade" },
  "subject:industry": { id: "subject:industry", labelUa: "Промисловість", labelEn: "Industry" },
  "subject:energy": { id: "subject:energy", labelUa: "Енергетика", labelEn: "Energy" },
  "subject:investment": { id: "subject:investment", labelUa: "Інвестиції", labelEn: "Investment" },
  "subject:people": { id: "subject:people", labelUa: "Люди та населення", labelEn: "People and population" },
  "subject:prices": { id: "subject:prices", labelUa: "Ціни", labelEn: "Prices" },
  "subject:debt": { id: "subject:debt", labelUa: "Борг", labelEn: "Debt" },
  "subject:external": { id: "subject:external", labelUa: "Зовнішній сектор", labelEn: "External sector" },
  "subject:money": { id: "subject:money", labelUa: "Грошова система", labelEn: "Money" },
};

function tagSlug(value: string) {
  return value
    .trim()
    .toLocaleLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/gu, "") || "other";
}

function cadenceTag(frequency: string) {
  const value = frequency.toLocaleLowerCase();
  if (/дн|day/u.test(value)) return "daily";
  if (/тиж|week/u.test(value)) return "weekly";
  if (/міся|month/u.test(value)) return "monthly";
  if (/кварт|quarter/u.test(value)) return "quarterly";
  if (/річ|year|annual/u.test(value)) return "annual";
  return "mixed";
}

function datasetTagDefinitions(dataset: TaggableDataset, source?: DataCornerKey): DatasetTag[] {
  const tags: DatasetTag[] = [];
  const seen = new Set<string>();
  const add = (tag: DatasetTag) => {
    if (!seen.has(tag.id)) {
      seen.add(tag.id);
      tags.push(tag);
    }
  };

  dataset.tags?.forEach(add);
  if (source) {
    const sourceLabel = cornerConfigs[source].sourceShort;
    add({ id: `corner:${source}`, labelUa: sourceLabel, labelEn: sourceLabel });
  }
  const categoryLabels = categoryTagTranslations[dataset.category] ?? [dataset.category, dataset.category];
  add({
    id: `topic:${tagSlug(dataset.category)}`,
    labelUa: `Тема · ${categoryLabels[0]}`,
    labelEn: `Topic · ${categoryLabels[1]}`,
  });
  add(fixedDatasetTags[`cadence:${cadenceTag(dataset.frequency)}`]);
  add(fixedDatasetTags[`history:${datasetCoverageBand(dataset)}`]);
  const regionalAvailable = dataset.regional?.available ?? dataset.regionalPerspective?.available ?? false;
  add(fixedDatasetTags[regionalAvailable ? "geography:regional" : "geography:ukraine"]);
  add(fixedDatasetTags[dataset.presentation === "facts" ? "format:facts" : "format:series"]);
  if (dataset.priority) add(fixedDatasetTags[`priority:${dataset.priority}`]);
  if (dataset.lineage?.mode) add(fixedDatasetTags[`lineage:${dataset.lineage.mode}`]);

  const searchable = [dataset.title, dataset.category, dataset.indicatorTitle, dataset.description]
    .filter(Boolean)
    .join(" ");
  const subjectRules: Array<[string, RegExp]> = [
    ["subject:labour", /прац|зайнят|безроб|зарплат|труд|labour|employment|unemployment|wage/iu],
    ["subject:banking", /банк|кредит|депозит|bank|credit|deposit/iu],
    ["subject:public-finance", /бюджет|подат|державн|видат|fiscal|budget|tax|government/iu],
    ["subject:trade", /торг|експорт|імпорт|trade|export|import/iu],
    ["subject:industry", /промис|виробниц|сталь|метал|steel|industry|production/iu],
    ["subject:energy", /енерг|електр|газ|нафт|energy|electric|gas|oil/iu],
    ["subject:investment", /інвест|капітал|investment|capital/iu],
    ["subject:people", /населен|домогосп|люд|population|household|people/iu],
    ["subject:prices", /цін|інфляц|price|inflation/iu],
    ["subject:debt", /борг|заборг|debt/iu],
    ["subject:external", /платіжн|резерв|зовнішн|balance of payments|reserve|external/iu],
    ["subject:money", /грош|монетар|курс|money|monetary|exchange rate/iu],
    ["subject:macro", /ввп|макро|економ|gdp|macro|econom/iu],
  ];
  subjectRules.forEach(([id, pattern]) => {
    if (pattern.test(searchable)) add(fixedDatasetTags[id]);
  });
  return tags;
}

function withDatasetTags<T extends DataroomCard>(dataset: T, source: DataCornerKey): T {
  return { ...dataset, tags: datasetTagDefinitions(dataset, source) };
}

type CatalogueDataset = DataroomCard & { source: DataCornerKey };

async function fetchCatalogueSource(source: DataCornerKey): Promise<CatalogueDataset[]> {
  if (isLocal || isStaticCorner(source)) {
    const response = await fetch(cornerDataUrl(source, "dataroom/manifest.json"));
    if (!response.ok) throw new Error(`${source} HTTP ${response.status}`);
    const manifest = await response.json() as DataroomManifest;
    return manifest.datasets.map((dataset) => ({
      ...withDatasetTags(dataset, source),
      source,
      url: datasetPublicPath(source, dataset),
    }));
  }
  const pageSize = 200;
  const collected: DataroomCard[] = [];
  let offset = 0;
  let total = Number.POSITIVE_INFINITY;
  while (offset < total) {
    const response = await fetch(
      `/api/v1/ukraine/corners/${source}/datasets?limit=${pageSize}&offset=${offset}`,
      { cache: "no-store" },
    );
    if (!response.ok) throw new Error(`${source} HTTP ${response.status}`);
    const payload = await response.json() as {
      data: DataroomCard[];
      meta?: { total?: number };
    };
    const page = payload.data ?? [];
    collected.push(...page);
    const reportedTotal = Number(payload.meta?.total);
    if (Number.isFinite(reportedTotal)) total = reportedTotal;
    if (page.length === 0) break;
    offset += page.length;
    if (!Number.isFinite(reportedTotal) && page.length < pageSize) break;
  }
  return collected.map((dataset) => ({
    ...withDatasetTags(dataset, source),
    source,
    url: datasetPublicPath(source, dataset),
  }));
}

function compareCatalogueDatasets(
  left: CatalogueDataset,
  right: CatalogueDataset,
  order: "corner" | "latest" | "coverage" | "title" | "size",
  locale: Locale,
) {
  if (order === "latest") {
    return String(right.latestDate).localeCompare(String(left.latestDate)) || left.number - right.number;
  }
  if (order === "coverage") {
    return String(left.coverageStart).localeCompare(String(right.coverageStart)) || left.number - right.number;
  }
  if (order === "title") {
    return localizedDatasetTitle(left, locale).localeCompare(localizedDatasetTitle(right, locale), locale === "uk" ? "uk" : "en") || left.number - right.number;
  }
  if (order === "size") {
    return right.rowCount - left.rowCount || left.number - right.number;
  }
  return dataCornerOrder.indexOf(left.source) - dataCornerOrder.indexOf(right.source) || left.number - right.number;
}

function UniversalHomePage() {
  const { locale } = useSettings();
  const ua = locale === "uk";
  const [datasets, setDatasets] = useState<CatalogueDataset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [tagFilters, setTagFilters] = useState<string[]>([]);
  const [tagSearch, setTagSearch] = useState("");
  const [openFilterPanel, setOpenFilterPanel] = useState<"corner" | "topic" | "tags" | null>(null);
  const [sortOrder, setSortOrder] = useState<"corner" | "latest" | "coverage" | "title" | "size">("corner");
  const [visibleCount, setVisibleCount] = useState(72);
  const deferredSearch = useDeferredValue(search.trim().toLocaleLowerCase());
  const deferredTagSearch = useDeferredValue(tagSearch.trim().toLocaleLowerCase());

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.allSettled(dataCornerOrder.map((source) => fetchCatalogueSource(source)))
      .then((results) => {
        if (cancelled) return;
        const loaded = results.flatMap((result) => result.status === "fulfilled" ? result.value : []);
        if (!loaded.length) {
          const failed = results.find((result) => result.status === "rejected");
          throw new Error(failed?.status === "rejected" ? failed.reason.message : "No catalogue data");
        }
        setDatasets(loaded.sort((left, right) =>
          dataCornerOrder.indexOf(left.source) - dataCornerOrder.indexOf(right.source) ||
          left.number - right.number,
        ));
      })
      .catch((loadError: Error) => !cancelled && setError(loadError.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const facets = facetsFromDatasets(datasets);
  const sourceFacets = dataCornerOrder.map((source) => ({
    value: source,
    count: datasets.filter((dataset) => dataset.source === source).length,
  }));
  const filteredDatasets = datasets.filter((dataset) => {
    const matchesSearch = !deferredSearch || datasetSearchText(dataset).includes(deferredSearch);
    return matchesSearch &&
      (!sourceFilter || dataset.source === sourceFilter) &&
      (!categoryFilter || dataset.category === categoryFilter) &&
      tagFilters.every((tagId) => (dataset.tags ?? []).some((tag) => tag.id === tagId));
  });
  const visibleTagFacets = facets.tags.filter((facet) =>
    !deferredTagSearch || `${facet.labelUa} ${facet.labelEn}`.toLocaleLowerCase().includes(deferredTagSearch),
  ).sort((left, right) => Number(tagFilters.includes(right.id)) - Number(tagFilters.includes(left.id)));
  const selectedTagFacets = tagFilters
    .map((tagId) => facets.tags.find((facet) => facet.id === tagId))
    .filter((facet): facet is DatasetTagFacet => Boolean(facet));
  const visibleDatasets = [...filteredDatasets]
    .sort((left, right) => compareCatalogueDatasets(left, right, sortOrder, locale))
    .slice(0, visibleCount);

  if (error) return <PageState title={ua ? "Каталог недоступний." : "Catalogue unavailable."} detail={error} />;

  return (
    <div className="app-shell universal-shell catalogue-home-shell">
      <Masthead />
      <main>
        <section className="catalogue-home-hero">
          <div>
            <h1>{ua ? "Каталог даних України" : "Ukraine data catalogue"}</h1>
            <p>
              {ua
                ? "Офіційні, міжнародні та аналітичні ряди України в одному пошуковому каталозі. Відкривайте набір, щоб побачити його параметри, історію та джерело."
                : "Official, international and analytical series for Ukraine in one searchable catalogue. Open a dataset to inspect its parameters, history and source."}
            </p>
          </div>
          <label className="catalogue-home-search">
            <span>{ua ? "Пошук у всіх наборах" : "Search all datasets"}</span>
            <input
              type="search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setVisibleCount(72);
              }}
              placeholder={ua ? "ВВП, зайнятість, сталь, бюджет, код графіка…" : "GDP, employment, steel, budget, graph code…"}
              autoComplete="off"
            />
          </label>
          <div className="catalogue-home-stats">
            <div><strong>{loading ? "—" : datasets.length.toLocaleString(ua ? "uk-UA" : "en-GB")}</strong><span>{ua ? "наборів" : "datasets"}</span></div>
            <div><strong>{dataCornerOrder.length}</strong><span>{ua ? "куточків" : "corners"}</span></div>
            <div><strong>{loading ? "—" : filteredDatasets.length.toLocaleString(ua ? "uk-UA" : "en-GB")}</strong><span>{ua ? "у вибірці" : "in selection"}</span></div>
          </div>
        </section>

        <section className="catalogue-home-list" id="catalogue">
          <div className="section-rule">
            <span>01</span>
            <h2>{ua ? "Усі набори" : "All datasets"}</h2>
            <p>{ua ? "Фільтр за джерелом і предметною областю" : "Filter by source and subject"}</p>
          </div>
          <div className="catalogue-filter-switcher" role="group" aria-label={ua ? "Фільтри каталогу" : "Catalogue filters"}>
            {(["corner", "topic", "tags"] as const).map((panel) => {
              const isOpen = openFilterPanel === panel;
              const label = panel === "corner" ? (ua ? "Куточок" : "Corner") : panel === "topic" ? (ua ? "Тема" : "Topic") : (ua ? "Теги" : "Tags");
              const value = panel === "corner"
                ? (sourceFilter ? cornerConfigs[sourceFilter as DataCornerKey].sourceShort : (ua ? "Усі джерела" : "All sources"))
                : panel === "topic"
                  ? (categoryFilter || (ua ? "Усі теми" : "All topics"))
                  : tagFilters.length
                    ? `${tagFilters.length} ${ua ? "вибрано" : "selected"}`
                    : (ua ? "Відкрити список" : "Open list");
              return (
                <button
                  type="button"
                  key={panel}
                  className={`catalogue-filter-trigger${isOpen ? " active" : ""}${(panel === "corner" && sourceFilter) || (panel === "topic" && categoryFilter) || (panel === "tags" && tagFilters.length) ? " selected" : ""}`}
                  aria-expanded={isOpen}
                  aria-controls={`catalogue-filter-panel-${panel}`}
                  onClick={() => setOpenFilterPanel(isOpen ? null : panel)}
                >
                  <span>{label}</span>
                  <b>{value}</b>
                  <strong aria-hidden="true">{isOpen ? "−" : "+"}</strong>
                </button>
              );
            })}
          </div>
          {openFilterPanel === "corner" && (
            <div className="catalogue-filter-panel" id="catalogue-filter-panel-corner" aria-label={ua ? "Фільтр за куточком" : "Filter by corner"}>
              <div className="catalogue-filter-option-list" role="listbox" aria-label={ua ? "Куточки" : "Corners"}>
                <button
                  type="button"
                  className={`catalogue-filter-option${!sourceFilter ? " active" : ""}`}
                  aria-pressed={!sourceFilter}
                  onClick={() => { setSourceFilter(""); setVisibleCount(72); }}
                >
                  {ua ? "Усі джерела" : "All sources"} · {datasets.length}
                </button>
                {sourceFacets.map((facet) => (
                  <button
                    type="button"
                    key={facet.value}
                    className={`catalogue-filter-option${sourceFilter === facet.value ? " active" : ""}`}
                    aria-pressed={sourceFilter === facet.value}
                    onClick={() => { setSourceFilter(facet.value); setVisibleCount(72); }}
                  >
                    {cornerConfigs[facet.value as DataCornerKey].sourceShort} · {facet.count}
                  </button>
                ))}
              </div>
            </div>
          )}
          {openFilterPanel === "topic" && (
            <div className="catalogue-filter-panel" id="catalogue-filter-panel-topic" aria-label={ua ? "Фільтр за темою" : "Filter by topic"}>
              <div className="catalogue-filter-option-list" role="listbox" aria-label={ua ? "Теми" : "Topics"}>
                <button
                  type="button"
                  className={`catalogue-filter-option${!categoryFilter ? " active" : ""}`}
                  aria-pressed={!categoryFilter}
                  onClick={() => { setCategoryFilter(""); setVisibleCount(72); }}
                >
                  {ua ? "Усі теми" : "All topics"} · {datasets.length}
                </button>
                {facets.categories.map((facet) => (
                  <button
                    type="button"
                    key={facet.value}
                    className={`catalogue-filter-option${categoryFilter === facet.value ? " active" : ""}`}
                    aria-pressed={categoryFilter === facet.value}
                    onClick={() => { setCategoryFilter(facet.value); setVisibleCount(72); }}
                  >
                    {facet.value} · {facet.count}
                  </button>
                ))}
              </div>
            </div>
          )}
          {openFilterPanel === "tags" && (
            <div className="catalogue-filter-panel catalogue-filter-panel-tags" id="catalogue-filter-panel-tags" aria-label={ua ? "Фільтр за тегами" : "Filter by tags"}>
              <div className="catalogue-tag-filter-heading">
                <div>
                  <span>{ua ? "Теги" : "Tags"}</span>
                  <small>{ua ? "Оберіть один або кілька тегів; усі вибрані умови мають збігтися." : "Choose one or more tags; all selected conditions must match."}</small>
                </div>
                <input
                  type="search"
                  value={tagSearch}
                  onChange={(event) => setTagSearch(event.target.value)}
                  placeholder={ua ? "Пошук тегу…" : "Search tags…"}
                  aria-label={ua ? "Пошук тегу" : "Search tags"}
                />
              </div>
              {selectedTagFacets.length > 0 && (
                <div className="selected-tag-summary" aria-label={ua ? "Вибрані теги" : "Selected tags"}>
                  <span>{ua ? `Вибрано тегів: ${selectedTagFacets.length}` : `Selected tags: ${selectedTagFacets.length}`}</span>
                  <div>
                    {selectedTagFacets.map((facet) => (
                      <button
                        type="button"
                        key={facet.id}
                        className="selected-tag"
                        onClick={() => setTagFilters((current) => current.filter((tagId) => tagId !== facet.id))}
                      >
                        {ua ? facet.labelUa : facet.labelEn} <b aria-hidden="true">×</b>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="tag-chip-list">
                {visibleTagFacets.map((facet) => {
                  const selected = tagFilters.includes(facet.id);
                  return (
                    <button
                      type="button"
                      key={facet.id}
                      className={`tag-chip${selected ? " active" : ""}`}
                      aria-pressed={selected}
                      onClick={() => {
                        setTagFilters((current) => selected
                          ? current.filter((tagId) => tagId !== facet.id)
                          : [...current, facet.id]);
                        setVisibleCount(72);
                      }}
                    >
                      {ua ? facet.labelUa : facet.labelEn} · {facet.count}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <div className="catalogue-sort-controls">
            <label>
              <span>{ua ? "Сортування" : "Sort"}</span>
              <select
                aria-label={ua ? "Сортування наборів" : "Sort datasets"}
                value={sortOrder}
                onChange={(event) => setSortOrder(event.target.value as typeof sortOrder)}
              >
                <option value="corner">{ua ? "За куточком" : "By corner"}</option>
                <option value="latest">{ua ? "Найновіші дані" : "Latest data"}</option>
                <option value="coverage">{ua ? "Найдовша історія" : "Longest history"}</option>
                <option value="title">{ua ? "За назвою" : "By title"}</option>
                <option value="size">{ua ? "За кількістю рядків" : "By row count"}</option>
              </select>
            </label>
            {(search || sourceFilter || categoryFilter || tagFilters.length || sortOrder !== "corner") && (
              <button type="button" className="filter-reset" onClick={() => { setSearch(""); setSourceFilter(""); setCategoryFilter(""); setTagFilters([]); setTagSearch(""); setSortOrder("corner"); setVisibleCount(72); }}>
                {ua ? "Скинути" : "Reset"}
              </button>
            )}
          </div>
          {loading ? (
            <p className="catalogue-loading">{ua ? "Завантажуємо каталоги куточків…" : "Loading corner catalogues…"}</p>
          ) : (
            <>
              <div className="dataset-grid">
                {visibleDatasets.map((dataset) => <DatasetCard key={`${dataset.source}-${dataset.id}`} dataset={dataset} />)}
              </div>
              {!visibleDatasets.length && <p className="catalogue-loading">{ua ? "Наборів за цим фільтром не знайдено." : "No datasets match these filters."}</p>}
              <div className="catalogue-load-more">
                <span>{ua ? "Показано" : "Showing"} {visibleDatasets.length.toLocaleString(ua ? "uk-UA" : "en-GB")} / {filteredDatasets.length.toLocaleString(ua ? "uk-UA" : "en-GB")}</span>
                {visibleCount < filteredDatasets.length && <button type="button" onClick={() => setVisibleCount((count) => count + 72)}>{ua ? "Показати ще" : "Load more"}</button>}
              </div>
            </>
          )}
        </section>

        <section className="catalogue-gates">
          <a href="/frames#gate-1">
            <span>02 · {ua ? "Кутовий шлюз 1" : "Corner Gate 1"}</span>
            <h2>{ua ? "Кадри та зіставлення" : "Frames and comparisons"}</h2>
            <p>{ua ? "Комбіновані ряди з різних куточків для одного економічного зрізу." : "Combined series from different corners for one economic view."}</p>
          </a>
          <a href="/frames#gate-2">
            <span>03 · {ua ? "Кутовий шлюз 2" : "Corner Gate 2"}</span>
            <h2>{ua ? "Прогнозні сценарії" : "Forecast scenarios"}</h2>
            <p>{ua ? "Контейнер для перемикання сценаріїв ВВП, промисловості та індексу майбутнього." : "A container for GDP, industry and future-index scenario switching."}</p>
          </a>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

function FramesPage() {
  const [data, setData] = useState<UniversalData | null>(null);
  const [loadError, setLoadError] = useState("");
  const [selectedYear, setSelectedYear] = useState(2026);
  const [scenarioMetric, setScenarioMetric] = useState<"gdp" | "industry" | "future-index">("gdp");
  const [scenario, setScenario] = useState("S1");
  const { locale } = useSettings();
  const ua = locale === "uk";

  useEffect(() => {
    fetch(dataUrl("/data/universal.json"), { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error(`universal HTTP ${response.status}`);
        return response.json() as Promise<UniversalData>;
      })
      .then(setData)
      .catch((error: Error) => setLoadError(error.message));
  }, []);

  if (loadError) {
    return <PageState title="Універсальний каталог ще збирається." detail={loadError} />;
  }
  if (!data) return <PageState title={ua ? "Завантаження економічних рядів…" : "Loading economic series…"} />;

  const selectedFrame =
    data.frames.find((frame) => frame.year === selectedYear) ?? data.frames.at(-1);
  const frameSeries = (metricId: string) =>
    data.frames.flatMap((frame) => {
      const metric = frame.metrics.find((item) => item.id === metricId);
      return metric?.value === null || metric?.value === undefined
        ? []
        : [{
            date: `${frame.year}-12-31`,
            year: frame.year,
            value: metric.value,
            forecast: metric.forecast,
          }];
    });
  const comparisonEnglish: Record<string, { title: string; caveat: string }> = {
    "gdp-growth": {
      title: "Real GDP growth",
      caveat: "Compare the same year and publication date; a quarterly model is not an annual WEO forecast.",
    },
    inflation: {
      title: "Inflation",
      caveat: "Average annual, December-to-December and current year-on-year inflation are different measures.",
    },
    unemployment: {
      title: "Unemployment",
      caveat: "Wartime gaps and model estimates must remain separate from direct survey observations.",
    },
    "public-debt": {
      title: "Public debt",
      caveat: "Gross debt, central-government debt and budget financing have different coverage.",
    },
    "external-balance": {
      title: "External balance",
      caveat: "The merchandise trade balance is not the same as the balance-of-payments current account.",
    },
  };
  const roleEnglish: Record<string, string> = {
    "офіційний факт": "official observation",
    "міжнародна історія": "international history",
    "офіційний індекс": "official index",
    "монетарний контекст": "monetary context",
    "середньорічний прогноз": "average annual forecast",
    "національне обстеження": "national survey",
    "виконання бюджету": "budget execution",
    "офіційний зовнішній сектор": "official external sector",
    "товарна торгівля": "merchandise trade",
  };
  const reportCards = [
    {
      key: "annual",
      label: ua ? "Річний фундамент" : "Annual fundamentals",
      item: data.report.highlights.annual,
    },
    {
      key: "monthly",
      label: ua ? "Місячний рух" : "Monthly movement",
      item: data.report.highlights.monthly,
    },
    {
      key: "weekly",
      label: ua ? "Ранній сигнал" : "Early signal",
      item: data.report.highlights.weeklyOrDaily,
    },
  ];

  return (
    <div className="app-shell universal-shell">
      <Masthead generatedAt={data.meta.generatedAt} />
      <main>
        <section className="hero universal-hero" id="pulse">
          <div className="hero-copy">
            <h1>{ua ? "Економіка України" : "Ukraine economy"}</h1>
            <p className="hero-deck">
              {ua
                ? "Макроекономіка, державні фінанси, банки, торгівля, праця, бюджет і промисловість. Визначення, роки й статус прогнозів."
                : "Macroeconomics, public finance, banking, trade, labour, budget and industry. Definitions, years and forecast status."}
            </p>
          </div>
          <aside className="economic-summary">
            <header>
              <span>2026</span>
              <small>{ua ? "прогноз" : "forecast"}</small>
            </header>
            {selectedFrame?.metrics.slice(0, 4).map((metric) => (
              <div key={metric.id}>
                <span>{ua ? metric.title : metric.titleEn}</span>
                <strong>
                  {metric.value === null
                    ? "—"
                    : `${metric.value.toLocaleString(ua ? "uk-UA" : "en-GB", {
                        maximumFractionDigits: 1,
                      })}${metric.unit.startsWith("%") ? "%" : ""}`}
                </strong>
              </div>
            ))}
          </aside>
        </section>

        <section className="frame-desk" id="gate-1">
          <div className="section-rule">
            <span>01</span>
            <h2>{ua ? "Кутовий шлюз 1 · Кадри та зіставлення" : "Corner Gate 1 · Frames and comparisons"}</h2>
            <p>
              {ua
                ? "Комбіновані ряди з різних куточків; 2026 чітко позначений як прогноз"
                : "Combined series from different corners; 2026 is explicitly marked as a forecast"}
            </p>
          </div>
          <div className="frame-year-switcher">
            {data.frames.map((frame) => (
              <button
                key={frame.year}
                type="button"
                className={selectedYear === frame.year ? "active" : ""}
                onClick={() => setSelectedYear(frame.year)}
              >
                {frame.year}
                {frame.status === "forecast" && <small>{ua ? "прогноз" : "forecast"}</small>}
              </button>
            ))}
          </div>
          {selectedFrame && (
            <div className={`frame-panel ${selectedFrame.status}`}>
              <div className="frame-narrative">
                <span>{selectedFrame.source}</span>
                <h3>{selectedFrame.year}</h3>
                <p>{locale === "uk" ? selectedFrame.narrative.ua : selectedFrame.narrative.en}</p>
                <a href={selectedFrame.sourceUrl} target="_blank" rel="noreferrer">
                  {ua ? "Перевірити джерело" : "Verify source"} ↗
                </a>
              </div>
              <div className="frame-metric-grid">
                {selectedFrame.metrics.map((metric) => (
                  <article key={metric.id}>
                    <span>{ua ? metric.title : metric.titleEn}</span>
                    <strong>
                      {metric.value === null
                        ? "—"
                        : `${metric.value.toLocaleString(ua ? "uk-UA" : "en-GB", {
                            maximumFractionDigits: 1,
                          })}${metric.unit.startsWith("%") ? "%" : ""}`}
                    </strong>
                    <small>
                      {ua ? metric.unit : metric.unit.replace("ВВП", "GDP")} · {metric.sourceCode}
                    </small>
                  </article>
                ))}
              </div>
            </div>
          )}
          <div className="frame-chart-grid">
            <DataChart
              id="frame-gdp-growth"
              graphCode="UA-CORE-FRAME-G01"
              title={ua ? "Зростання реального ВВП" : "Real GDP growth"}
              subtitle={ua ? "2020–2025: історія/оцінка джерела; 2026: forecast" : "2020–2025: source history/estimate; 2026: forecast"}
              data={frameSeries("gdpGrowth")}
              color="#00bfe9"
              unit="%"
              formatter={(value) => `${value.toLocaleString(ua ? "uk-UA" : "en-GB", { maximumFractionDigits: 1 })}%`}
              locale={locale}
              sourceLabel="IMF WEO"
              sourceUrl={selectedFrame?.sourceUrl}
              featured
            />
            <DataChart
              id="frame-inflation"
              graphCode="UA-CORE-FRAME-G02"
              title={ua ? "Середня інфляція" : "Average inflation"}
              subtitle={ua ? "Не плутайте із грудень-до-грудня або поточною р/р інфляцією" : "Do not confuse this with December-to-December or current year-on-year inflation"}
              data={frameSeries("inflation")}
              color="#ff312e"
              unit="%"
              formatter={(value) => `${value.toLocaleString(ua ? "uk-UA" : "en-GB", { maximumFractionDigits: 1 })}%`}
              locale={locale}
              sourceLabel="IMF WEO"
              sourceUrl={selectedFrame?.sourceUrl}
            />
            <DataChart
              id="frame-unemployment"
              graphCode="UA-CORE-FRAME-G03"
              title={ua ? "Безробіття" : "Unemployment"}
              subtitle={ua ? "Частка робочої сили; прогалини воєнного періоду позначаються окремо" : "Share of the labour force; wartime gaps remain explicit"}
              data={frameSeries("unemployment")}
              color="#ffd400"
              unit="%"
              formatter={(value) => `${value.toLocaleString(ua ? "uk-UA" : "en-GB", { maximumFractionDigits: 1 })}%`}
              locale={locale}
              sourceLabel="IMF WEO"
              sourceUrl={selectedFrame?.sourceUrl}
            />
            <DataChart
              id="frame-public-debt"
              graphCode="UA-CORE-FRAME-G04"
              title={ua ? "Валовий державний борг" : "Gross public debt"}
              subtitle={ua ? "Відсоток ВВП" : "Percent of GDP"}
              data={frameSeries("publicDebt")}
              color="#76e000"
              unit="% ВВП"
              formatter={(value) => `${value.toLocaleString(ua ? "uk-UA" : "en-GB", { maximumFractionDigits: 1 })}%`}
              locale={locale}
              sourceLabel="IMF WEO"
              sourceUrl={selectedFrame?.sourceUrl}
            />
            <DataChart
              id="frame-current-account"
              graphCode="UA-CORE-FRAME-G05"
              title={ua ? "Поточний рахунок" : "Current account"}
              subtitle={ua ? "Сальдо у відсотках ВВП" : "Balance as a share of GDP"}
              data={frameSeries("currentAccount")}
              color="#ff7a00"
              unit="% ВВП"
              formatter={(value) => `${value.toLocaleString(ua ? "uk-UA" : "en-GB", { maximumFractionDigits: 1 })}%`}
              locale={locale}
              sourceLabel="IMF WEO"
              sourceUrl={selectedFrame?.sourceUrl}
            />
          </div>
        </section>

        <section className="universal-directory" id="catalogue">
          <div className="section-rule">
            <span>02</span>
            <h2>{ua ? "Каталог джерел" : "Source catalogue"}</h2>
            <p>{ua ? "Офіційні, міжнародні та дослідницькі ряди про Україну" : "Official, international and research series for Ukraine"}</p>
          </div>
          <div className="corner-directory-grid">
            {data.corners.map((item, index) => (
              <a
                className="corner-directory-card reveal"
                href={`/corner/${item.id}`}
                key={item.id}
                style={{ "--delay": `${index * 45}ms` } as React.CSSProperties}
              >
                <div className="corner-directory-index">
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <b>{item.name}</b>
                </div>
                <h3>{ua ? item.title : item.titleEn ?? item.title}</h3>
                <p>{ua ? item.description : item.descriptionEn ?? item.description}</p>
                <div className="corner-directory-role">{ua ? item.role : item.roleEn ?? item.role}</div>
                <footer>
                  <span>{item.datasetCount.toLocaleString(ua ? "uk-UA" : "en-GB")} {ua ? "наборів" : "datasets"}</span>
                  <span>{compactCount(item.observationCount, locale)} {ua ? "точок" : "points"}</span>
                  {item.deferredCount > 0 && (
                    <span>{item.deferredCount} {ua ? "недоступно" : "unavailable"}</span>
                  )}
                  {(item.factOnlyCount ?? 0) > 0 && (
                    <span>{item.factOnlyCount ?? 0} {ua ? "фактів без ряду" : "fact-only"}</span>
                  )}
                </footer>
              </a>
            ))}
          </div>
          <div className="report-downloads">
            <span>
              {ua
                ? "До каталогу входять лише набори, де є числовий ряд щонайменше за два різні періоди."
                : "The catalogue includes only datasets with a numeric series covering at least two distinct periods."}
            </span>
            <a href={dataUrl("/data/data-readiness.md")}>{ua ? "Аудит Markdown" : "Audit Markdown"}</a>
            <a href={dataUrl("/data/data-readiness.json")}>Audit JSON</a>
          </div>
        </section>

        <section className="universal-forecasts" id="gate-2">
          <div className="section-rule">
            <span>03</span>
            <h2>{ua ? "Кутовий шлюз 2 · Прогнозні сценарії" : "Corner Gate 2 · Forecast scenarios"}</h2>
            <p>{ua ? "НБУ + три зовнішні траєкторії; жодного усереднення чи вигаданої екстраполяції" : "NBU plus three external trajectories; no averaging or invented extrapolation"}</p>
          </div>
          <div className="forecast-grid">
            {data.forecasts.map((forecast) => {
              return (
                <DataChart
                    id={`forecast-${forecast.corner}`}
                    graphCode={`UA-CORE-FORECAST-${graphPrefixes[forecast.corner as SourceCornerKey]}-G01`}
                    key={forecast.corner}
                    title={ua ? "Зростання реального ВВП" : "Real GDP growth"}
                    subtitle={`${ua ? forecast.labelUa ?? forecast.label : forecast.label} · ${
                      forecast.corner === "nbu"
                        ? ua ? "випуск" : "release"
                        : "snapshot"
                    } ${forecast.releaseDate ?? ""}`}
                    data={forecast.points.filter((point) => point.year >= 2026)}
                    color={forecast.color}
                    unit="%"
                    formatter={(value) =>
                      `${value.toLocaleString(ua ? "uk-UA" : "en-GB", {
                        maximumFractionDigits: 2,
                      })}%`
                    }
                    locale={locale}
                    sourceLabel={ua ? forecast.labelUa ?? forecast.label : forecast.label}
                    sourceUrl={forecast.sourceUrl}
                  />
              );
            })}
          </div>
          <div className="forecast-coverage">
            {data.forecastHorizon.years.map((year) => (
              <div className={year.status} key={year.year}>
                <strong>{year.year}</strong>
                <span>
                  {year.values.length
                    ? year.values.map((value) => value.label).join(" · ")
                    : ua ? "немає опублікованого значення" : "no published value"}
                </span>
              </div>
            ))}
          </div>
          <p className="forecast-horizon-note">
            {ua ? data.forecastHorizon.description : data.forecastHorizon.descriptionEn}
          </p>
          <div className="forecast-scenario-container">
            <div className="scenario-container-heading">
              <div>
                <span>{ua ? "Контейнер прогнозної моделі" : "Forecast model container"}</span>
                <h3>{ua ? "Перемикач сценарію" : "Scenario switcher"}</h3>
              </div>
              <small>{ua ? "Числові ряди буде підключено після надходження даних Uconomics." : "Numeric series will be connected when the Uconomics forecast data arrives."}</small>
            </div>
            <div className="scenario-control-row">
              {([["gdp", ua ? "ВВП" : "GDP"], ["industry", ua ? "Промисловість" : "Industry"], ["future-index", ua ? "Індекс майбутнього" : "Future index"]] as const).map(([value, label]) => (
                <button type="button" key={value} className={scenarioMetric === value ? "active" : ""} onClick={() => setScenarioMetric(value)}>{label}</button>
              ))}
            </div>
            <div className="scenario-control-row scenario-options">
              {["S1", "S2", "S3", "S4", "S5"].map((value) => (
                <button type="button" key={value} className={scenario === value ? "active" : ""} onClick={() => setScenario(value)}>{value}</button>
              ))}
            </div>
            <div className="scenario-placeholder">
              <strong>{scenario}</strong>
              <span>{ua ? `Показник: ${scenarioMetric === "gdp" ? "ВВП" : scenarioMetric === "industry" ? "Промисловість" : "Індекс майбутнього"}. Значення не опубліковано.` : `Metric: ${scenarioMetric === "gdp" ? "GDP" : scenarioMetric === "industry" ? "Industry" : "Future index"}. No value published yet.`}</span>
            </div>
          </div>
        </section>

        <section className="signal-monitor" id="reports">
          <div className="section-rule">
            <span>04</span>
            <h2>{ua ? "Оновлення показників" : "Indicator updates"}</h2>
            <p>{ua ? data.report.headlineUa : data.report.headlineEn}</p>
          </div>
          <div className="signal-monitor-grid">
            {reportCards.map((card) => (
              <article key={card.key}>
                <span>{card.label}</span>
                <h3>{card.item?.title ?? (ua ? "Очікуємо новий зіставний зріз" : "Waiting for a new comparable release")}</h3>
                <p>
                  {card.item?.brief ??
                    (ua
                      ? "Джерело ще не опублікувало новий зіставний сигнал."
                      : "The source has not published a new comparable signal yet.")}
                </p>
                {card.item && (
                  <a href={card.item.url}>
                    {card.item.source} · {ua ? "відкрити джерело" : "open source"} ↗
                  </a>
                )}
              </article>
            ))}
          </div>
          <div className="report-downloads">
            <a href={dataUrl(data.report.markdown)}>{ua ? "Markdown звіту" : "Report Markdown"}</a>
            <a href={dataUrl(data.report.json)}>Report JSON</a>
          </div>
        </section>

        <section className="comparison-desk" id="method">
          <div className="section-rule">
            <span>05</span>
            <h2>{ua ? "Зіставні економічні ряди" : "Comparable economic series"}</h2>
            <p>{ua ? "Одиниці, періоди, джерельні ролі та методологічні межі" : "Units, periods, source roles and methodological boundaries"}</p>
          </div>
          <div className="comparison-grid">
            {data.comparisons.map((comparison) => (
              <article className="comparison-card" key={comparison.id}>
                <header>
                  <span>{comparison.unit}</span>
                  <h3>{ua ? comparison.title : comparisonEnglish[comparison.id]?.title ?? comparison.title}</h3>
                </header>
                <div className="comparison-source-list">
                  {comparison.sources.map((source) => {
                    const sourceCorner = data.corners.find(
                      (item) => item.id === source.corner,
                    );
                    return (
                      <a
                        href={sourceCorner?.url}
                        key={`${source.corner}-${source.code}`}
                      >
                        <b>{sourceCorner?.name ?? source.corner}</b>
                        <span>{ua ? source.role : roleEnglish[source.role] ?? source.role}</span>
                        <code>{source.code}</code>
                      </a>
                    );
                  })}
                </div>
                <p>{ua ? comparison.caveat : comparisonEnglish[comparison.id]?.caveat ?? comparison.caveat}</p>
              </article>
            ))}
          </div>
        </section>

      </main>
      <SiteFooter />
    </div>
  );
}

function UniversalCornerCataloguePage({ source }: { source: DataCornerKey }) {
  const [cornerInfo, setCornerInfo] = useState<UniversalCorner | null>(null);
  const [datasets, setDatasets] = useState<DataroomCard[]>([]);
  const [facets, setFacets] = useState<DatasetFacets>({
    categories: [],
    frequencies: [],
    coverage: [],
    tags: [],
    regionalCount: 0,
    buckets: [],
    lineage: [],
  });
  const [filters, setFilters] = useState<CatalogueFilters>(emptyCatalogueFilters);
  const [search, setSearch] = useState("");
  const [tagSearch, setTagSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const deferredSearch = useDeferredValue(search.trim());
  const { locale } = useSettings();
  const ua = locale === "uk";
  const limit = 60;
  const deferredTagSearch = useDeferredValue(tagSearch.trim().toLocaleLowerCase());
  const hasActiveFilters = Boolean(
    filters.category ||
    filters.frequency ||
    filters.coverage ||
    filters.tags.length ||
    filters.regional ||
    filters.bucket ||
    filters.lineage,
  );
  const visibleTagFacets = facets.tags.filter((facet) =>
    !deferredTagSearch || `${facet.labelUa} ${facet.labelEn}`.toLocaleLowerCase().includes(deferredTagSearch),
  ).sort((left, right) => Number(filters.tags.includes(right.id)) - Number(filters.tags.includes(left.id)));
  const selectedTagFacets = filters.tags
    .map((tagId) => facets.tags.find((facet) => facet.id === tagId))
    .filter((facet): facet is DatasetTagFacet => Boolean(facet));

  function matchesFilters(dataset: DataroomCard) {
    return (
      (!filters.category || dataset.category === filters.category) &&
      (!filters.frequency || dataset.frequency === filters.frequency) &&
      (!filters.coverage || datasetCoverageBand(dataset) === filters.coverage) &&
      filters.tags.every((tagId) => (dataset.tags ?? []).some((tag) => tag.id === tagId)) &&
      (!filters.regional || dataset.regional.available) &&
      (!filters.bucket || dataset.lineage?.bucket === filters.bucket) &&
      (!filters.lineage || dataset.lineage?.mode === filters.lineage)
    );
  }

  function datasetQuery(nextOffset: number) {
    const params = new URLSearchParams({
      limit: String(filters.tags.length ? 5000 : limit),
      offset: String(nextOffset),
    });
    if (deferredSearch) params.set("q", deferredSearch);
    if (filters.category) params.set("category", filters.category);
    if (filters.frequency) params.set("frequency", filters.frequency);
    if (filters.coverage) params.set("coverage", filters.coverage);
    if (filters.regional) params.set("regional", "true");
    if (filters.bucket) params.set("bucket", filters.bucket);
    if (filters.lineage) params.set("lineage", filters.lineage);
    return params.toString();
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    setOffset(0);
    if (isLocal || isStaticCorner(source)) {
      Promise.all([
        fetch(isStaticCorner(source) && !isLocal ? "/uc/universal.json" : "/data/ukraine/universal.json")
          .then((response) => response.json() as Promise<UniversalData>),
        fetch(cornerDataUrl(source, "dataroom/manifest.json"))
          .then((response) => response.json() as Promise<DataroomManifest>),
      ])
        .then(([universal, manifest]) => {
          if (cancelled) return;
          const query = deferredSearch.toLocaleLowerCase();
          const taggedDatasets = manifest.datasets.map((dataset) => withDatasetTags(dataset, source));
          const filtered = taggedDatasets.filter((dataset) =>
            matchesFilters(dataset) &&
            (
              !query ||
              `${dataset.id} ${dataset.title} ${dataset.titleUa ?? ""} ${dataset.titleEn ?? ""} ${dataset.category} ${dataset.description} ${dataset.descriptionUa ?? ""} ${dataset.descriptionEn ?? ""}`
                .toLocaleLowerCase()
                .includes(query)
            ),
          );
          setCornerInfo(universal.corners.find((item) => item.id === source) ?? null);
          setFacets(facetsFromDatasets(taggedDatasets));
          setDatasets(filtered.slice(0, limit).map((dataset) => ({
            ...dataset,
            url: datasetPublicPath(source, dataset),
          })));
          setTotal(filtered.length);
          setOffset(Math.min(limit, filtered.length));
        })
        .catch((loadError: Error) => !cancelled && setError(loadError.message))
        .finally(() => !cancelled && setLoading(false));
    } else {
      Promise.all([
        fetch(`/api/v1/ukraine/corners/${source}`, { cache: "no-store" }).then((response) => {
          if (!response.ok) throw new Error(`corner HTTP ${response.status}`);
          return response.json();
        }),
        fetch(
          `/api/v1/ukraine/corners/${source}/datasets?${datasetQuery(0)}`,
          { cache: "no-store" },
        ).then((response) => {
          if (!response.ok) throw new Error(`datasets HTTP ${response.status}`);
          return response.json();
        }),
      ])
        .then(([cornerPayload, datasetPayload]) => {
          if (cancelled) return;
          setCornerInfo(cornerPayload.data);
          const taggedDatasets = datasetPayload.data.map((dataset: DataroomCard) => withDatasetTags(dataset, source));
          const filteredByTags = taggedDatasets.filter((dataset: DataroomCard) => matchesFilters(dataset));
          setDatasets(filteredByTags.map((dataset: DataroomCard) => ({
            ...dataset,
            url: datasetPublicPath(source, dataset),
          })));
          const derivedFacets = facetsFromDatasets(taggedDatasets);
          setFacets(
            datasetPayload.meta.facets
              ? { ...derivedFacets, ...datasetPayload.meta.facets, tags: derivedFacets.tags }
              : derivedFacets,
          );
          setTotal(filters.tags.length ? filteredByTags.length : datasetPayload.meta.total);
          setOffset(filters.tags.length ? filteredByTags.length : taggedDatasets.length);
        })
        .catch((loadError: Error) => !cancelled && setError(loadError.message))
        .finally(() => !cancelled && setLoading(false));
    }
    return () => {
      cancelled = true;
    };
  }, [
    source,
    deferredSearch,
    filters.category,
    filters.frequency,
    filters.coverage,
    filters.tags,
    filters.regional,
    filters.bucket,
    filters.lineage,
  ]);

  async function loadMore() {
    if (loading || offset >= total) return;
    setLoading(true);
    try {
      if (isLocal || isStaticCorner(source)) {
        const manifest = await fetch(cornerDataUrl(source, "dataroom/manifest.json"))
          .then((response) => response.json() as Promise<DataroomManifest>);
        const query = deferredSearch.toLocaleLowerCase();
        const taggedDatasets = manifest.datasets.map((dataset) => withDatasetTags(dataset, source));
        const filtered = taggedDatasets.filter((dataset) =>
          matchesFilters(dataset) &&
          (
            !query ||
            `${dataset.id} ${dataset.title} ${dataset.titleUa ?? ""} ${dataset.titleEn ?? ""} ${dataset.category} ${dataset.description} ${dataset.descriptionUa ?? ""} ${dataset.descriptionEn ?? ""}`
              .toLocaleLowerCase()
              .includes(query)
          ),
        );
        const next = filtered.slice(offset, offset + limit).map((dataset) => ({
          ...dataset,
          url: datasetPublicPath(source, dataset),
        }));
        setDatasets((current) => [...current, ...next]);
        setOffset((current) => current + next.length);
      } else {
        const response = await fetch(
          `/api/v1/ukraine/corners/${source}/datasets?${datasetQuery(offset)}`,
          { cache: "no-store" },
        );
        if (!response.ok) throw new Error(`datasets HTTP ${response.status}`);
        const payload = await response.json();
        const taggedDatasets = payload.data.map((dataset: DataroomCard) => withDatasetTags(dataset, source));
        const filteredByTags = taggedDatasets.filter((dataset: DataroomCard) => matchesFilters(dataset));
        setDatasets((current) => [
          ...current,
          ...filteredByTags.map((dataset: DataroomCard) => ({
            ...dataset,
            url: datasetPublicPath(source, dataset),
          })),
        ]);
        setOffset((current) => current + filteredByTags.length);
      }
    } catch (loadError) {
      setError((loadError as Error).message);
    } finally {
      setLoading(false);
    }
  }

  if (error) return <PageState title={ua ? "Каталог недоступний." : "Catalogue unavailable."} detail={error} />;
  if (!cornerInfo) return <PageState title={ua ? "Відкриваємо каталог…" : "Opening catalogue…"} />;

  return (
    <div className="app-shell universal-corner-page">
      <Masthead />
      <main>
        <section className="corner-catalogue-hero">
          <a href="/#catalogue">← {ua ? "Усі куточки" : "All corners"}</a>
          <h1>{ua ? cornerInfo.title : cornerInfo.titleEn ?? cornerInfo.title}</h1>
          <p>{ua ? cornerInfo.description : cornerInfo.descriptionEn ?? cornerInfo.description}</p>
          <div>
            <strong>{total.toLocaleString(ua ? "uk-UA" : "en-GB")}</strong>
            <span>{ua ? "доступних наборів" : "available datasets"}</span>
          </div>
          {source === "industrial" && (
            <p className="corner-audit-links">
              <a
                href={isLocal
                  ? "/data/industrial/dataroom/RI-AUDIT.json"
                  : "/api/corners/industrial/data/dataroom/RI-AUDIT.json"}
              >
                {ua ? "Аудит імпорту RI" : "RI import audit"} · JSON
              </a>
              <a
                href={isLocal
                  ? "/data/industrial/dataroom/RI-AUDIT.md"
                  : "/api/corners/industrial/data/dataroom/RI-AUDIT.md"}
              >
                Markdown
              </a>
            </p>
          )}
        </section>
        <section className="corner-catalogue-list">
          <div className="schema-heading">
            <div>
              <h2>{ua ? "Набори даних" : "Datasets"}</h2>
            </div>
            <label className="search-field">
              <span>{ua ? "Пошук" : "Search"}</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={ua ? "назва, код, категорія…" : "title, code, category…"}
              />
            </label>
          </div>
          <div className="corner-filter-panel" aria-label={ua ? "Фільтри каталогу" : "Catalogue filters"}>
            <label>
              <span>{filterLabel(source, locale)}</span>
              <select
                value={filters.category}
                onChange={(event) =>
                  startTransition(() =>
                    setFilters((current) => ({ ...current, category: event.target.value }))
                  )
                }
              >
                <option value="">{ua ? "Усі теми" : "All topics"}</option>
                {facets.categories.map((facet) => (
                  <option value={facet.value} key={facet.value}>
                    {facet.value} · {facet.count}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>{ua ? "Періодичність" : "Cadence"}</span>
              <select
                value={filters.frequency}
                onChange={(event) =>
                  startTransition(() =>
                    setFilters((current) => ({ ...current, frequency: event.target.value }))
                  )
                }
              >
                <option value="">{ua ? "Усі періодичності" : "All cadences"}</option>
                {facets.frequencies.map((facet) => (
                  <option value={facet.value} key={facet.value}>
                    {facet.value} · {facet.count}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>{ua ? "Початок історії" : "History starts"}</span>
              <select
                value={filters.coverage}
                onChange={(event) =>
                  startTransition(() =>
                    setFilters((current) => ({ ...current, coverage: event.target.value }))
                  )
                }
              >
                <option value="">{ua ? "Будь-який рік" : "Any year"}</option>
                <option value="pre-2000">{ua ? "До 2000" : "Before 2000"}</option>
                <option value="2000-2019">2000–2019</option>
                <option value="2020-plus">2020+</option>
              </select>
            </label>
            <label className="filter-checkbox">
              <input
                type="checkbox"
                checked={filters.regional}
                onChange={(event) =>
                  startTransition(() =>
                    setFilters((current) => ({ ...current, regional: event.target.checked }))
                  )
                }
              />
              <span>
                {ua ? "Регіональні дані" : "Regional data"} · {facets.regionalCount}
              </span>
            </label>
            {source === "industrial" && (
              <>
                <label>
                  <span>{ua ? "Бакет RI" : "RI bucket"}</span>
                  <select
                    value={filters.bucket}
                    onChange={(event) =>
                      startTransition(() =>
                        setFilters((current) => ({ ...current, bucket: event.target.value }))
                      )
                    }
                  >
                    <option value="">{ua ? "Бакети 08–11" : "Buckets 08–11"}</option>
                    {facets.buckets.map((facet) => (
                      <option value={facet.value} key={facet.value}>
                        {facet.value} · {facet.count}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>{ua ? "Походження RI" : "RI lineage"}</span>
                  <select
                    value={filters.lineage}
                    onChange={(event) =>
                      startTransition(() =>
                        setFilters((current) => ({ ...current, lineage: event.target.value }))
                      )
                    }
                  >
                    <option value="">{ua ? "Усі графіки" : "All graphs"}</option>
                    <option value="native">{ua ? "Нативні RI" : "RI native"}</option>
                    <option value="connected">{ua ? "Пов’язані з джерелами" : "Source-connected"}</option>
                  </select>
                </label>
              </>
            )}
            {hasActiveFilters && (
              <button
                type="button"
                className="filter-reset"
                onClick={() => startTransition(() => setFilters(emptyCatalogueFilters))}
              >
                {ua ? "Скинути фільтри" : "Reset filters"}
              </button>
            )}
          </div>
          <div className="catalogue-tag-filter" aria-label={ua ? "Фільтр за тегами" : "Filter by tags"}>
            <div className="catalogue-tag-filter-heading">
              <div>
                <span>{ua ? "Теги" : "Tags"}</span>
                <small>{ua ? "Один або кілька тегів для уточнення набору." : "Use one or more tags to refine the catalogue."}</small>
              </div>
              <input
                type="search"
                value={tagSearch}
                onChange={(event) => setTagSearch(event.target.value)}
                placeholder={ua ? "Пошук тегу…" : "Search tags…"}
                aria-label={ua ? "Пошук тегу" : "Search tags"}
              />
            </div>
            {selectedTagFacets.length > 0 && (
              <div className="selected-tag-summary" aria-label={ua ? "Вибрані теги" : "Selected tags"}>
                <span>{ua ? `Вибрано тегів: ${selectedTagFacets.length}` : `Selected tags: ${selectedTagFacets.length}`}</span>
                <div>
                  {selectedTagFacets.map((facet) => (
                    <button
                      type="button"
                      key={facet.id}
                      className="selected-tag"
                      onClick={() => startTransition(() => setFilters((current) => ({
                        ...current,
                        tags: current.tags.filter((tagId) => tagId !== facet.id),
                      })))}
                    >
                      {ua ? facet.labelUa : facet.labelEn} <b aria-hidden="true">×</b>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="tag-chip-list">
              {visibleTagFacets.map((facet) => {
                const selected = filters.tags.includes(facet.id);
                return (
                  <button
                    type="button"
                    key={facet.id}
                    className={`tag-chip${selected ? " active" : ""}`}
                    aria-pressed={selected}
                    onClick={() => startTransition(() => setFilters((current) => ({
                      ...current,
                      tags: selected
                        ? current.tags.filter((tagId) => tagId !== facet.id)
                        : [...current.tags, facet.id],
                    })))}
                  >
                    {ua ? facet.labelUa : facet.labelEn} · {facet.count}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="dataset-grid">
            {datasets.map((dataset) => <DatasetCard key={dataset.id} dataset={dataset} />)}
          </div>
          <div className="catalogue-load-more">
            <span>
              {ua ? "Показано" : "Showing"} {datasets.length.toLocaleString(ua ? "uk-UA" : "en-GB")} /{" "}
              {total.toLocaleString(ua ? "uk-UA" : "en-GB")}
            </span>
            {offset < total && (
              <button type="button" onClick={() => void loadMore()} disabled={loading}>
                {loading ? (ua ? "Завантажуємо…" : "Loading…") : (ua ? "Показати ще" : "Load more")}
              </button>
            )}
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

function HomePage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [dataroom, setDataroom] = useState<DataroomManifest | null>(null);
  const [reports, setReports] = useState<ReportManifestItem[]>([]);
  const [loadError, setLoadError] = useState("");
  const [range, setRange] = useState<"all" | "2020">("all");
  const [category, setCategory] = useState("Усі");
  const [perspective, setPerspective] = useState<"all" | "regional">("all");
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search.trim().toLocaleLowerCase("uk"));

  useEffect(() => {
    Promise.all([
      fetch(dataUrl("/data/dashboard.json")).then((response) => {
        if (!response.ok) throw new Error(`dashboard HTTP ${response.status}`);
        return response.json() as Promise<DashboardData>;
      }),
      fetch(dataUrl("/data/dataroom/manifest.json")).then((response) => {
        if (!response.ok) throw new Error(`dataroom HTTP ${response.status}`);
        return response.json() as Promise<DataroomManifest>;
      }),
      fetch(dataUrl("/data/reports/manifest.json")).then((response) => {
        if (!response.ok) throw new Error(`reports HTTP ${response.status}`);
        return response.json() as Promise<ReportManifestItem[]>;
      }),
    ])
      .then(([dashboard, manifest, reportManifest]) => {
        setData(dashboard);
        setDataroom(manifest);
        setReports(reportManifest);
      })
      .catch((error: Error) => setLoadError(error.message));
  }, []);

  if (loadError) {
    return (
      <PageState
        title="Дані ще збираються."
        detail={`Технічна помилка: ${loadError}`}
      />
    );
  }
  if (!data || !dataroom) {
    return <PageState title="Збираємо економічну картину…" />;
  }

  const heroMetrics = data.metrics.slice(0, 8);
  const chartMetrics = heroMetrics.filter((metric) => metric.series.length > 1);
  const categories = [
    "Усі",
    ...new Set(dataroom.datasets.map((item) => item.category)),
  ];
  const filteredDatasets = dataroom.datasets.filter((item) => {
    const categoryMatch = category === "Усі" || item.category === category;
    const perspectiveMatch =
      perspective === "all" || item.regional.available;
    const searchMatch =
      !deferredSearch ||
      `${item.title} ${item.titleUa ?? ""} ${item.titleEn ?? ""} ${item.id} ${item.category} ${item.description} ${item.descriptionUa ?? ""} ${item.descriptionEn ?? ""}`
        .toLocaleLowerCase("uk")
        .includes(deferredSearch);
    return categoryMatch && perspectiveMatch && searchMatch;
  });
  const primarySignal = data.signals[0] ?? {
    id: "collecting",
    metricId: "collecting",
    level: "context" as const,
    label: "збираємо",
    title: "Джерело ще обробляється",
    body: "Каталог уже доступний, а перші порівнювані сигнали з’являться після завершення нормалізації.",
    value: "—",
  };

  return (
    <div className="app-shell">
      <Masthead generatedAt={dataroom.meta.generatedAt} />
      <main id="top">
        <section className="hero" id="pulse">
          <div className="hero-copy">
            <h1>{corner.hero}</h1>
            <p className="hero-deck">{corner.deck}</p>
          </div>
          <aside className="hero-lead">
            <span className={`lead-flag signal-${primarySignal.level}`}>
              {primarySignal.label}
            </span>
            <h2>{primarySignal.title}</h2>
            <p>{primarySignal.body}</p>
            <strong>{primarySignal.value}</strong>
          </aside>
        </section>

        <section className="ticker" aria-label="Ключові сигнали">
          <span className="ticker-label">Економічна стрічка</span>
          <div className="ticker-track">
            {[...data.signals, ...data.signals].map((signal, index) => (
              <span key={`${signal.id}-${index}`}>
                <b>{signal.label}</b>
                {signal.title}: {signal.value}
              </span>
            ))}
          </div>
        </section>

        <section className="metrics-section">
          <div className="section-rule">
            <span>01</span>
            <h2>Головна шпальта</h2>
            <p>Останні доступні офіційні значення {corner.sourceShort}</p>
          </div>
          <div className="metric-grid">
            {heroMetrics.map((metric, index) => (
              <MetricCard key={metric.id} metric={metric} index={index} />
            ))}
          </div>
        </section>

        <section className="signals-section">
          <div className="section-rule">
            <span>02</span>
            <h2>Що змінилося</h2>
            <p>Маркери для перевірки, а не автоматичні пояснення причин</p>
          </div>
          <div className="signal-list">
            {data.signals.slice(0, 5).map((signal) => (
              <SignalRow key={signal.id} signal={signal} />
            ))}
          </div>
        </section>

        <section className="dynamics-section" id="dynamics">
          <div className="section-rule section-rule-controls">
            <span>03</span>
            <h2>Історична динаміка</h2>
            <div className="range-toggle" aria-label="Період графіків">
              <button
                className={range === "all" ? "active" : ""}
                onClick={() => startTransition(() => setRange("all"))}
              >
                Вся історія
              </button>
              <button
                className={range === "2020" ? "active" : ""}
                onClick={() => startTransition(() => setRange("2020"))}
              >
                2020+
              </button>
            </div>
          </div>
          <div className="chart-grid">
            {chartMetrics.map((metric, index) => {
              const series =
                range === "2020"
                  ? metric.series.filter(
                      (point) => (point.year ?? Number(point.date.slice(0, 4))) >= 2020,
                    )
                  : metric.series;
              return (
                <article
                  className={`chart-card ${index === 0 ? "chart-card-featured" : ""}`}
                  id={`chart-${metric.id}`}
                  key={metric.id}
                >
                  <div className="chart-header">
                    <div>
                      <span>
                        {graphCode(
                          cornerKey,
                          dataroom.datasets.find((dataset) => dataset.id === metric.id)?.number ?? index + 1,
                          1,
                        )} / {metric.category}
                      </span>
                      <h3>{metric.shortTitle}</h3>
                    </div>
                    <strong>{formatMetric(metric)}</strong>
                  </div>
                  <p className="chart-subtitle">
                    {metric.title}. {metric.annualization}. Наведіть курсор на графік для
                    точного значення.
                  </p>
                  <LineChart
                    data={series}
                    color={metric.color}
                    unit={metric.unit}
                    formatter={(value, compact) =>
                      formatMetric(metric, value, compact)
                    }
                  />
                </article>
              );
            })}
          </div>
        </section>

        <section className="reports-section" id="reports">
          <div className="section-rule">
            <span>04</span>
            <h2>Три масштаби змін</h2>
            <p>Рік, останній період і свіжість каталогу</p>
          </div>
          <div className="reports-grid">
            {reports.map((report) => (
              <ReportCard key={report.id} report={report} />
            ))}
          </div>
        </section>

        <section className="catalogue-section" id="catalogue">
          <div className="catalogue-heading">
            <div>
              <h2>Каталог даних</h2>
            </div>
            <p>
              Визначення, графіки, параметри, регіональні зрізи та файли
              кожного набору.
            </p>
          </div>
          <div className="catalogue-controls">
            <div className="catalogue-filter-stack">
              <div className="perspective-toggle" aria-label="Перспектива каталогу">
                <button
                  className={perspective === "all" ? "active" : ""}
                  onClick={() => startTransition(() => setPerspective("all"))}
                >
                  Усі дані
                </button>
                <button
                  className={perspective === "regional" ? "active" : ""}
                  onClick={() =>
                    startTransition(() => setPerspective("regional"))
                  }
                >
                  Регіональна перспектива ·{" "}
                  {dataroom.meta.regionalDatasetCount}
                </button>
              </div>
              <div className="category-tabs" role="tablist">
                {categories.map((item) => (
                  <button
                    key={item}
                    className={category === item ? "active" : ""}
                    onClick={() => startTransition(() => setCategory(item))}
                    role="tab"
                    aria-selected={category === item}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
            <label className="search-field">
              <span>Пошук</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="ВВП, зарплата, промисловість…"
              />
            </label>
          </div>
          <div className="dataset-grid">
            {filteredDatasets.map((dataset) => (
              <DatasetCard key={dataset.id} dataset={dataset} />
            ))}
          </div>
          <p className="catalogue-count">
            Показано {filteredDatasets.length} з {dataroom.datasets.length}
          </p>
        </section>

      </main>
      <SiteFooter />
    </div>
  );
}

function IndicatorCard({
  indicator,
  title,
}: {
  indicator: DatasetIndicator;
  title: string;
}) {
  const { locale } = useSettings();
  const ua = locale === "uk";
  return (
    <article className="dataset-indicator">
      <span>{title}</span>
      <strong>{formatNumber(indicator.value, indicator.unit, false, locale)}</strong>
      <small>
        {indicator.date ? formatDate(indicator.date, locale) : ua ? "останній зріз" : "latest"} /{" "}
        {indicator.unit}
        {indicator.observationStatus === "last-published" &&
          (ua ? " / останнє опубліковане" : " / last published")}
      </small>
    </article>
  );
}

function FactCard({ fact }: { fact: DatasetFact }) {
  const { locale } = useSettings();
  const ua = locale === "uk";
  return (
    <article className="dataset-fact-card">
      <span>{fact.label}</span>
      <strong>{fact.value}</strong>
      <small>
        {fact.period} · {fact.unit} · {fact.status === "editorial model" && ua ? "редакційна модель" : fact.status}
      </small>
    </article>
  );
}

function RawDataExplorer({
  dataset,
  sourceCorner,
}: {
  dataset: DatasetSummary;
  sourceCorner?: DataCornerKey;
}) {
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [chunkIndex, setChunkIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { locale } = useSettings();
  const ua = locale === "uk";
  const defaultFields = ["source", ...dataset.schema.slice(0, 7).map((item) => item.field)];
  const [visibleFields, setVisibleFields] = useState(defaultFields);

  async function loadNext() {
    const chunk = dataset.exports.jsonChunks[chunkIndex];
    if (!chunk) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch(
        sourceCorner
          ? sourceCorner === "uconomics"
            ? cornerDataUrl(sourceCorner, chunk.url.slice("/data".length))
            : isLocal
              ? `/data/${sourceCorner}${chunk.url.slice("/data".length)}`
              : `/api/v1/ukraine/corners/${sourceCorner}/datasets/${dataset.id}/rows?part=${chunkIndex + 1}`
          : dataUrl(chunk.url),
        sourceCorner && !isLocal && sourceCorner !== "uconomics" ? { cache: "no-store" } : undefined,
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const next = (await response.json()) as Array<Record<string, unknown>>;
      setRows((currentRows) => [...currentRows, ...next]);
      setChunkIndex((index) => index + 1);
    } catch (loadError) {
      setError((loadError as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="raw-explorer">
      <div className="raw-explorer-head">
        <div>
          <h2>{ua ? "Детальний зріз" : "Detailed view"}</h2>
          <p>
            {ua
              ? "Таблиця не завантажується разом зі сторінкою. Один клік додає до"
              : "The table is not loaded with the page. One click adds up to"}{" "}
            {dataset.exports.jsonChunks[0]?.rows.toLocaleString(ua ? "uk-UA" : "en-GB") ?? 0}{" "}
            {ua ? "рядків." : "rows."}
          </p>
        </div>
        <button onClick={() => void loadNext()} disabled={loading || !dataset.exports.jsonChunks[chunkIndex]}>
          {loading
            ? ua ? "Завантажуємо…" : "Loading…"
            : rows.length
              ? ua ? "Додати наступну частину" : "Load next part"
              : ua ? "Завантажити дані" : "Load data"}
        </button>
      </div>
      {error && <p className="data-error">{ua ? "Помилка" : "Error"}: {error}</p>}
      {rows.length > 0 && (
        <>
          <div className="column-picker">
            <span>{ua ? "Колонки" : "Columns"}:</span>
            {visibleFields.map((field) => (
              <button
                key={field}
                onClick={() =>
                  visibleFields.length > 1 &&
                  setVisibleFields((fields) => fields.filter((item) => item !== field))
                }
              >
                {field} ×
              </button>
            ))}
            <select
              value=""
              onChange={(event) => {
                if (event.target.value) {
                  setVisibleFields((fields) => [
                    ...new Set([...fields, event.target.value]),
                  ]);
                }
              }}
            >
              <option value="">{ua ? "+ додати колонку" : "+ add column"}</option>
              {dataset.schema
                .filter((field) => !visibleFields.includes(field.field))
                .map((field) => (
                  <option key={field.field} value={field.field}>
                    {field.label} ({field.field})
                  </option>
                ))}
            </select>
          </div>
          <div className="raw-table-wrap">
            <table className="raw-table">
              <thead>
                <tr>
                  {visibleFields.map((field) => (
                    <th key={field}>{field}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 3_000).map((row, index) => (
                  <tr key={index}>
                    {visibleFields.map((field) => (
                      <td key={field}>
                        {typeof row[field] === "object"
                          ? JSON.stringify(row[field])
                          : String(row[field] ?? "—")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="table-note">
            {ua ? "У пам’яті" : "In memory"} {rows.length.toLocaleString(ua ? "uk-UA" : "en-GB")}{" "}
            {ua ? "рядків. Таблиця показує перші" : "rows. The table shows the first"}{" "}
            {Math.min(rows.length, 3_000).toLocaleString(ua ? "uk-UA" : "en-GB")}.
          </p>
        </>
      )}
    </section>
  );
}

function DatasetPage({
  id,
  sourceCorner,
}: {
  id: string;
  sourceCorner?: DataCornerKey;
}) {
  const [dataset, setDataset] = useState<DatasetSummary | null>(null);
  const [error, setError] = useState("");
  const [indicatorSearch, setIndicatorSearch] = useState("");
  const [seriesWindow, setSeriesWindow] = useState<"all" | "2020" | "latest-10">("all");
  const [showAllIndicators, setShowAllIndicators] = useState(false);
  const deferredIndicatorSearch = useDeferredValue(
    indicatorSearch.trim().toLocaleLowerCase("uk"),
  );
  const { locale } = useSettings();
  const ua = locale === "uk";
  const apiCorner = Boolean(sourceCorner && !isLocal && !isStaticCorner(sourceCorner));

  useEffect(() => {
    const summaryUrl = sourceCorner
      ? cornerDataUrl(sourceCorner, `dataroom/${id}/summary.json`)
      : dataUrl(`/data/dataroom/${id}/summary.json`);
    const requestInit: RequestInit = {
      signal: AbortSignal.timeout(datasetRequestTimeoutMs),
    };
    if (apiCorner) requestInit.cache = "no-store";
    fetch(summaryUrl, requestInit)
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((payload) => setDataset(readDatasetSummary(payload)))
      .catch((loadError: Error) => setError(loadError.message));
  }, [apiCorner, id, sourceCorner]);

  if (error) {
    return <PageState title={ua ? "Набір не знайдено." : "Dataset not found."} detail={error} />;
  }
  if (!dataset) return <PageState title={ua ? "Відкриваємо набір…" : "Opening dataset…"} />;

  const color = categoryColors[dataset.category] ?? "#0057b8";
  const title = localizedDatasetTitle(dataset, locale);
  const guide = dataset.readerGuide?.[locale === "uk" ? "ua" : "en"];
  const simpleQuestion = guide?.what ?? (ua
    ? dataset.question
    : `What does “${title}” measure for Ukraine?`);
  const simpleWhy = guide?.use ?? (ua
    ? dataset.why
    : "Use the series to identify a movement worth investigating; the graph alone cannot prove its cause.");
  const datasetSource: DataCornerKey = sourceCorner ?? (cornerKey === "ukraine" ? "uconomics" : cornerKey);
  const publicDatasetId = datasetShortIdFromBase(
    dataset.graphCodeBase,
    datasetSource,
    dataset.number,
  );
  const publicPath = `/id/${publicDatasetId}`;
  const datasetTags = datasetTagDefinitions(dataset, datasetSource);
  const matchingIndicators = dataset.indicators.filter(
    (indicator) =>
      !deferredIndicatorSearch ||
      `${indicator.title} ${indicator.idApi ?? ""} ${indicator.measureField} ${JSON.stringify(indicator.dimensions)}`
        .toLocaleLowerCase("uk")
        .includes(deferredIndicatorSearch),
  );
  const visibleIndicators =
    deferredIndicatorSearch || showAllIndicators
      ? matchingIndicators
      : matchingIndicators.slice(0, 6);
  const seriesFor = (indicator: DatasetIndicator) => {
    if (seriesWindow === "all" || indicator.series.some((point) => point.label)) {
      return indicator.series;
    }
    if (seriesWindow === "latest-10") return indicator.series.slice(-10);
    return indicator.series.filter(
      (point) => (point.year ?? Number(point.date.slice(0, 4))) >= 2020,
    );
  };
  const peerCodes = ["UKR", "POL", "ROU", "TUR"];
  const peerNames = {
    UKR: { uk: "Україна", en: "Ukraine" },
    POL: { uk: "Польща", en: "Poland" },
    ROU: { uk: "Румунія", en: "Romania" },
    TUR: { uk: "Туреччина", en: "Turkiye" },
  };
  const peerColors = { UKR: "#0057b8", POL: "#ff312e", ROU: "#00a878", TUR: "#f59e0b" };
  const countryCodeFor = (indicator: DatasetIndicator) => String(
    indicator.dimensions.countryCode ??
    indicator.dimensions.country_iso3 ??
    indicator.dimensions.country ??
    "",
  ).toLocaleUpperCase();
  const comparisonGroups = new Map<string, DatasetIndicator[]>();
  for (const indicator of matchingIndicators) {
    const countryCode = countryCodeFor(indicator);
    if (!peerCodes.includes(countryCode)) continue;
    const key = `${indicator.idApi ?? indicator.title}|${indicator.unit}`;
    comparisonGroups.set(key, [...(comparisonGroups.get(key) ?? []), indicator]);
  }
  const comparisonIndicators = [...comparisonGroups.values()]
    .filter((items) => new Set(items.map(countryCodeFor)).size >= 2)
    .sort((left, right) =>
      new Set(right.map(countryCodeFor)).size - new Set(left.map(countryCodeFor)).size ||
      right.reduce((sum, item) => sum + item.series.length, 0) - left.reduce((sum, item) => sum + item.series.length, 0),
    )[0] ?? [];
  const comparisonSeries = peerCodes
    .map((countryCode) => comparisonIndicators.find((indicator) => countryCodeFor(indicator) === countryCode))
    .filter((indicator): indicator is DatasetIndicator => Boolean(indicator))
    .map((indicator) => {
      const countryCode = countryCodeFor(indicator) as keyof typeof peerNames;
      return {
        id: countryCode,
        label: peerNames[countryCode][locale],
        color: peerColors[countryCode],
        data: seriesFor(indicator),
      };
    });
  const graphGroupFor = (indicator: DatasetIndicator) => String(indicator.dimensions.graphGroup ?? "");
  const graphGroupMap = new Map<string, DatasetIndicator[]>();
  for (const indicator of matchingIndicators) {
    const group = graphGroupFor(indicator);
    if (!group) continue;
    graphGroupMap.set(group, [...(graphGroupMap.get(group) ?? []), indicator]);
  }
  const graphGroups = [...graphGroupMap.entries()]
    .map(([group, indicators]) => [group, indicators.filter((indicator) => indicator.series.length > 0)] as const)
    .filter(([, indicators]) => indicators.length > 1 && new Set(indicators.map((indicator) => indicator.unit)).size === 1);
  const graphGroupColors = ["#0057b8", "#ff312e", "#00a878", "#f59e0b", "#7b61ff", "#00bfe9", "#76e000", "#e26d5c"];
  const graphSeriesFor = (indicators: DatasetIndicator[]) => indicators.map((indicator, index) => ({
    id: indicator.id,
    label: localizedIndicatorTitle(dataset, indicator, locale, dataset.indicators.indexOf(indicator)),
    color: String(indicator.dimensions.graphColor ?? graphGroupColors[index % graphGroupColors.length]),
    data: seriesFor(indicator),
  }));
  const comparisonIds = new Set(comparisonIndicators.map((indicator) => indicator.id));
  const leadIndicator =
    comparisonIndicators.find((indicator) => countryCodeFor(indicator) === "UKR") ??
    visibleIndicators[0];
  const leadIndicatorIndex = leadIndicator
    ? dataset.indicators.indexOf(leadIndicator)
    : -1;
  const primaryGraphGroup = leadIndicator
    ? graphGroups.find(([, indicators]) => indicators.some((indicator) => indicator.id === leadIndicator.id))
    : undefined;
  const primaryGraphGroupIndicators = primaryGraphGroup?.[1] ?? [];
  const primaryGraphSeries = primaryGraphGroupIndicators.length > 1
    ? graphSeriesFor(primaryGraphGroupIndicators)
    : comparisonSeries;
  const primaryGraphTitle = primaryGraphGroupIndicators.length > 1
    ? String(leadIndicator?.dimensions[locale === "uk" ? "graphTitleUa" : "graphTitleEn"] ?? localizedIndicatorTitle(dataset, leadIndicator!, locale, leadIndicatorIndex))
    : null;
  const groupedIndicatorIds = new Set(graphGroups.flatMap(([, indicators]) => indicators.map((indicator) => indicator.id)));
  const additionalGraphGroups = graphGroups.filter(([group]) => group !== primaryGraphGroup?.[0]);
  const compactCategoryIndicators = (() => {
    if (comparisonIndicators.length) return [];
    const candidates = matchingIndicators.filter((indicator) =>
      !countryCodeFor(indicator) && indicator.series.length === 1,
    );
    const first = candidates[0]?.series[0];
    if (!first || candidates.length < 2) return [];
    return candidates.every((indicator) =>
      indicator.series[0]?.date === first.date && indicator.unit === candidates[0].unit,
    ) ? candidates.slice(0, 12) : [];
  })();
  const compactCategoryIds = new Set(compactCategoryIndicators.map((indicator) => indicator.id));
  const compactCategoryData = compactCategoryIndicators.map((indicator, index) => ({
    ...indicator.series[0],
    label: localizedIndicatorTitle(
      dataset,
      indicator,
      locale,
      dataset.indicators.indexOf(indicator),
    ),
    color: [color, "#ff312e", "#00a878", "#f59e0b"][index % 4],
  }));
  const exportUrl = (format: "json" | "schema" | "regions" | "csv" | "md") =>
    apiCorner
      ? `/api/v1/ukraine/corners/${sourceCorner}/datasets/${id}/export/${format}`
      : format === "csv"
        ? sourceCorner
          ? cornerDataUrl(sourceCorner, dataset.exports.annualCsv.slice("/data".length))
          : dataUrl(dataset.exports.annualCsv)
        : format === "json"
          ? sourceCorner
            ? cornerDataUrl(sourceCorner, `dataroom/${id}/summary.json`)
            : dataUrl(`/data/dataroom/${id}/summary.json`)
          : format === "schema"
            ? sourceCorner
              ? cornerDataUrl(sourceCorner, `dataroom/${id}/schema.json`)
              : dataUrl(`/data/dataroom/${id}/schema.json`)
            : format === "regions"
              ? sourceCorner
                ? cornerDataUrl(sourceCorner, `dataroom/${id}/regions.json`)
                : dataUrl(`/data/dataroom/${id}/regions.json`)
              : sourceCorner
              ? cornerDataUrl(sourceCorner, `dataroom/${id}/README.md`)
              : dataUrl(`/data/dataroom/${id}/README.md`);

  return (
    <div className="app-shell dataset-page">
      <Masthead generatedAt={dataset.freshness.generatedAt} />
      <main>
        <section className="dataset-hero dataset-hero-compact">
          <div>
            <a className="back-link" href={sourceCorner ? `/corner/${sourceCorner}` : "/#catalogue"}>
              ← {ua ? "Усі набори" : "All datasets"}
            </a>
            <div className="dataset-title-line">
              <code>{dataset.graphCodeBase ?? `UA-${graphPrefixes[datasetSource]}-${String(dataset.number).padStart(4, "0")}`}</code>
              <a className="dataset-short-link" href={publicPath}>
                {publicDatasetId}
              </a>
              {dataset.lineage?.mode === "connected" && (
                <span>{ua ? "пов’язаний графік RI" : "connected RI graph"}</span>
              )}
            </div>
            <div className="dataset-tag-list" aria-label={ua ? "Теги набору" : "Dataset tags"}>
              {datasetTags.map((tag) => (
                <span key={tag.id}>{ua ? tag.labelUa : tag.labelEn}</span>
              ))}
            </div>
          </div>
        </section>

        <section className="dataset-series-filters" aria-label={ua ? "Фільтри серій" : "Series filters"}>
          <label>
            <span>{ua ? "Показник або код" : "Indicator or code"}</span>
            <input
              value={indicatorSearch}
              onChange={(event) => setIndicatorSearch(event.target.value)}
              placeholder={ua ? "назва, код серії…" : "title, series code…"}
            />
          </label>
          <label>
            <span>{ua ? "Період графіків" : "Chart period"}</span>
            <select
              value={seriesWindow}
              onChange={(event) =>
                setSeriesWindow(event.target.value as "all" | "2020" | "latest-10")
              }
            >
              <option value="all">{ua ? "Вся історія" : "Full history"}</option>
              <option value="2020">2020+</option>
              <option value="latest-10">{ua ? "Останні 10 точок" : "Latest 10 points"}</option>
            </select>
          </label>
          {dataset.indicators.length > 6 && !deferredIndicatorSearch && (
            <button
              type="button"
              onClick={() => setShowAllIndicators((current) => !current)}
            >
              {showAllIndicators
                ? ua ? "Перші 6 серій" : "First 6 series"
                : `${ua ? "Усі серії" : "All series"} · ${dataset.indicators.length}`}
            </button>
          )}
          <output>
            {visibleIndicators.length} / {dataset.indicators.length} {ua ? "серій" : "series"}
          </output>
        </section>

        {!leadIndicator && dataset.indicators.length > 0 && (
          <p className="dataset-filter-empty">
            {ua ? "За цим фільтром серій не знайдено." : "No series match this filter."}
          </p>
        )}

        {leadIndicator && (
          <section className="dataset-primary-chart">
            {(() => {
              const leadGraphCode = datasetGraphCode(dataset, datasetSource, 1);
              const compactUnit = compactCategoryIndicators[0]?.unit ?? leadIndicator.unit;
              const compactPeriod = compactCategoryIndicators[0]?.series[0]?.date;
              const useCompactCategories = compactCategoryData.length >= 2;
              return (
            <DataChart
              id={chartAnchor(leadGraphCode)}
              graphCode={leadGraphCode}
              title={useCompactCategories ? title : primaryGraphTitle ?? localizedIndicatorTitle(dataset, leadIndicator, locale, leadIndicatorIndex)}
              subtitle={
                ua
                  ? useCompactCategories
                    ? `Порівняння параметрів за ${formatDate(compactPeriod ?? leadIndicator.date, locale)}. Одиниця: ${compactUnit}.`
                    : primaryGraphGroupIndicators.length > 1
                    ? `${dataset.annualization.replace(/[.]+$/u, "")}. ${primaryGraphGroupIndicators.length} серії в одній одиниці: ${leadIndicator.unit}. Коди: ${primaryGraphGroupIndicators.map((indicator) => indicator.idApi ?? indicator.measureField).join(", ")}.`
                    : `${dataset.annualization.replace(/[.]+$/u, "")}. Назва у джерелі: ${leadIndicator.title}. Код серії: ${leadIndicator.idApi ?? leadIndicator.measureField}.`
                  : useCompactCategories
                    ? `Parameter comparison for ${formatDate(compactPeriod ?? leadIndicator.date, locale)}. Unit: ${compactUnit}.`
                    : primaryGraphGroupIndicators.length > 1
                    ? `${dataset.annualization.replace(/[.]+$/u, "")}. ${primaryGraphGroupIndicators.length} series share one unit: ${leadIndicator.unit}. Series codes: ${primaryGraphGroupIndicators.map((indicator) => indicator.idApi ?? indicator.measureField).join(", ")}.`
                    : `Source label: ${leadIndicator.titleEn ?? leadIndicator.title}. Source annualisation rule applies. Series code: ${leadIndicator.idApi ?? leadIndicator.measureField}.`
              }
              data={useCompactCategories ? compactCategoryData : seriesFor(leadIndicator)}
              color={color}
              unit={useCompactCategories ? compactUnit : leadIndicator.unit}
              formatter={(value, compact) => formatNumber(value, useCompactCategories ? compactUnit : leadIndicator.unit, compact, locale)}
              locale={locale}
              sourceLabel={leadIndicator.sourceLabel}
              sourceUrl={dataset.endpoint}
              annualCsvUrl={exportUrl("csv")}
              markdownUrl={exportUrl("md")}
              comparisonSeries={useCompactCategories ? [] : primaryGraphSeries}
              comparisonLabel={primaryGraphGroupIndicators.length > 1 ? ua ? "Серії" : "Series" : undefined}
              categorical={useCompactCategories}
              sharePath={publicPath}
              featured
            />
              );
            })()}
          </section>
        )}

        <section className="dataset-facts">
          <div>
            <span>{ua ? "Остання дата" : "Latest date"}</span>
            <strong>{formatDate(dataset.freshness.latestDate, locale)}</strong>
          </div>
          <div>
            <span>{ua ? "Первинних рядків" : "Source rows"}</span>
            <strong>{dataset.freshness.rowCount.toLocaleString(ua ? "uk-UA" : "en-GB")}</strong>
          </div>
          <div>
            <span>{ua ? "Параметрів" : "Parameters"}</span>
            <strong>{dataset.schema.length}</strong>
          </div>
          <div>
            <span>{ua ? "Історія" : "History"}</span>
            <strong>
              {dataset.coverageStart
                ? `${ua ? "з" : "since"} ${dataset.coverageStart}`
                : "—"}
            </strong>
          </div>
        </section>

        <section className="dataset-explainer">
          <h2>{ua ? "Зміст показника" : "Indicator definition"}</h2>
          <p>{simpleQuestion}</p>
          {guide?.how && <p>{guide.how}</p>}
          <p>{simpleWhy}</p>
          {guide?.caution && <p>{guide.caution}</p>}
        </section>

        {dataset.lineage && (
          <section className="dataset-lineage">
            <div>
              <h2>{ua ? "Походження ряду" : "Series lineage"}</h2>
              <p>
                {datasetSource === "frames" || datasetSource === "scenarios"
                  ? ua
                    ? "Публікаційний ряд Uconomics: значення нормалізовано з робочої книги Foresight 2040."
                    : "Uconomics publication series: values are normalized from the Foresight 2040 workbook."
                  : dataset.lineage.mode === "native"
                  ? ua
                    ? "Нативний графік RI: розрахунок або структура сформовані всередині RI."
                    : "Native RI graph: its calculation or structure is produced inside RI."
                  : ua
                    ? "Пов’язаний графік RI: ряд збережено у RI, але первинне значення походить з іншого куточка."
                    : "Connected RI graph: RI retains the graph, while the primary observation comes from another corner."}
              </p>
            </div>
            {dataset.lineage.connections?.map((connection) => (
              <a href={connection.url} key={`${connection.corner}-${connection.datasetId ?? connection.label}`}>
                <b>{connection.label}</b>
                <span>{connection.reason}</span>
              </a>
            ))}
          </section>
        )}

        {dataset.indicators.length === 0 && (
          <section className="dataset-facts-only">
            <div className="section-rule">
              <span>01</span>
              <h2>{ua ? "Факти" : "Facts"}</h2>
              <p>
                {ua
                  ? "Числового часового ряду немає; опубліковано вихідний текстовий або якісний зміст набору."
                  : "No numeric time series is available; the published textual or qualitative content is retained as facts."}
              </p>
            </div>
            <div className="dataset-fact-grid">
              {(dataset.fallbackFacts ?? []).map((fact, index) => (
                <FactCard fact={fact} key={`${fact.label}-${fact.period}-${index}`} />
              ))}
            </div>
          </section>
        )}

        {dataset.indicators.length > 0 && <section className="dataset-indicators-section">
          <div className="section-rule">
            <span>01</span>
            <h2>{ua ? "Головні числа" : "Headline figures"}</h2>
            <p>{ua ? "Автоматично відібрані верхньорівневі серії" : "Automatically selected top-level series"}</p>
          </div>
          <div className="dataset-indicator-grid">
            {visibleIndicators.map((indicator) => (
              <IndicatorCard
                key={indicator.id}
                indicator={indicator}
                title={localizedIndicatorTitle(
                  dataset,
                  indicator,
                  locale,
                  dataset.indicators.indexOf(indicator),
                )}
              />
            ))}
          </div>
        </section>}

        {dataset.indicators.length > 0 && <section className="dataset-charts-section">
          <div className="section-rule">
            <span>02</span>
            <h2>{ua ? "Динаміка" : "Dynamics"}</h2>
            <p>{ua ? "Наведіть курсор для точного періоду та значення" : "Hover for the exact period and value"}</p>
          </div>
          <div className="chart-grid">
            {additionalGraphGroups.map(([group, indicators]) => {
              const groupLead = indicators[0];
              const stableIndex = dataset.indicators.indexOf(groupLead);
              const indicatorGraphCode = datasetGraphCode(dataset, datasetSource, stableIndex + 1);
              const groupTitle = String(groupLead.dimensions[locale === "uk" ? "graphTitleUa" : "graphTitleEn"] ?? localizedIndicatorTitle(dataset, groupLead, locale, stableIndex));
              return (
                <DataChart
                  id={chartAnchor(indicatorGraphCode)}
                  key={`group-${group}`}
                  graphCode={indicatorGraphCode}
                  title={groupTitle}
                  subtitle={ua
                    ? `${dataset.annualization.replace(/[.]+$/u, "")}. ${indicators.length} серії в одній одиниці: ${groupLead.unit}. Коди: ${indicators.map((indicator) => indicator.idApi ?? indicator.measureField).join(", ")}.`
                    : `${dataset.annualization.replace(/[.]+$/u, "")}. ${indicators.length} series share one unit: ${groupLead.unit}. Series codes: ${indicators.map((indicator) => indicator.idApi ?? indicator.measureField).join(", ")}.`}
                  data={seriesFor(groupLead)}
                  color={graphGroupColors[0]}
                  unit={groupLead.unit}
                  formatter={(value, compact) => formatNumber(value, groupLead.unit, compact, locale)}
                  locale={locale}
                  sourceLabel={groupLead.sourceLabel}
                  sourceUrl={dataset.endpoint}
                  annualCsvUrl={exportUrl("csv")}
                  markdownUrl={exportUrl("md")}
                  comparisonSeries={graphSeriesFor(indicators)}
                  comparisonLabel={ua ? "Серії" : "Series"}
                  sharePath={publicPath}
                />
              );
            })}
            {visibleIndicators.filter((indicator) => indicator.id !== leadIndicator?.id && !comparisonIds.has(indicator.id) && !compactCategoryIds.has(indicator.id) && !groupedIndicatorIds.has(indicator.id)).map((indicator, index) => {
              const stableIndex = dataset.indicators.indexOf(indicator);
              const indicatorGraphCode = datasetGraphCode(dataset, datasetSource, stableIndex + 1);
              return (
                <DataChart
                  id={chartAnchor(indicatorGraphCode)}
                  key={indicator.id}
                  graphCode={indicatorGraphCode}
                  title={localizedIndicatorTitle(dataset, indicator, locale, stableIndex)}
                  subtitle={
                    ua
                      ? `${dataset.annualization.replace(/[.]+$/u, "")}. Назва у джерелі: ${indicator.title}. Код серії: ${indicator.idApi ?? indicator.measureField}.`
                      : `Source label: ${indicator.titleEn ?? indicator.title}. Source annualisation rule applies. Series code: ${indicator.idApi ?? indicator.measureField}.`
                  }
                  data={seriesFor(indicator)}
                  color={index === 0 ? color : ["#ff312e", "#ffd400", "#76e000", "#00bfe9"][index % 4]}
                  unit={indicator.unit}
                  formatter={(value, compact) => formatNumber(value, indicator.unit, compact, locale)}
                  locale={locale}
                  sourceLabel={indicator.sourceLabel}
                  sourceUrl={dataset.endpoint}
                  annualCsvUrl={exportUrl("csv")}
                  markdownUrl={exportUrl("md")}
                  sharePath={publicPath}
                  featured={index === 0}
                />
              );
            })}
          </div>
        </section>}

        {dataset.regionalPerspective.available && (
          <section className="regional-perspective-section">
            <div className="regional-perspective-copy">
              <h2>{ua ? "Регіональна перспектива" : "Regional perspective"}</h2>
              <p>
                {ua
                  ? dataset.regionalPerspective.description
                  : "The source includes region codes that can be joined to a map of Ukraine without loading every row first."}
              </p>
              <strong>
                {dataset.regionalPerspective.regionCount} {ua ? "регіонів" : "regions"} ·{" "}
                {dataset.regionalPerspective.rowCount.toLocaleString(ua ? "uk-UA" : "en-GB")}{" "}
                {ua ? "рядків" : "rows"} · {dataset.regionalPerspective.seriesCount} {ua ? "серій" : "series"}
              </strong>
              <small>
                Поле <code>{dataset.regionalPerspective.field}</code> ·{" "}
                {dataset.regionalPerspective.codeSystem}
              </small>
            </div>
            <div className="regional-perspective-index">
              <p>
                {ua
                  ? dataset.regionalPerspective.joinNote
                  : "Use the published region code as the map join key; inspect the source definition before aggregating."}
              </p>
              <div className="region-chips" aria-label={ua ? "Опубліковані регіони" : "Published regions"}>
                {dataset.regionalPerspective.regions.map((region) => (
                  <span key={region.code}>
                    <b>{region.code}</b>
                    {region.name}
                  </span>
                ))}
              </div>
              {dataset.exports.regionsJson && (
                <a
                  className="regional-download"
                  href={exportUrl("regions")}
                  download
                >
                  {ua ? "Завантажити map-ready індекс JSON" : "Download map-ready JSON index"} →
                </a>
              )}
            </div>
          </section>
        )}

      </main>
      <SiteFooter />
    </div>
  );
}

function CoveragePage() {
  const { locale } = useSettings();
  const ua = locale === "uk";
  const [coverage, setCoverage] = useState<CoverageReport | null>(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search.trim().toLocaleLowerCase("uk"));

  useEffect(() => {
    fetch(dataUrl("/data/dataroom/coverage-report.json"))
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<CoverageReport>;
      })
      .then(setCoverage)
      .catch((loadError: Error) => setError(loadError.message));
  }, []);

  if (error) return <PageState title={ua ? "Аудит недоступний." : "Audit unavailable."} detail={error} />;
  if (!coverage) return <PageState title={ua ? "Перевіряємо джерела…" : "Checking sources…"} />;

  const datasets = coverage.datasets.filter(
    (dataset) =>
      !deferredSearch ||
      `${dataset.title} ${dataset.id} ${dataset.sources
        .map((source) => `${source.label} ${source.description}`)
        .join(" ")}`
        .toLocaleLowerCase("uk")
        .includes(deferredSearch),
  );

  return (
    <div className="app-shell coverage-page">
      <Masthead generatedAt={coverage.generatedAt} />
      <main>
        <section className="coverage-hero">
          <h1>{ua ? "Аудит покриття даних" : "Data coverage audit"}</h1>
          <p>
            {ua
              ? "Офіційні підджерела, останні дати, кількість рядків, історичний кеш і прогалини. Відсутні спостереження не замінюються нулями."
              : "Official sub-sources, latest dates, row counts, historical cache and gaps. Missing observations are never replaced with zeroes."}
          </p>
          <div className="coverage-stats">
            <div>
              <strong>{coverage.datasetCount}</strong>
              <span>{ua ? "аналітичних наборів" : "analytical datasets"}</span>
            </div>
            <div>
              <strong>{coverage.sourceCount}</strong>
              <span>{ua ? "API-підджерел" : "API sub-sources"}</span>
            </div>
            <div>
              <strong>{coverage.regionalDatasetCount}</strong>
              <span>{ua ? "регіональні набори" : "regional datasets"}</span>
            </div>
            <div>
              <strong>100%</strong>
              <span>{ua ? "мають опублікований зріз" : "have a published slice"}</span>
            </div>
          </div>
        </section>

        <section className="coverage-index">
          <div className="schema-heading">
            <div>
              <h2>{ua ? "Набір за набором" : "Dataset by dataset"}</h2>
            </div>
            <label className="search-field">
              <span>{ua ? "Пошук у звіті" : "Search audit"}</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={ua ? "праця, ВВП, квартал…" : "labour, GDP, quarter…"}
              />
            </label>
          </div>
          <div className="coverage-datasets">
            {datasets.map((dataset) => (
              <details key={dataset.id} open={dataset.id === "macro-indicators"}>
                <summary>
                  <span>{String(dataset.number).padStart(2, "0")}</span>
                  <div>
                    <h3>{localizedDatasetTitle({ title: dataset.title }, locale)}</h3>
                    <small>
                      {dataset.sources.length} {ua ? "підджерел" : "sub-sources"} ·{" "}
                      {dataset.latestRows.toLocaleString(ua ? "uk-UA" : "en-GB")} {ua ? "рядків" : "rows"}
                      {dataset.regionalPerspective.available
                        ? ` · ${dataset.regionalPerspective.regionCount} ${ua ? "регіонів" : "regions"}`
                        : ""}
                    </small>
                  </div>
                  <strong>{formatDate(dataset.latestDate, locale)}</strong>
                </summary>
                <div className="coverage-source-grid">
                  {dataset.sources.map((source) => (
                    <article key={source.id}>
                      <span className="coverage-status">{ua ? "Включено" : "Included"}</span>
                      <h4>{localizedDatasetTitle({ title: source.label }, locale)}</h4>
                      <p>
                        {ua
                          ? source.description
                          : `Published observations retain the source dates, values, units and identifiers for this series.`}
                      </p>
                      <dl>
                        <div>
                          <dt>{ua ? "Доступність" : "Availability"}</dt>
                          <dd>{ua ? source.availability : `${source.cache.rows.toLocaleString("en-GB")} normalized observations`}</dd>
                        </div>
                        <div>
                          <dt>{ua ? "Забрано зараз" : "Current ingest"}</dt>
                          <dd>
                            {source.latestRows.toLocaleString(ua ? "uk-UA" : "en-GB")} {ua ? "рядків" : "rows"}{" "}
                            {ua ? "від" : "dated"} {formatDate(source.latestDate, locale)}
                          </dd>
                        </div>
                        <div>
                          <dt>{ua ? "Історія" : "History"}</dt>
                          <dd>
                            {source.annualSnapshots.count
                              ? `${source.annualSnapshots.firstYear}–${source.annualSnapshots.lastYear}: ${source.annualSnapshots.rows.toLocaleString(ua ? "uk-UA" : "en-GB")} ${ua ? "кешованих рядків" : "cached rows"}`
                              : `${source.chartedPoints} ${ua ? "точок у часових рядах" : "time-series points"}`}
                          </dd>
                        </div>
                      </dl>
                      {source.limitation && (
                        <p className="coverage-limitation">
                          {ua
                            ? `Не вдалося отримати: ${source.limitation}`
                            : "Gap: the source has missing periods or parameters that require review before comparison."}
                        </p>
                      )}
                      <a href={source.latestUrl} target="_blank" rel="noreferrer">
                        {ua ? "Перевірити запит джерела" : "Inspect source request"} ↗
                      </a>
                    </article>
                  ))}
                </div>
              </details>
            ))}
          </div>
          <div className="export-links coverage-downloads">
            <a
              href={dataUrl("/data/dataroom/coverage-report.json")}
              download
            >
              {ua ? "Аудит JSON" : "Audit JSON"}
            </a>
            <a
              href={dataUrl("/data/dataroom/coverage-report.md")}
              download
            >
              {ua ? "Аудит Markdown" : "Audit Markdown"}
            </a>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

function ReportPage({
  id,
  sourceCorner,
}: {
  id: string;
  sourceCorner?: DataCornerKey;
}) {
  const { locale } = useSettings();
  const [report, setReport] = useState<ComparisonReport | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const reportUrl = sourceCorner
      ? sourceCorner === "uconomics"
        ? cornerDataUrl(sourceCorner, `reports/${id}.json`)
        : isLocal
          ? `/data/${sourceCorner}/reports/${id}.json`
          : `/api/corners/${sourceCorner}/data/reports/${id}.json`
      : dataUrl(`/data/reports/${id}.json`);
    fetch(reportUrl)
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<ComparisonReport>;
      })
      .then(setReport)
      .catch((loadError: Error) => setError(loadError.message));
  }, [id, sourceCorner]);

  if (error) return <PageState title={locale === "uk" ? "Звіт не знайдено." : "Report not found."} detail={error} />;
  if (!report) return <PageState title={locale === "uk" ? "Відкриваємо звіт…" : "Opening report…"} />;
  const ua = locale === "uk";
  const periodNames: Record<ComparisonReport["period"], string> = {
    annual: "Annual comparison",
    quarterly: "Quarterly comparison",
    monthly: "Monthly comparison",
    daily: "Daily signal",
  };
  const observationNames: Record<string, string> = {
    "Інфляція р/р": "Inflation y/y",
    "Середній USD/UAH": "Average USD/UAH",
    "Міжнародні резерви": "International reserves",
    "Грошова маса M3": "Broad money M3",
    "Кредити": "Loans",
    "Депозити": "Deposits",
    "Середня UONIA": "Average UONIA",
    "UONIA": "UONIA",
    "Swap-індекс": "Swap index",
    "Облікова ставка": "Key policy rate",
  };
  const localizedObservationLabel = (value: string) =>
    ua
      ? value
      : observationNames[value] ??
        (
          titleTranslations as Record<string, { uk: string; en: string }>
        )[value]?.en ??
        value;
  const localizedReportTitle = ua ? report.title : periodNames[report.period];
  const localizedReportDeck = ua
    ? report.deck
    : report.period === "annual"
      ? "Matching calendar windows keep a complete prior year separate from an incomplete current year."
      : report.period === "monthly"
        ? "The two latest complete monthly observations show the direction and scale of change."
        : report.period === "quarterly"
          ? "The two latest comparable quarters are shown with their units and publication limits."
          : "High-frequency observations show an early market signal, not a complete economic conclusion.";
  const localizedBrief = ua
    ? report.brief
    : report.lead
      ? `${localizedObservationLabel(report.lead.label)}: ${formatNumber(report.lead.current, report.lead.unit, false, locale)}; change ${formatDelta(report.lead, locale)}.`
      : "No new comparable observation has been published.";
  const localizedNotes = ua
    ? report.notes
    : report.period === "annual"
      ? ["Daily rates are averaged over matching calendar windows.", "Monthly indicators are compared at the same reporting month."]
      : report.period === "monthly"
        ? ["Stocks are compared between reporting dates, not added together.", "Percentage rates are compared in percentage points."]
        : report.period === "quarterly"
          ? ["Quarterly flows and stocks retain the source definition and unit.", "A large movement should be checked against seasonality and revisions."]
          : ["A day or week is compared only where the required observations exist.", "Missing observations remain missing and are never converted to zero."];

  return (
    <div className="app-shell report-page">
      <Masthead generatedAt={report.generatedAt} />
      <main>
        <section className="report-hero">
          <a className="back-link" href={sourceCorner ? `/corner/${sourceCorner}` : "/#reports"}>
            ← {ua ? "Усі звіти" : "All reports"}
          </a>
          <span className="report-kicker">{ua ? report.kicker : periodNames[report.period]}</span>
          <h1>{localizedReportTitle}</h1>
          <p>{localizedReportDeck}</p>
          <blockquote>{localizedBrief}</blockquote>
        </section>
        <section className="report-observations">
          {report.observations.map((observation) => (
            <article
              className={`report-observation signal-${observation.level}`}
              key={observation.id}
            >
              <span>{localizedObservationLabel(observation.label)}</span>
              <div>
                <small>{ua ? "Було" : "Previous"} · {formatDate(observation.previousDate, locale)}</small>
                <strong>
                  {formatNumber(observation.previous, observation.unit)}
                </strong>
              </div>
              <div>
                <small>{ua ? "Стало" : "Current"} · {formatDate(observation.currentDate, locale)}</small>
                <strong>
                  {formatNumber(observation.current, observation.unit)}
                </strong>
              </div>
              <div>
                <small>{ua ? "Зміна" : "Change"}</small>
                <strong>{formatDelta(observation, locale)}</strong>
              </div>
              <p>
                {ua
                  ? observation.insight
                  : `${localizedObservationLabel(observation.label)} is ${formatNumber(observation.current, observation.unit, false, locale)} at the latest comparable date.`}
              </p>
            </article>
          ))}
        </section>
        <section className="report-notes">
          <h2>{locale === "uk" ? "Як читати" : "How to read"}</h2>
          {localizedNotes.map((note) => (
            <p key={note}>{note}</p>
          ))}
          <a
            href={
              sourceCorner
                ? isLocal
                  ? sourceCorner === "uconomics"
                    ? cornerDataUrl(sourceCorner, `reports/${report.id}.md`)
                    : `/data/${sourceCorner}/reports/${report.id}.md`
                  : sourceCorner === "uconomics"
                    ? cornerDataUrl(sourceCorner, `reports/${report.id}.md`)
                    : `/api/corners/${sourceCorner}/data/reports/${report.id}.md`
                : dataUrl(`/data/reports/${report.id}.md`)
            }
            download
          >
            {ua ? "Завантажити Markdown" : "Download Markdown"} →
          </a>
        </section>
        {report.datasetGuides && report.datasetGuides.length > 0 && (
          <section className="report-dataset-guides">
            <h2>{locale === "uk" ? "Пояснення наборів" : "Dataset explanations"}</h2>
            <div>
              {report.datasetGuides.map((dataset) => {
                const guide = dataset.readerGuide?.[locale === "uk" ? "ua" : "en"];
                return (
                  <article key={dataset.id}>
                    <span>{dataset.id}</span>
                    <h3>{locale === "uk" ? dataset.titleUa : dataset.titleEn}</h3>
                    {guide && (
                      <>
                        <p>{guide.what}</p>
                        <p>{guide.how}</p>
                        <p>{guide.use}</p>
                        <small>{guide.caution}</small>
                      </>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}

function ArticleFigure({ article }: { article: (typeof magazineArticles)[number] }) {
  const { locale } = useSettings();
  const ua = locale === "uk";
  return (
    <figure className="magazine-figure">
      <figcaption>
        <span>{article.number}</span>
        <h2>{ua ? article.chart.titleUa : article.chart.titleEn}</h2>
        <p>{ua ? article.chart.noteUa : article.chart.noteEn}</p>
      </figcaption>
      <LineChart
        data={article.chart.points}
        color={article.chart.color}
        unit={article.chart.unit}
        view={article.chart.view}
        locale={locale}
        formatter={(value, compact) =>
          formatNumber(value, article.chart.unit === "USD bn" ? "" : article.chart.unit, compact, locale)
        }
      />
    </figure>
  );
}

function MagazinePage() {
  const { locale } = useSettings();
  const ua = locale === "uk";
  const [lead, ...articles] = magazineArticles;
  return (
    <div className="app-shell magazine-page">
      <Masthead />
      <main>
        <section className="magazine-mast">
          <div>
            <h1>{ua ? "Журнал даних" : "Data magazine"}</h1>
            <p>
              {ua
                ? "Економічні зміни України у річному, місячному й тижневому масштабі. Факти відокремлено від оцінок; прогалини та прогнози позначено."
                : "Ukraine’s economic changes at annual, monthly and weekly scales. Facts are separated from interpretation; gaps and forecasts are labelled."}
            </p>
          </div>
          <time dateTime="2026-07-30">{formatDate("2026-07-30", locale)}</time>
        </section>

        <section className="magazine-lead">
          <a href={`/magazine/${lead.slug}`}>
            <div>
              <span>{lead.number} · {ua ? lead.periodUa : lead.periodEn}</span>
              <h2>{ua ? lead.titleUa : lead.titleEn}</h2>
              <p>{ua ? lead.standfirstUa : lead.standfirstEn}</p>
              <strong>{ua ? "Читати матеріал" : "Read article"} →</strong>
            </div>
            <MiniChart data={lead.chart.points} color={lead.chart.color} />
          </a>
        </section>

        <section className="magazine-index">
          {articles.map((article) => (
            <a href={`/magazine/${article.slug}`} key={article.slug}>
              <header>
                <span>{article.number}</span>
                <time dateTime={article.publishedAt}>{formatDate(article.publishedAt, locale)}</time>
              </header>
              <h2>{ua ? article.titleUa : article.titleEn}</h2>
              <p>{ua ? article.standfirstUa : article.standfirstEn}</p>
              <MiniChart data={article.chart.points} color={article.chart.color} />
              <small>{ua ? article.periodUa : article.periodEn}</small>
            </a>
          ))}
        </section>

        <section className="magazine-method">
          <h2>{ua ? "Редакційний принцип" : "Editorial method"}</h2>
          <p>
            {ua
              ? "Матеріали генеруються з опублікованих рядів, а потім перевіряються за періодом, одиницею, базою порівняння та першоджерелом. Один рух показника не подається як доказ причини."
              : "Articles are generated from published series, then checked for period, unit, comparison basis and primary source. A single movement is never presented as proof of causality."}
          </p>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

function MagazineArticlePage({ slug }: { slug: string }) {
  const { locale } = useSettings();
  const ua = locale === "uk";
  const article = magazineArticle(slug);
  if (!article) {
    return <PageState title={ua ? "Матеріал не знайдено." : "Article not found."} />;
  }
  const paragraphs = ua ? article.paragraphsUa : article.paragraphsEn;
  return (
    <div className="app-shell magazine-article-page">
      <Masthead />
      <main>
        <article>
          <header className="article-header">
            <a href="/magazine">← {ua ? "Усі матеріали" : "All articles"}</a>
            <div>
              <span>{article.number} · {ua ? article.periodUa : article.periodEn}</span>
              <time dateTime={article.publishedAt}>{formatDate(article.publishedAt, locale)}</time>
            </div>
            <h1>{ua ? article.titleUa : article.titleEn}</h1>
            <p>{ua ? article.standfirstUa : article.standfirstEn}</p>
          </header>

          <section className="article-figures" aria-label={ua ? "Ключові числа" : "Key figures"}>
            {article.figures.map((figure) => (
              <div key={figure.labelEn}>
                <span>{ua ? figure.labelUa : figure.labelEn}</span>
                <strong>{figure.value}</strong>
                <small>{ua ? figure.noteUa : figure.noteEn}</small>
              </div>
            ))}
          </section>

          <ArticleFigure article={article} />

          <section className="article-body">
            {paragraphs.map((paragraph, index) => (
              <p key={paragraph} className={index === 0 ? "article-dropcap" : undefined}>
                {paragraph}
              </p>
            ))}
          </section>

          <section className="article-links">
            <div>
              <h2>{ua ? "Пов’язані дані" : "Related data"}</h2>
              {article.related.map((item) => (
                <a href={item.href} key={item.href}>
                  {ua ? item.labelUa : item.labelEn} →
                </a>
              ))}
            </div>
            <div>
              <h2>{ua ? "Джерела і контекст" : "Sources and context"}</h2>
              {article.sources.map((source) => (
                <a href={source.url} target="_blank" rel="noreferrer" key={source.url}>
                  <span>{source.publisher}</span>
                  {ua ? source.labelUa : source.labelEn} ↗
                </a>
              ))}
            </div>
          </section>
        </article>
      </main>
      <SiteFooter />
    </div>
  );
}

function ApiDocsPage() {
  const { locale } = useSettings();
  const ua = locale === "uk";
  const endpoints = [
    ["GET", "/api/v1/ukraine/corners", ua ? "Усі 13 джерел та їх покриття" : "All thirteen sources and their coverage"],
    ["GET", "/api/v1/ukraine/corners/imf/datasets?limit=50&q=gdp", ua ? "Пошук і пагінація наборів" : "Search and paginate datasets"],
    ["GET", "/api/v1/ukraine/corners/imf/datasets/ngdp_rpch/series?start_year=2020", ua ? "Обмежений ряд для графіка чи моделі" : "A bounded series for a chart or model"],
    ["GET", "/api/v1/ukraine/frames/2026", ua ? "Макроекономічний кадр 2026" : "The 2026 macroeconomic frame"],
    ["GET", "/api/v1/ukraine/forecasts", ua ? "Опубліковані прогнози та прогалини" : "Published forecasts and coverage gaps"],
    ["GET", "/api/v1/ukraine/reports/latest", ua ? "Останній автоматичний звіт" : "Latest automated update report"],
  ];
  const example = `curl "https://ukraine.proto.fund/api/v1/ukraine/corners/imf/datasets/ngdp_rpch/series?start_year=2020&end_year=2031"`;

  return (
    <div className="app-shell api-docs-page">
      <Masthead />
      <main>
        <section className="api-hero">
          <h1>Ukraine Data API</h1>
          <p>
            {ua
              ? "13 джерел, набори даних, часові ряди, річні кадри, прогнози та файли експорту."
              : "Thirteen sources, datasets, time series, annual frames, forecasts and export files."}
          </p>
          <div className="api-hero-actions">
            <a href="/api/v1/ukraine/openapi.json">{ua ? "Відкрити OpenAPI 3.1" : "Open OpenAPI 3.1"}</a>
            <a href="/api/v1/ukraine">{ua ? "Перевірити API index" : "Inspect API index"}</a>
            <a href="/developers/widgets">{ua ? "Приклади віджетів" : "Widget examples"}</a>
          </div>
        </section>

        <section className="api-endpoints">
          <div className="section-rule">
            <h2>{ua ? "Основні endpoints" : "Core endpoints"}</h2>
            <p>{ua ? "JSON envelope: data, meta, links" : "JSON envelope: data, meta, links"}</p>
          </div>
          <div className="endpoint-list">
            {endpoints.map(([method, path, description]) => (
              <a href={path} key={path}>
                <span>{method}</span>
                <code>{path}</code>
                <p>{description}</p>
              </a>
            ))}
          </div>
        </section>

        <section className="api-example">
          <div>
            <h2>{ua ? "Запит часового ряду" : "Time-series request"}</h2>
            <p>
              {ua
                ? "Фільтруйте роки на API, щоб не переносити зайві дані. Для великих первинних зрізів використовуйте export endpoint."
                : "Filter years at the API so clients do not transfer unnecessary data. Use the export endpoint for source-level files."}
            </p>
          </div>
          <pre><code>{example}</code></pre>
        </section>

        <section className="api-contract">
          <h2>{ua ? "Публічний доступ і межі" : "Public access and boundaries"}</h2>
          <p>
            {ua
              ? "Публічні GET-запити не потребують ключа. Операції оновлення не входять до публічного контракту API."
              : "Public GET requests require no key. Update operations are outside the public API contract."}
          </p>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

function SiteFooter() {
  const { locale } = useSettings();
  const ua = locale === "uk";
  const sourceKey = activeSourceKey();
  const source = cornerConfigs[sourceKey];
  const sourceLabel = sourceKey === "ukraine"
    ? ua ? "13 джерел даних" : "13 data sources"
    : isSourceCorner(sourceKey)
      ? cornerMenuTitles[sourceKey][locale]
      : source.sourceShort;
  return (
    <footer className="site-footer">
      <a className="brand footer-brand" href="https://ukraine.proto.fund" aria-label={ua ? "Економіка України" : "Ukraine economy"}>
        <img className="brand-logo" src={dataUkraineLogoUrl} alt="" />
      </a>
      <p>
        {ua
          ? `${sourceLabel}: визначення, періоди, одиниці виміру та первинні джерела.`
          : `${sourceLabel}: definitions, periods, units and primary sources.`}
      </p>
      <a
        href={source.sourceUrl}
        target="_blank"
        rel="noreferrer"
        className="source-link"
      >
        {sourceKey === "ukraine"
          ? ua ? "Огляд джерел" : "Source overview"
          : ua ? "Первинне джерело" : "Primary source"} ↗
      </a>
    </footer>
  );
}

function useGraphAlias(shortId: string) {
  const [record, setRecord] = useState<GraphAliasRecord | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const normalized = normalizePublicDatasetId(shortId);
    fetch(aliasIndexUrl(), {
      signal: AbortSignal.timeout(datasetRequestTimeoutMs),
    })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<{ byShortId: Record<string, GraphAliasRecord> }>;
      })
      .then((payload) => {
        if (cancelled) return;
        const next = payload.byShortId[normalized] ?? null;
        if (!next) {
          setError("not-found");
          return;
        }
        setRecord(next);
      })
      .catch((loadError: Error) => {
        if (!cancelled) setError(loadError.message);
      });
    return () => {
      cancelled = true;
    };
  }, [shortId]);

  return { record, error };
}

function DatasetAliasPage({ shortId }: { shortId: string }) {
  const { locale } = useSettings();
  const ua = locale === "uk";
  const { record, error } = useGraphAlias(shortId);

  if (error === "not-found") {
    return <PageState title={ua ? "Графік не знайдено." : "Graph not found."} />;
  }
  if (error) {
    return <PageState title={ua ? "Ідентифікатор недоступний." : "Identifier unavailable."} detail={error} />;
  }
  if (!record) return <PageState title={ua ? "Відкриваємо графік…" : "Opening graph…"} />;
  return <DatasetPage sourceCorner={record.corner as DataCornerKey} id={record.datasetId} />;
}

function EmbedGraphPage({ shortId }: { shortId: string }) {
  const { locale } = useSettings();
  const ua = locale === "uk";
  const { record, error } = useGraphAlias(shortId);
  const [dataset, setDataset] = useState<DatasetSummary | null>(null);
  const [datasetError, setDatasetError] = useState("");

  useEffect(() => {
    if (!record) return;
    let cancelled = false;
    setDataset(null);
    setDatasetError("");
    const source = record.corner as DataCornerKey;
    const apiCorner = !isStaticCorner(source);
    const summaryUrl = apiCorner
      ? `/api/v1/ukraine/corners/${source}/datasets/${record.datasetId}`
      : cornerDataUrl(source, `dataroom/${record.datasetId}/summary.json`);
    const requestInit: RequestInit = {
      signal: AbortSignal.timeout(datasetRequestTimeoutMs),
    };
    if (apiCorner) requestInit.cache = "no-store";
    fetch(summaryUrl, requestInit)
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((payload) => {
        if (!cancelled) setDataset(readDatasetSummary(payload));
      })
      .catch((loadError: Error) => {
        if (!cancelled) setDatasetError(loadError.message);
      });
    return () => {
      cancelled = true;
    };
  }, [record]);

  if (error === "not-found") {
    return <PageState title={ua ? "Графік не знайдено." : "Graph not found."} />;
  }
  if (error) {
    return <PageState title={ua ? "Віджет недоступний." : "Widget unavailable."} detail={error} />;
  }
  if (datasetError) {
    return <PageState title={ua ? "Віджет недоступний." : "Widget unavailable."} detail={datasetError} />;
  }
  if (!record || !dataset) return <PageState title={ua ? "Відкриваємо віджет…" : "Opening widget…"} />;

  const indicator = dataset.indicators[0];
  const datasetSource = record.corner as DataCornerKey;
  if (!indicator) {
    return (
      <div className="embed-shell">
        <article className="embed-fact-card">
          <code>{dataset.graphCodeBase ?? record.graphCodeBase}</code>
          <h1>{localizedDatasetTitle(dataset, locale)}</h1>
          <p>{ua ? "Для цього набору немає числового ряду. Показано збережені якісні факти." : "This dataset has no numeric series. Retained qualitative facts are shown."}</p>
          <div className="dataset-fact-grid">
            {(dataset.fallbackFacts ?? []).map((fact, index) => <FactCard fact={fact} key={`${fact.label}-${index}`} />)}
          </div>
        </article>
      </div>
    );
  }
  const graph = datasetGraphCode(dataset, datasetSource, 1);
  return (
    <div className="embed-shell">
      <DataChart
        id={chartAnchor(graph)}
        graphCode={graph}
        title={localizedIndicatorTitle(dataset, indicator, locale, 0)}
        subtitle={ua
          ? `${dataset.annualization.replace(/[.]+$/u, "")}. Код серії: ${indicator.idApi ?? indicator.measureField}.`
          : `Series code: ${indicator.idApi ?? indicator.measureField}.`}
        data={indicator.series}
        color={categoryColors[dataset.category] ?? "#0057b8"}
        unit={indicator.unit}
        formatter={(value, compact) => formatNumber(value, indicator.unit, compact, locale)}
        locale={locale}
        sourceLabel={indicator.sourceLabel}
        sourceUrl={dataset.endpoint}
        compact
        sharePath={`/id/${normalizePublicDatasetId(shortId)}`}
      />
    </div>
  );
}

function WidgetExamplesPage() {
  const { locale } = useSettings();
  const ua = locale === "uk";
  const [sample, setSample] = useState<GraphAliasRecord | null>(null);

  useEffect(() => {
    fetch(aliasIndexUrl())
      .then((response) => response.json() as Promise<{ byShortId: Record<string, GraphAliasRecord> }>)
      .then((payload) => {
        setSample(
          payload.byShortId["wb-0029"] ??
          payload.byShortId["oecd-0001"] ??
          Object.values(payload.byShortId)[0] ??
          null,
        );
      })
      .catch(() => setSample(null));
  }, []);

  const shortId = sample?.shortId ?? "wb-0029";
  const iframeSrc = `https://ukraine.proto.fund/embed/${shortId}?lang=${locale}`;
  const pageSrc = `https://ukraine.proto.fund/id/${shortId}?lang=${locale}`;

  return (
    <div className="app-shell widget-page">
      <Masthead />
      <main>
        <section className="api-hero widget-hero">
          <h1>{ua ? "Інтеграція графіків" : "Graph integration"}</h1>
          <p>
            {ua
              ? "Стандартний публічний ідентифікатор графіка: `ukraine.proto.fund/id/{corner-code}-{dataset-number}`. Для вбудовування використовуйте `/embed/`."
              : "Public standard graph identifier: `ukraine.proto.fund/id/{corner-code}-{dataset-number}`. Use `/embed/` for integration."}
          </p>
        </section>

        <section className="widget-lab">
          <div className="widget-example-copy">
            <h2>{ua ? "Канонічна адреса" : "Canonical address"}</h2>
            <code>{pageSrc}</code>
            <h2>{ua ? "Iframe-віджет" : "Iframe widget"}</h2>
            <code>{`<iframe src="${iframeSrc}" loading="lazy" style="width:100%;height:720px;border:0;"></iframe>`}</code>
          </div>
          <div className="widget-preview-frame">
            <iframe title="ProtoFund graph widget" src={iframeSrc} loading="lazy" />
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

function UconomicsCornerPage() {
  const { locale } = useSettings();
  const ua = locale === "uk";
  return (
    <div className="app-shell uconomics-page">
      <Masthead />
      <main>
        <section className="api-hero widget-hero">
          <a className="back-link" href="https://ukraine.proto.fund">← {ua ? "Ukraine Dataroom" : "Ukraine Dataroom"}</a>
          <h1>Uconomics</h1>
          <p>
            {ua
              ? "Порожній куток створено. На наступному кроці сюди можна підключити новий аналітичний корпус, окремі набори та editorial-логіку."
              : "An empty corner is now reserved. The next step can plug in the new analytical corpus, dedicated datasets and editorial logic here."}
          </p>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

function route() {
  if (/^\/frames\/?$/.test(window.location.pathname)) return <FramesPage />;
  const widgetMatch = window.location.pathname.match(/^\/developers\/widgets\/?$/);
  if (widgetMatch) return <WidgetExamplesPage />;
  const magazineArticleMatch = window.location.pathname.match(/^\/magazine\/([^/]+)\/?$/);
  if (magazineArticleMatch) {
    return <MagazineArticlePage slug={magazineArticleMatch[1]} />;
  }
  if (/^\/magazine\/?$/.test(window.location.pathname)) {
    return <MagazinePage />;
  }
  if (/^\/developers\/?$/.test(window.location.pathname)) {
    return <ApiDocsPage />;
  }
  if (/^\/coverage\/?$/.test(window.location.pathname)) {
    return <CoveragePage />;
  }
  const embedMatch = window.location.pathname.match(/^\/embed\/([^/]+)\/?$/);
  if (embedMatch) return <EmbedGraphPage shortId={embedMatch[1]} />;
  const aliasMatch = window.location.pathname.match(/^\/id\/([^/]+)\/?$/);
  if (aliasMatch) return <DatasetAliasPage shortId={aliasMatch[1]} />;
  if (/^\/corner\/uconomics\/?$/.test(window.location.pathname)) {
    return <UniversalCornerCataloguePage source="uconomics" />;
  }
  const universalDatasetMatch = window.location.pathname.match(
    /^\/corner\/([^/]+)\/dataset\/([^/]+)\/?$/,
  );
  if (universalDatasetMatch && isDataCorner(universalDatasetMatch[1])) {
    if (isPublicDatasetAlias(universalDatasetMatch[2])) {
      return <DatasetAliasPage shortId={universalDatasetMatch[2]} />;
    }
    return (
      <DatasetPage
        sourceCorner={universalDatasetMatch[1]}
        id={universalDatasetMatch[2]}
      />
    );
  }
  const universalReportMatch = window.location.pathname.match(
    /^\/corner\/([^/]+)\/report\/([^/]+)\/?$/,
  );
  if (universalReportMatch && isDataCorner(universalReportMatch[1])) {
    return (
      <ReportPage
        sourceCorner={universalReportMatch[1]}
        id={universalReportMatch[2]}
      />
    );
  }
  const universalCornerMatch = window.location.pathname.match(
    /^\/corner\/([^/]+)\/?$/,
  );
  if (universalCornerMatch && isDataCorner(universalCornerMatch[1])) {
    return <UniversalCornerCataloguePage source={universalCornerMatch[1]} />;
  }
  const datasetMatch = window.location.pathname.match(/^\/dataset\/([^/]+)\/?$/);
  if (datasetMatch) return <DatasetPage id={datasetMatch[1]} />;
  const reportMatch = window.location.pathname.match(/^\/report\/([^/]+)\/?$/);
  if (reportMatch) return <ReportPage id={reportMatch[1]} />;
  if (cornerKey === "ukraine") return <UniversalHomePage />;
  return <HomePage />;
}

export default function App() {
  const queryLocale = new URLSearchParams(window.location.search).get("lang");
  const [locale, setLocale] = useState<Locale>(() => {
    if (queryLocale === "en" || queryLocale === "uk") return queryLocale;
    const saved = window.localStorage.getItem("protofund.locale");
    if (saved === "en" || saved === "uk") return saved;
    return navigator.language.toLowerCase().startsWith("uk") ? "uk" : "en";
  });
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = window.localStorage.getItem("protofund.theme");
    if (saved === "day" || saved === "night") return saved;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "night" : "day";
  });

  useEffect(() => {
    const source = cornerConfigs[activeSourceKey()];
    const articleSlug = window.location.pathname.match(/^\/magazine\/([^/]+)\/?$/)?.[1];
    const article = articleSlug ? magazineArticle(articleSlug) : null;
    document.title = article
      ? `${locale === "uk" ? article.titleUa : article.titleEn} · ${locale === "uk" ? "Журнал даних" : "Data magazine"}`
      : /^\/magazine\/?$/.test(window.location.pathname)
        ? (locale === "uk" ? "Журнал даних України" : "Ukraine data magazine")
        : /^\/frames\/?$/.test(window.location.pathname)
          ? (locale === "uk" ? "Кадри та прогнозні сценарії" : "Frames and forecast scenarios")
        : activeSourceKey() === "ukraine"
          ? (locale === "uk" ? "Економіка України" : "Ukraine economy")
          : `${source.mark} · ${source.sourceShort}`;
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute("content", `${source.source}: ${source.deck}`);
    document.documentElement.dataset.theme = theme;
    document.documentElement.lang = locale === "uk" ? "uk" : "en";
    window.localStorage.setItem("protofund.locale", locale);
    window.localStorage.setItem("protofund.theme", theme);
  }, [locale, theme]);

  return (
    <SettingsContext.Provider value={{ locale, setLocale, theme, setTheme }}>
      {route()}
    </SettingsContext.Provider>
  );
}
