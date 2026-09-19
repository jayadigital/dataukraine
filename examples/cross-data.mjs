const api = "https://dataukraine.proto.fund/api/v1/ukraine";

async function getJson(path) {
  const response = await fetch(`${api}${path}`, {
    headers: { accept: "application/json" },
  });
  if (!response.ok) throw new Error(`${response.status} ${path}`);
  return response.json();
}

const series = await getJson(
  "/corners/imf/datasets/ngdp_rpch/series?start_year=2020&end_year=2031",
);

const record = series.data?.[0] ?? series;
const points = (record.series ?? record.indicators?.[0]?.series ?? []).map((point) => ({
  period: point.date,
  value: point.value,
  status: point.forecast ? "forecast" : point.partial ? "partial" : "observed",
}));

console.table(points);
console.log("Source and methodology metadata should travel with every comparison:");
console.log({
  dataset: record.id ?? record.sourceId,
  graphCode: record.graphCode,
  title: record.titleUa ?? record.title ?? record.sourceLabel,
  unit: record.unit,
  release: series.meta?.release,
  notes: record.notes,
});
