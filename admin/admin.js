const state = {
  datasets: [],
  overview: null,
  queryResult: null,
  selectedDataset: null,
  selectedSeries: null,
};

const sqlExamples = {
  catalogue: `SELECT id,
       title,
       category,
       coverage_start,
       coverage_end,
       row_count,
       fetch_mode
FROM datasets
ORDER BY row_count DESC`,
  series: `SELECT dataset_id,
       COALESCE(indicator_label, indicator_code) AS indicator,
       unit,
       COUNT(*) AS points,
       MIN(date) AS first_period,
       MAX(date) AS last_period
FROM observations
WHERE value IS NOT NULL
GROUP BY dataset_id, indicator, unit
ORDER BY points DESC`,
  snapshots: `SELECT dataset_id,
       COUNT(*) AS regions
FROM availability_values
WHERE component_id = 'REGION'
  AND code <> 'UA00000000000000000'
GROUP BY dataset_id
ORDER BY regions DESC`,
  freshness: `SELECT dataset_id,
       MAX(date) AS latest_observation,
       COUNT(*) AS rows
FROM observations
GROUP BY dataset_id
ORDER BY latest_observation DESC`,
};

const numberFormatter = new Intl.NumberFormat("uk-UA", {
  maximumFractionDigits: 2,
});
const integerFormatter = new Intl.NumberFormat("uk-UA", {
  maximumFractionDigits: 0,
});
const dateFormatter = new Intl.DateTimeFormat("uk-UA", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

function $(selector, parent = document) {
  return parent.querySelector(selector);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatInteger(value) {
  return integerFormatter.format(Number(value ?? 0));
}

function formatBytes(value) {
  const bytes = Number(value ?? 0);
  if (bytes >= 1024 ** 3) return `${numberFormatter.format(bytes / 1024 ** 3)} GiB`;
  if (bytes >= 1024 ** 2) return `${numberFormatter.format(bytes / 1024 ** 2)} MiB`;
  if (bytes >= 1024) return `${numberFormatter.format(bytes / 1024)} KiB`;
  return `${bytes} B`;
}

function formatDate(value) {
  if (!value) return "n/a";
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : dateFormatter.format(date);
}

function formatValue(value, unit = "") {
  const number = Number(value);
  if (!Number.isFinite(number)) return String(value ?? "n/a");
  if (unit === "%") return `${numberFormatter.format(number)}%`;
  if ((unit === "USD" || unit === "EUR") && Math.abs(number) >= 1_000_000_000) {
    const symbol = unit === "USD" ? "$" : "€";
    return `${symbol}${numberFormatter.format(number / 1_000_000_000)}bn`;
  }
  if (/млн/u.test(unit) && Math.abs(number) >= 1_000) {
    return `${numberFormatter.format(number / 1_000)} млрд`;
  }
  return numberFormatter.format(number);
}

async function api(path, options) {
  const response = await fetch(path, {
    cache: "no-store",
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers ?? {}),
    },
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error ?? `Request failed: ${response.status}`);
  return payload;
}

function renderStats(overview) {
  $("#stat-datasets").textContent = formatInteger(overview.datasets.length);
  $("#stat-snapshots").textContent = formatInteger(overview.snapshotCount);
  $("#stat-rows").textContent = `${numberFormatter.format(
    overview.rawRows / 1_000_000,
  )}m`;
  $("#stat-size").textContent = formatBytes(overview.databaseBytes);
}

function renderDatasetList(filter = "") {
  const normalized = filter.trim().toLocaleLowerCase("uk-UA");
  const datasets = state.datasets.filter((dataset) =>
    `${dataset.number} ${dataset.id} ${dataset.title} ${dataset.category}`
      .toLocaleLowerCase("uk-UA")
      .includes(normalized),
  );
  const list = $("#dataset-list");
  list.innerHTML = datasets
    .map(
      (dataset) => `
        <button
          type="button"
          class="dataset-button"
          data-dataset-id="${escapeHtml(dataset.id)}"
          aria-current="${dataset.id === state.selectedDataset ? "true" : "false"}"
        >
          <span>${String(dataset.number).padStart(2, "0")}</span>
          <span>
            <strong>${escapeHtml(dataset.title)}</strong>
            <small>${escapeHtml(dataset.category)} / ${formatInteger(dataset.rowCount)} rows</small>
          </span>
        </button>
      `,
    )
    .join("");

  for (const button of list.querySelectorAll("[data-dataset-id]")) {
    button.addEventListener("click", () => selectDataset(button.dataset.datasetId));
  }
}

function renderDatasetShell(dataset) {
  const latest = formatDate(dataset.latestDate);
  const firstSeries = dataset.series[0];
  const firstCoverage = firstSeries
    ? `${firstSeries.first_period} → ${firstSeries.last_period}`
    : "no normalized series";

  $("#dataset-workbench").innerHTML = `
    <header class="dataset-header">
      <p class="dataset-kicker">
        <span class="live-dot" aria-hidden="true"></span>
        Dataset ${String(dataset.number).padStart(2, "0")} / ${escapeHtml(dataset.category)}
      </p>
      <h3>${escapeHtml(dataset.title)}</h3>
      <p>${escapeHtml(dataset.description)}</p>
    </header>

    <div class="dataset-meta">
      <div>
        <span>Latest date</span>
        <strong>${escapeHtml(latest)}</strong>
      </div>
      <div>
        <span>Latest rows</span>
        <strong>${formatInteger(dataset.rowCount)}</strong>
      </div>
      <div>
        <span>Parameters</span>
        <strong>${formatInteger(dataset.fieldCount)}</strong>
      </div>
      <div>
        <span>Series coverage</span>
        <strong>${escapeHtml(firstCoverage)}</strong>
      </div>
    </div>

    <div class="filter-row">
      <div>
        <label for="series-select">Normalized series</label>
        <select id="series-select">
          ${dataset.series
            .map(
              (series) => `
                <option value="${escapeHtml(series.series_id)}">
                  ${escapeHtml(series.title)} (${formatInteger(series.point_count)})
                </option>
              `,
            )
            .join("")}
        </select>
      </div>
      <div>
        <label for="series-from">From</label>
        <input id="series-from" type="date" />
      </div>
      <div>
        <label for="series-to">To</label>
        <input id="series-to" type="date" />
      </div>
      <button class="primary-button" id="apply-series" type="button">Apply</button>
    </div>

    <div id="series-output">
      <div class="workbench-loading">Loading normalized points...</div>
    </div>

    <div class="subsection-heading">
      <div>
        <span class="subsection-kicker">Source rows</span>
        <h4>Raw source rows</h4>
      </div>
      <p>
        Preview up to 50 source rows in the browser or download the current
        sample as JSON.
      </p>
    </div>
    <div class="table-shell snapshots-table">
      ${renderSnapshotTable(dataset.snapshots)}
    </div>
    <div class="snapshot-preview" id="snapshot-preview"></div>
  `;

  $("#series-select")?.addEventListener("change", loadSelectedSeries);
  $("#apply-series")?.addEventListener("click", loadSelectedSeries);
  for (const button of document.querySelectorAll("[data-snapshot-key]")) {
    button.addEventListener("click", () => previewSnapshot(button.dataset));
  }
}

function renderSnapshotTable(snapshots) {
  if (snapshots.length === 0) return '<p class="empty-state">No source rows cached.</p>';
  return `
    <table>
      <thead>
        <tr>
          <th>Source</th>
          <th>Fetch mode</th>
          <th>Latest date</th>
          <th>Rows</th>
          <th>Storage</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        ${snapshots
          .map(
            (snapshot) => `
              <tr>
                <td>${escapeHtml(snapshot.source_id)}</td>
                <td title="${escapeHtml(snapshot.snapshot_key)}">${escapeHtml(snapshot.snapshot_key)}</td>
                <td>${escapeHtml(snapshot.source_date ?? "n/a")}</td>
                <td>${formatInteger(snapshot.row_count)}</td>
                <td>${formatBytes(snapshot.byte_count)}</td>
                <td>
                  <button
                    type="button"
                    class="snapshot-button"
                    data-dataset="${escapeHtml(snapshot.dataset_id)}"
                    data-source="${escapeHtml(snapshot.source_id)}"
                    data-snapshot-key="${escapeHtml(snapshot.snapshot_key)}"
                  >Preview</button>
                </td>
              </tr>
            `,
          )
          .join("")}
      </tbody>
    </table>
  `;
}

async function selectDataset(datasetId) {
  state.selectedDataset = datasetId;
  renderDatasetList($("#dataset-search").value);
  $("#dataset-workbench").innerHTML =
    '<div class="workbench-loading">Opening dataset...</div>';

  try {
    const dataset = await api(`/api/dataset?id=${encodeURIComponent(datasetId)}`);
    state.selectedSeries = dataset.series[0]?.series_id ?? null;
    renderDatasetShell(dataset);
    if (state.selectedSeries) await loadSelectedSeries();
    else {
      $("#series-output").innerHTML =
        '<p class="empty-state">This dataset has no chartable numeric series yet. Use raw rows or SQL.</p>';
    }
  } catch (error) {
    $("#dataset-workbench").innerHTML = `<div class="error-state">${escapeHtml(
      error.message,
    )}</div>`;
  }
}

async function loadSelectedSeries() {
  const select = $("#series-select");
  if (!select?.value) return;
  state.selectedSeries = select.value;
  const from = $("#series-from")?.value;
  const to = $("#series-to")?.value;
  const parameters = new URLSearchParams({
    dataset: state.selectedDataset,
    series: state.selectedSeries,
  });
  if (from) parameters.set("from", from);
  if (to) parameters.set("to", to);
  $("#series-output").innerHTML =
    '<div class="workbench-loading">Drawing series...</div>';

  try {
    const result = await api(`/api/series?${parameters}`);
    renderSeries(result.points);
  } catch (error) {
    $("#series-output").innerHTML = `<div class="error-state">${escapeHtml(
      error.message,
    )}</div>`;
  }
}

function renderSeries(points) {
  if (points.length === 0) {
    $("#series-output").innerHTML =
      '<p class="empty-state">No points match this period.</p>';
    return;
  }

  const latest = points.at(-1);
  $("#series-output").innerHTML = `
    <div class="chart-card">
      <div class="chart-head">
        <div>
          <span class="subsection-kicker">${escapeHtml(latest.unit)}</span>
          <h4>${escapeHtml(latest.title)}</h4>
        </div>
        <strong>${escapeHtml(formatValue(latest.value, latest.unit))}</strong>
      </div>
      <div class="chart-wrap" id="chart-wrap"></div>
    </div>
    <div class="points-summary">
      <span>${formatInteger(points.length)} points</span>
      <span>${escapeHtml(points[0].period)} → ${escapeHtml(latest.period)}</span>
    </div>
    <div class="table-shell">
      ${renderTable(["period", "value", "unit"], points)}
    </div>
  `;
  drawChart(points, latest.unit);
}

function drawChart(points, unit) {
  const width = 1000;
  const height = 305;
  const padding = { bottom: 34, left: 72, right: 24, top: 18 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const values = points.map((point) => Number(point.value));
  let minimum = Math.min(...values);
  let maximum = Math.max(...values);
  if (minimum === maximum) {
    minimum -= Math.abs(minimum || 1) * 0.1;
    maximum += Math.abs(maximum || 1) * 0.1;
  }
  const rangePadding = (maximum - minimum) * 0.09;
  minimum -= rangePadding;
  maximum += rangePadding;

  const x = (index) =>
    padding.left + (index / Math.max(1, points.length - 1)) * plotWidth;
  const y = (value) =>
    padding.top + ((maximum - value) / (maximum - minimum)) * plotHeight;
  const path = points
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"} ${x(index).toFixed(2)} ${y(point.value).toFixed(2)}`,
    )
    .join(" ");
  const area = `${path} L ${x(points.length - 1)} ${height - padding.bottom} L ${x(
    0,
  )} ${height - padding.bottom} Z`;
  const ticks = Array.from({ length: 5 }, (_item, index) => {
    const ratio = index / 4;
    const value = maximum - ratio * (maximum - minimum);
    const tickY = padding.top + ratio * plotHeight;
    return `
      <line class="chart-grid-line" x1="${padding.left}" x2="${
        width - padding.right
      }" y1="${tickY}" y2="${tickY}" />
      <text class="chart-axis-label" x="${padding.left - 10}" y="${
        tickY + 4
      }" text-anchor="end">${escapeHtml(formatValue(value, unit))}</text>
    `;
  }).join("");
  const firstLabel = points[0].period.slice(0, 7);
  const middleLabel = points[Math.floor((points.length - 1) / 2)].period.slice(0, 7);
  const lastLabel = points.at(-1).period.slice(0, 7);

  const wrap = $("#chart-wrap");
  wrap.innerHTML = `
    <svg
      class="series-chart"
      viewBox="0 0 ${width} ${height}"
      role="img"
      aria-label="Time series for ${escapeHtml(points[0].title)}"
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#0057b8" stop-opacity="0.22" />
          <stop offset="100%" stop-color="#0057b8" stop-opacity="0" />
        </linearGradient>
      </defs>
      ${ticks}
      <path class="chart-area" d="${area}" />
      <path class="chart-line" d="${path}" />
      <text class="chart-axis-label" x="${padding.left}" y="${
        height - 8
      }">${escapeHtml(firstLabel)}</text>
      <text class="chart-axis-label" x="${padding.left + plotWidth / 2}" y="${
        height - 8
      }" text-anchor="middle">${escapeHtml(middleLabel)}</text>
      <text class="chart-axis-label" x="${width - padding.right}" y="${
        height - 8
      }" text-anchor="end">${escapeHtml(lastLabel)}</text>
      <g id="chart-focus" visibility="hidden">
        <line class="chart-cursor" y1="${padding.top}" y2="${
          height - padding.bottom
        }" />
        <circle class="chart-point" r="6" />
      </g>
      <rect
        class="chart-hit"
        x="${padding.left}"
        y="${padding.top}"
        width="${plotWidth}"
        height="${plotHeight}"
      />
    </svg>
    <div class="chart-tooltip" id="chart-tooltip" hidden></div>
  `;

  const svg = $(".series-chart", wrap);
  const focus = $("#chart-focus", wrap);
  const cursor = $(".chart-cursor", focus);
  const point = $(".chart-point", focus);
  const tooltip = $("#chart-tooltip", wrap);
  const hit = $(".chart-hit", svg);

  hit.addEventListener("pointermove", (event) => {
    const bounds = svg.getBoundingClientRect();
    const ratio = Math.min(
      1,
      Math.max(0, (event.clientX - bounds.left) / bounds.width),
    );
    const viewX = ratio * width;
    const index = Math.round(
      ((viewX - padding.left) / plotWidth) * Math.max(1, points.length - 1),
    );
    const safeIndex = Math.min(points.length - 1, Math.max(0, index));
    const selected = points[safeIndex];
    const selectedX = x(safeIndex);
    const selectedY = y(selected.value);
    cursor.setAttribute("x1", selectedX);
    cursor.setAttribute("x2", selectedX);
    point.setAttribute("cx", selectedX);
    point.setAttribute("cy", selectedY);
    focus.setAttribute("visibility", "visible");
    tooltip.hidden = false;
    tooltip.innerHTML = `<strong>${escapeHtml(
      formatValue(selected.value, unit),
    )}</strong>${escapeHtml(selected.period)} / ${escapeHtml(unit)}`;
    tooltip.style.left = `${(selectedX / width) * 100}%`;
    tooltip.style.top = `${(selectedY / height) * 100}%`;
  });
  hit.addEventListener("pointerleave", () => {
    focus.setAttribute("visibility", "hidden");
    tooltip.hidden = true;
  });
}

async function previewSnapshot(dataset) {
  const preview = $("#snapshot-preview");
  preview.innerHTML = '<div class="workbench-loading">Reading source rows...</div>';
  const parameters = new URLSearchParams({
    dataset: dataset.dataset,
    source: dataset.source,
    key: dataset.snapshotKey,
    limit: "50",
  });
  try {
    const result = await api(`/api/snapshot?${parameters}`);
    const download = new URLSearchParams(parameters);
    download.set("download", "1");
    const columns = Array.from(
      new Set(result.rows.flatMap((row) => Object.keys(row ?? {}))),
    ).slice(0, 30);
    preview.innerHTML = `
      <div class="snapshot-preview-head">
        <strong>${escapeHtml(result.metadata.snapshotKey)}</strong>
        <a href="/api/snapshot?${download}">Download sample JSON</a>
      </div>
      <div class="points-summary">
        <span>${formatInteger(result.totalRows)} source rows</span>
        <span>${formatBytes(result.metadata.byteCount)} / fetched ${escapeHtml(
          formatDate(result.metadata.fetchedAt),
        )}</span>
      </div>
      <div class="table-shell">
        ${
          result.rows.length
            ? renderTable(columns, result.rows)
            : '<p class="empty-state">This sample contains no rows.</p>'
        }
      </div>
    `;
    preview.scrollIntoView({ behavior: "smooth", block: "nearest" });
  } catch (error) {
    preview.innerHTML = `<div class="error-state">${escapeHtml(error.message)}</div>`;
  }
}

function renderTable(columns, rows) {
  return `
    <table>
      <thead>
        <tr>${columns.map((column) => `<th>${escapeHtml(column)}</th>`).join("")}</tr>
      </thead>
      <tbody>
        ${rows
          .map(
            (row) => `
              <tr>
                ${columns
                  .map((column) => {
                    const value = row[column];
                    const display =
                      value && typeof value === "object"
                        ? JSON.stringify(value)
                        : String(value ?? "");
                    return `<td title="${escapeHtml(display)}">${escapeHtml(display)}</td>`;
                  })
                  .join("")}
              </tr>
            `,
          )
          .join("")}
      </tbody>
    </table>
  `;
}

async function runQuery() {
  const input = $("#sql-input");
  const button = $("#run-query");
  const status = $("#query-status");
  button.disabled = true;
  status.textContent = "Running...";
  $("#query-results").innerHTML =
    '<p class="empty-state">Reading SQLite...</p>';

  try {
    const result = await api("/api/query", {
      body: JSON.stringify({ sql: input.value }),
      method: "POST",
    });
    state.queryResult = result;
    $("#export-query").disabled = result.rows.length === 0;
    status.textContent = `${formatInteger(result.rowCount)} rows / ${
      result.elapsedMs
    } ms${result.truncated ? " / capped" : ""}`;
    $("#query-results").innerHTML = result.rows.length
      ? renderTable(result.columns, result.rows)
      : '<p class="empty-state">Query returned no rows.</p>';
  } catch (error) {
    state.queryResult = null;
    $("#export-query").disabled = true;
    status.textContent = "Query rejected";
    $("#query-results").innerHTML = `<div class="error-state">${escapeHtml(
      error.message,
    )}</div>`;
  } finally {
    button.disabled = false;
  }
}

function exportQueryCsv() {
  const result = state.queryResult;
  if (!result?.rows.length) return;
  const quote = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  const csv = [
    result.columns.map(quote).join(","),
    ...result.rows.map((row) =>
      result.columns.map((column) => quote(row[column])).join(","),
    ),
  ].join("\n");
  const link = document.createElement("a");
  link.href = URL.createObjectURL(
    new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }),
  );
  link.download = `corner-sql-result-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

async function initialize() {
  $("#sql-input").value = sqlExamples.catalogue;
  try {
    const overview = await api("/api/overview");
    state.overview = overview;
    state.datasets = overview.datasets;
    renderStats(overview);
    renderDatasetList();
    await selectDataset(
      overview.datasets[0]?.id,
    );
  } catch (error) {
    $("#dataset-workbench").innerHTML = `<div class="error-state">${escapeHtml(
      error.message,
    )}</div>`;
    $(".connection").innerHTML = `<span class="connection-dot"></span><span>Database unavailable</span>`;
  }
}

$("#dataset-search").addEventListener("input", (event) =>
  renderDatasetList(event.target.value),
);
$("#run-query").addEventListener("click", runQuery);
$("#export-query").addEventListener("click", exportQueryCsv);
$("#sql-input").addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
    event.preventDefault();
    runQuery();
  }
});
for (const button of document.querySelectorAll("[data-sql-example]")) {
  button.addEventListener("click", () => {
    $("#sql-input").value = sqlExamples[button.dataset.sqlExample];
    $("#sql-input").focus();
  });
}

initialize();
