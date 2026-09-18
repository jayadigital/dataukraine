import { fetchMetricById } from "./adapters.mjs";
import { metricRegistry } from "./registry.mjs";

const args = Object.fromEntries(
  process.argv.slice(2).map((argument, index, all) => {
    if (!argument.startsWith("--")) return [argument, true];
    const key = argument.slice(2);
    const value = all[index + 1]?.startsWith("--") ? true : all[index + 1];
    return [key, value ?? true];
  }),
);

const dataset = args.dataset;
const format = args.format ?? "json";

if (!dataset) {
  console.error(
    `Usage: npm run data:query -- --dataset <id> [--format json|csv]\nAvailable: ${metricRegistry
      .map((metric) => metric.id)
      .join(", ")}`,
  );
  process.exit(1);
}

const metric = await fetchMetricById(dataset);
if (format === "csv") {
  console.log("metric_id,year,date,value,unit,partial");
  for (const point of metric.series) {
    console.log(
      [
        metric.id,
        point.year,
        point.date,
        point.value,
        JSON.stringify(metric.unit),
        Boolean(point.partial),
      ].join(","),
    );
  }
} else {
  console.log(JSON.stringify(metric, null, 2));
}
