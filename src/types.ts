export type SeriesPoint = {
  date: string;
  year?: number;
  label?: string;
  value: number;
  partial?: boolean;
  asOf?: string | null;
  gapBefore?: boolean;
  forecast?: boolean;
};

export type Metric = {
  id: string;
  title: string;
  shortTitle: string;
  category: string;
  unit: string;
  format: "decimal" | "percent" | "uah_billion" | "usd_billion";
  color: string;
  current: number;
  currentDate: string;
  currentPartial?: boolean;
  quality?: SeriesQuality;
  previous: number | null;
  previousDate: string | null;
  deltaAbs: number | null;
  deltaPct: number | null;
  comparisonLabel: string;
  annualization: string;
  coverageStart: string;
  series: SeriesPoint[];
};

export type SeriesQuality = {
  status: "comparable" | "review";
  comparable: boolean;
  flags: string[];
};

export type ReaderGuide = {
  ua: {
    what: string;
    how: string;
    use: string;
    caution: string;
  };
  en: {
    what: string;
    how: string;
    use: string;
    caution: string;
  };
};

export type DatasetLineage = {
  mode: "native" | "connected";
  originalId?: string;
  originalTitle?: string;
  bucket?: string;
  connections?: Array<{
    corner: string;
    datasetId?: string | null;
    label: string;
    reason: string;
    url: string;
  }>;
};

export type Signal = {
  id: string;
  metricId: string;
  level: "critical" | "watch" | "context" | "stable";
  label: string;
  title: string;
  body: string;
  value: string;
};

export type CatalogueItem = {
  number: number;
  id: string;
  title: string;
  category: string;
  frequency: string;
  coverageStart: string;
  priority: "hero" | "top" | "deep";
  status: "live" | "mapped";
  annualization: string;
  endpoint: string;
};

export type WeeklyReport = {
  title: string;
  deck: string;
  generatedAt: string;
  highlights: Array<{
    level: Signal["level"];
    title: string;
    body: string;
  }>;
};

export type DashboardData = {
  meta: {
    generatedAt: string;
    source: string;
    sourceUrl: string;
    catalogueCount: number;
    liveMetricCount: number;
    currentThrough: string;
  };
  metrics: Metric[];
  signals: Signal[];
  catalogue: CatalogueItem[];
  report: WeeklyReport;
};

export type DatasetIndicator = {
  id: string;
  graphCode?: string;
  seriesKey: string;
  sourceId: string;
  sourceLabel: string;
  sourceUrl?: string;
  sourceRefs?: Array<{ id: string; label: string; url: string; role?: string }>;
  idApi: string | null;
  title: string;
  titleEn?: string;
  value: number;
  date: string;
  partial?: boolean;
  unit: string;
  measureField: string;
  dimensions: Record<string, string | number>;
  series: SeriesPoint[];
  notes: string[];
  observationStatus: "latest" | "last-published";
  sourceLatestDate: string | null;
  quality?: SeriesQuality;
};

export type DatasetFact = {
  label: string;
  period: string;
  value: string;
  unit: string;
  status: string;
};

export type DatasetTag = {
  id: string;
  labelUa: string;
  labelEn: string;
};

export type DatasetSchemaField = {
  field: string;
  label: string;
  description: string;
  type: string;
  coverage: number;
  nulls: number;
  examples: Array<string | number>;
};

export type DataFileChunk = {
  url: string;
  rows: number;
};

export type DatasetSourceCoverage = {
  id: string;
  label: string;
  status: "included";
  description: string;
  availability: string;
  limitation: string | null;
  latestDate: string;
  latestRows: number;
  latestUrl: string;
  cadence: string;
  chartedPoints: number;
  cache: {
    snapshots: number;
    rows: number;
    bytes: number;
  };
  annualSnapshots: {
    count: number;
    firstYear: number | null;
    lastYear: number | null;
    rows: number;
  };
  sourceRefs?: Array<{ id: string; label: string; url: string; role?: string }>;
};

export type RegionalPerspective = {
  available: boolean;
  field: string | null;
  codeSystem: string | null;
  description: string | null;
  joinNote: string | null;
  regionCount: number;
  rowCount: number;
  seriesCount: number;
  regions: Array<{
    code: string;
    name: string;
    rowCount: number;
    latestDate: string | null;
  }>;
};

export type DatasetSummary = CatalogueItem & {
  status: "live";
  graphCodeBase?: string;
  tags?: DatasetTag[];
  titleOriginal?: string;
  titleUa?: string;
  titleEn?: string;
  originalLanguage?: "uk" | "en";
  description: string;
  descriptionUa?: string;
  descriptionEn?: string;
  presentation?: "chart" | "facts";
  fallbackFacts?: DatasetFact[];
  question: string;
  why: string;
  readerGuide?: ReaderGuide;
  lineage?: DatasetLineage | null;
  sourceReferences?: Array<{ id: string; label: string; url: string; role?: string }>;
  freshness: {
    generatedAt: string;
    latestDate: string;
    rowCount: number;
    bytes: number;
    sources: Array<{
      id: string;
      label: string;
      latestDate: string;
      rowCount: number;
      url: string;
    }>;
  };
  schema: DatasetSchemaField[];
  indicators: DatasetIndicator[];
  coverage: DatasetSourceCoverage[];
  regionalPerspective: RegionalPerspective;
  exports: {
    jsonChunks: DataFileChunk[];
    csvChunks: DataFileChunk[];
    annualCsv: string;
    regionsJson: string | null;
  };
};

export type DataroomCard = {
  id: string;
  number: number;
  graphCodeBase?: string;
  tags?: DatasetTag[];
  title: string;
  titleOriginal?: string;
  titleUa?: string;
  titleEn?: string;
  category: string;
  description: string;
  descriptionUa?: string;
  descriptionEn?: string;
  question: string;
  readerGuide?: ReaderGuide;
  lineage?: DatasetLineage | null;
  frequency: string;
  coverageStart: string;
  latestDate: string;
  rowCount: number;
  fieldCount: number;
  value: number | null;
  unit: string;
  indicatorTitle: string;
  sparkline: SeriesPoint[];
  presentation?: "chart" | "facts";
  fallbackFacts?: DatasetFact[];
  regional: {
    available: boolean;
    field: string | null;
    regionCount: number;
    rowCount: number;
  };
  url: string;
};

export type GraphAliasRecord = {
  shortId: string;
  graphCodeBase: string;
  corner: string;
  datasetId: string;
  number: number;
  title: string;
  titleUa?: string;
  titleEn?: string;
  url: string;
};

export type GraphAliasIndex = {
  generatedAt?: string;
  count?: number;
  byShortId: Record<string, GraphAliasRecord>;
};

export type DataroomManifest = {
  meta: {
    generatedAt: string;
    source: string;
    sourceUrl: string;
    datasetCount: number;
    liveDatasetCount: number;
    failedDatasetCount: number;
    factOnlyDatasetCount?: number;
    regionalDatasetCount: number;
    storageModel: string;
    coverageReport: {
      json: string;
      markdown: string;
    };
  };
  datasets: DataroomCard[];
  failures: Array<{ id: string; error: string }>;
  factsOnly?: Array<{ id: string; articleId?: string; factsCount: number }>;
};

export type CoverageReport = {
  generatedAt: string;
  datasetCount: number;
  regionalDatasetCount: number;
  sourceCount: number;
  datasets: Array<{
    id: string;
    number: number;
    title: string;
    latestDate: string;
    latestRows: number;
    sources: DatasetSourceCoverage[];
    regionalPerspective: RegionalPerspective;
  }>;
};

export type ComparisonObservation = {
  id: string;
  label: string;
  unit: string;
  current: number;
  previous: number;
  delta: number;
  deltaPct: number | null;
  level: Signal["level"];
  comparison?: string;
  currentDate: string;
  previousDate: string;
  insight: string;
  quality?: SeriesQuality;
};

export type ComparisonReport = {
  id: string;
  period: "annual" | "quarterly" | "monthly" | "daily";
  title: string;
  kicker: string;
  deck: string;
  brief: string;
  generatedAt: string;
  source: string;
  observations: ComparisonObservation[];
  lead: ComparisonObservation | null;
  datasetGuides?: Array<{
    id: string;
    titleUa: string;
    titleEn: string;
    readerGuide?: ReaderGuide;
  }>;
  notes: string[];
};

export type ReportManifestItem = {
  id: string;
  period: "annual" | "quarterly" | "monthly" | "daily";
  title: string;
  kicker: string;
  deck: string;
  brief: string;
  generatedAt: string;
  lead: ComparisonObservation | null;
  json: string;
  markdown: string;
  url: string;
};
