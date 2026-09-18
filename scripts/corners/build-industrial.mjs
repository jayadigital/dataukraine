import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import {
  buildPublicRelease,
  createCornerDatabase,
  generatedAt,
  insertDatasets,
  parseCsv,
  publicRoot,
  root,
  slugify,
} from "./common.mjs";

const alphaRoot = process.env.RI_ALPHA_ROOT
  ? resolve(process.env.RI_ALPHA_ROOT)
  : resolve(root, "../../../0_O_o.3 alpha/RI");
const sources = [
  {
    bucket: "08",
    file: resolve(alphaRoot, "08-evidence_pack_foresight_public_data_core.md"),
    role: "validated evidence graph tables",
  },
  {
    bucket: "09",
    file: resolve(alphaRoot, "09-foresight-public-data-core-2.md"),
    role: "extended public graph tables",
  },
  {
    bucket: "10",
    file: resolve(alphaRoot, "10-scenario_model_j1_v15.md"),
    role: "scenario model and formula tables",
  },
  {
    bucket: "11",
    file: resolve(alphaRoot, "11-scenario_dataroom_j1.md"),
    role: "scenario dataroom graph tables",
  },
];

const domainNames = {
  A0: "Промисловість: загальний зріз",
  A1: "Металургія",
  A2: "Енергетика",
  A3: "Хімічна промисловість",
  A4: "Машинобудування",
  A5: "Будівництво",
  A6: "Агропромисловість",
  B1: "Людський капітал",
  B2: "Інфраструктура і логістика",
  B3: "Тарифи і собівартість",
  B4: "Фінанси та інвестиції",
  J1: "Сценарні ряди 2021-2035",
  I1: "Сценарна модель",
};

function cleanCell(value) {
  return String(value ?? "")
    .replace(/<br\s*\/?>/giu, " ")
    .replace(/\*\*/gu, "")
    .replace(/\*/gu, "")
    .replace(/`/gu, "")
    .trim();
}

function stableKey(value, fallback = "series") {
  const ascii = slugify(value);
  if (ascii) return ascii;
  if (!String(value ?? "").trim()) return fallback;
  let hash = 2166136261;
  for (const character of String(value ?? "")) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return `series-${(hash >>> 0).toString(36)}`;
}

function isMissingCell(value) {
  return /^(?:—|-|–|n\/a|na|null|немає)$/iu.test(cleanCell(value));
}

function parseMarkdownRow(line) {
  const body = line.trim().replace(/^\|/u, "").replace(/\|$/u, "");
  return body.split(/(?<!\\)\|/u).map(cleanCell);
}

function isDivider(line) {
  return /^\s*\|?\s*:?-{3,}/u.test(line);
}

function tableRows(lines, start) {
  const block = [];
  let cursor = start;
  while (cursor < lines.length && /^\s*\|/u.test(lines[cursor])) {
    block.push(lines[cursor]);
    cursor += 1;
  }
  if (block.length < 3 || !isDivider(block[1])) return null;
  const headers = parseMarkdownRow(block[0]);
  const rows = block.slice(2).map(parseMarkdownRow).map((cells) =>
    Object.fromEntries(headers.map((header, index) => [header || `field_${index + 1}`, cells[index] ?? ""])),
  );
  return { headers, rows, end: cursor };
}

function normalizeNumber(value) {
  const source = cleanCell(value)
    .replace(/\u00a0/gu, " ")
    .replace(/[−–—]/gu, "-")
    .replace(/^[~≈<>≤≥+]+/u, "")
    .replace(/%$/u, "")
    .trim();
  if (!source || /[A-Za-zА-Яа-яІіЇїЄєҐґ]/u.test(source)) return null;
  const normalized = source
    .replace(/\s+/gu, "")
    .replace(/(?<=\d),(?=\d{1,4}(?:$|[^\d]))/gu, ".")
    .replace(/[^\d.+-]/gu, "");
  if (!/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/u.test(normalized)) return null;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

function parseYear(row) {
  const preferred = Object.entries(row).find(([field]) =>
    /^(year|рік|period|період|date|дата|start|шар)$/iu.test(cleanCell(field)),
  );
  const reference = Object.entries(row).find(([field]) =>
    /поточна точка|current point|reference year|опорн.*рік/iu.test(cleanCell(field)),
  );
  const candidates = [preferred?.[1], reference?.[1]];
  for (const value of candidates) {
    const match = cleanCell(value).match(/\b(19\d{2}|20\d{2})\b/u);
    if (match) return Number(match[1]);
  }
  return null;
}

function hasExplicitTimeField(row) {
  return Object.keys(row).some((field) =>
    /^(year|рік|period|період|date|дата|start|end|шар)$/iu.test(cleanCell(field)),
  );
}

function isReferencePeriodField(field, rows) {
  if (!/база|поточна точка|current point|reference|опорн|base/iu.test(cleanCell(field))) {
    return false;
  }
  const values = rows
    .map((row) => normalizeNumber(row[field]))
    .filter((value) => value !== null);
  return values.length > 0 &&
    values.every((value) => Number.isInteger(value) && value >= 1900 && value <= 2100);
}

function isOperationalBlock(block) {
  const identity = `${block.key} ${block.title} ${block.heading}`
    .toLocaleLowerCase("uk");
  return [
    /a0[_-]g07[_-]readiness[_-]matrix/u,
    /datacore[_\s-]*inventory/u,
    /sheet[_\s-]*inventory/u,
    /machine[_\s-]*readiness[_\s-]*summary/u,
    /web[_\s-]*client[_\s-]*export[_\s-]*readiness/u,
    /formula[_\s-]*sheet/u,
  ].some((pattern) => pattern.test(identity));
}

function isProvenanceField(field) {
  return /source|джерел|status|статус|quality|якість|note|примітк|comment|url|посилан|\bid\b|код/iu
    .test(cleanCell(field));
}

function isUnitField(field) {
  return /^(unit|units|одиниця|одиниці|од\.?\s*виміру)$/iu.test(cleanCell(field));
}

function categoryFor(id, heading) {
  const prefix = id.match(/\b(A[0-6]|B[1-4]|J1|I1)\b/iu)?.[1]?.toUpperCase();
  if (prefix && domainNames[prefix]) return domainNames[prefix];
  if (/метал|steel|iron/iu.test(heading)) return domainNames.A1;
  if (/енерг|electric|gas|power/iu.test(heading)) return domainNames.A2;
  if (/хім|fertili|chemical/iu.test(heading)) return domainNames.A3;
  if (/машин|engineer|robot|drone/iu.test(heading)) return domainNames.A4;
  if (/будів|construction|housing/iu.test(heading)) return domainNames.A5;
  if (/агро|grain|food|milk/iu.test(heading)) return domainNames.A6;
  if (/прац|labour|population|people/iu.test(heading)) return domainNames.B1;
  if (/логіст|port|road|infrastructure/iu.test(heading)) return domainNames.B2;
  if (/тариф|price cap|cost/iu.test(heading)) return domainNames.B3;
  if (/борг|budget|finance|investment|reserve|gdp/iu.test(heading)) return domainNames.B4;
  return "Промислові та сценарні показники";
}

function unitFor(field, row) {
  const explicit = Object.entries(row).find(([key]) => /^(unit|одиниця|од\. виміру)$/iu.test(cleanCell(key)))?.[1];
  if (explicit) return cleanCell(explicit);
  const text = cleanCell(field);
  if (/%|частка|share|ratio/iu.test(text)) return "%";
  const parenthetical = text.match(/\(([^)]+)\)/u)?.[1];
  if (parenthetical) return parenthetical;
  const afterComma = text.match(/,\s*([^,]+)$/u)?.[1];
  return afterComma || "значення";
}

function hasUsableNumbers(rows) {
  return rows.some((row) =>
    Object.values(row).filter((value) => normalizeNumber(value) !== null).length >= 1,
  );
}

function tableTitle(meta, fallback) {
  return cleanCell(meta.title || meta.description || fallback)
    .replace(/^\d+(?:\.\d+)*\.?\s*/u, "")
    .replace(/^Sheet\s+/iu, "")
    .replace(/^`|`$/gu, "");
}

function readableTableTitle(value, category) {
  const title = cleanCell(value)
    .replace(/^Dashboard[-–—]\s*/iu, "")
    .replace(/;\s*(?:сильний як|legacy reference|source mapping|нормалізован).+$/iu, "")
    .replace(/\s+/gu, " ")
    .trim();
  if (!/^(?:sheet[-_\s]+)?[A-Z]\d[-_][A-Z0-9_]+$/iu.test(title)) return title;
  const subject = title
    .replace(/^sheet[-_\s]+/iu, "")
    .replace(/^[A-Z]\d[-_]/iu, "")
    .replace(/_+/gu, " ")
    .replace(/\bneeds\b/giu, "потреби")
    .replace(/\brecovery index\b/giu, "індекс відновлення")
    .replace(/\benergy tariffs\b/giu, "енергетичні тарифи")
    .replace(/\blabour\b/giu, "ринок праці")
    .replace(/\bports fdi\b/giu, "порти та прямі інвестиції")
    .replace(/\breadiness matrix\b/giu, "матриця готовності")
    .replace(/\bcapacity\b/giu, "виробничі потужності")
    .replace(/\bgeneration mix\b/giu, "структура генерації")
    .replace(/\bgeneration\b/giu, "виробництво")
    .replace(/\bimports? by country\b/giu, "імпорт за країнами")
    .replace(/\bimports?\b/giu, "імпорт")
    .replace(/\bprice caps\b/giu, "граничні ціни")
    .replace(/\bratio\b/giu, "співвідношення")
    .replace(/\s+/gu, " ")
    .trim();
  const sentence = subject.charAt(0).toLocaleUpperCase("uk") + subject.slice(1);
  return `${category}: ${sentence}`;
}

const canonicalSources = [
  {
    corner: "wb",
    label: "World Bank",
    pattern: /world\s*bank|worldbank|(?:^|[^A-Z])WDI(?:[^A-Z]|$)|\b[A-Z]{2}\.[A-Z0-9.]{5,}\b/iu,
  },
  {
    corner: "nbu",
    label: "Національний банк України",
    pattern: /bank\.gov\.ua|\bNBU\b|\bНБУ\b|Національн\w*\s+банк/iu,
  },
  {
    corner: "imf",
    label: "International Monetary Fund",
    pattern: /imf\.org|\bIMF\b|\bМВФ\b|\bWEO\b|NGDP_RPCH|PCPIPCH|GGXWDG_NGDP/iu,
  },
  {
    corner: "oecd",
    label: "OECD",
    pattern: /oecd\.org|\bOECD\b/iu,
  },
  {
    corner: "eurostat",
    label: "Eurostat",
    pattern: /ec\.europa\.eu\/eurostat|\bEurostat\b/iu,
  },
  {
    corner: "stat",
    label: "Держстат України",
    pattern: /stat\.gov\.ua|ukrstat|\bДержстат\b/iu,
  },
];

let riGraphById = new Map();
let riSourceById = new Map();

function normalizedGraphId(value) {
  const match = String(value ?? "").match(/\b([ABIJ]\d)[-_]G(\d{1,3})(?=\D|$)/iu);
  return match
    ? `${match[1].toUpperCase()}-G${match[2].padStart(2, "0")}`
    : null;
}

function canonicalDatasetId(corner, text) {
  if (corner === "wb") {
    const code = text.match(/\b([A-Z]{2}(?:\.[A-Z0-9]{2,}){2,})\b/u)?.[1];
    if (code) return code.toLowerCase().replaceAll(".", "-");
  }
  if (corner === "imf") {
    const code = text.match(/\b(NGDP_RPCH|PCPIPCH|PCPIEPCH|LUR|BCA_NGDPD|GGXWDG_NGDP)\b/iu)?.[1];
    if (code) return code.toLowerCase();
  }
  return null;
}

function lineageFor(block, originalTitle) {
  const graphId = normalizedGraphId(`${block.key} ${block.heading}`);
  const graph = graphId ? riGraphById.get(graphId) : null;
  const graphSources = (graph?.sourceIds ?? [])
    .map((sourceId) => riSourceById.get(sourceId))
    .filter(Boolean);
  const evidence = [
    originalTitle,
    block.heading,
    block.description,
    JSON.stringify(block.rows),
    ...graphSources.map((source) =>
      `${source.sourceId} ${source.title} ${source.institution} ${source.url}`
    ),
  ].join("\n");
  const connections = canonicalSources
    .filter((source) => source.pattern.test(evidence))
    .map((source) => {
      const datasetId = canonicalDatasetId(source.corner, evidence);
      return {
        corner: source.corner,
        datasetId,
        label: source.label,
        relation: datasetId ? "duplicate-series" : "source-overlap",
        sourceIds: graphSources
          .filter((item) => source.pattern.test(
            `${item.title} ${item.institution} ${item.url}`,
          ))
          .map((item) => item.sourceId),
        reason: "Первинне або порівняльне значення RI посилається на зовнішнє джерело цього куточка.",
        url: datasetId
          ? `https://ukraine.proto.fund/corner/${source.corner}/dataset/${datasetId}`
          : `https://ukraine.proto.fund/corner/${source.corner}`,
      };
    });
  return {
    mode: connections.length ? "connected" : "native",
    originalId: `RI-${block.source.bucket}:${block.key}`,
    originalTitle,
    graphId,
    bucket: block.source.bucket,
    connections,
  };
}

function graphCardMetadata(text) {
  const lines = text.split(/\r?\n/u);
  const metadata = new Map();
  let graphCards = false;
  for (let index = 0; index < lines.length; index += 1) {
    const headingMatch = lines[index].match(/^#{2,4}\s+(.*)$/u);
    if (headingMatch) {
      graphCards = /GRAPH_CARDS/iu.test(headingMatch[1]);
      continue;
    }
    if (!graphCards || lines[index].trim() !== "```csv") continue;
    const csvLines = [];
    index += 1;
    while (index < lines.length && lines[index].trim() !== "```") {
      csvLines.push(lines[index]);
      index += 1;
    }
    for (const row of parseCsv(csvLines.join("\n"))) {
      const graphId = cleanCell(
        row.GraphCardID ?? row["ID графіка"] ?? row.ID ?? "",
      );
      const dataSheet = cleanCell(
        row["Data sheet"] ??
        row["Source table/dataset ID"] ??
        row["Аркуш даних"] ??
        "",
      );
      const title = cleanCell(
        row["Graph title"] ?? row["Назва графіка"] ?? row.Title ?? "",
      );
      const description = cleanCell(
        row["Graph description"] ??
        row["Caption / graph description"] ??
        row["Опис графіка"] ??
        "",
      );
      const item = { graphId, title, description };
      if (graphId) metadata.set(graphId.replaceAll("-", "_").toUpperCase(), item);
      if (dataSheet) metadata.set(dataSheet.replaceAll("-", "_").toUpperCase(), item);
    }
  }
  return metadata;
}

function parseCsvBlocks(text, source) {
  const lines = text.split(/\r?\n/u);
  const blocks = [];
  let heading = "";
  let graphId = "";
  let title = "";
  let description = "";
  let type = "";

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const headingMatch = line.match(/^#{2,4}\s+(.*)$/u);
    if (headingMatch) {
      heading = cleanCell(headingMatch[1]);
      graphId =
        heading.match(/\b([ABI J]\d[-_][A-Z]?\d{2,3}[A-Za-z]?)\b/iu)?.[1] ??
        heading.match(/\b([ABI J]\d[-_]G\d{1,3}[A-Za-z]?)\b/iu)?.[1] ??
        heading.match(/\b([A-Z]\d[-_]G\d{1,3}[A-Za-z]?)\b/iu)?.[1] ??
        heading.match(/\b([A-Z]\d_[A-Z]\d{2,3}[A-Za-z_]*)\b/iu)?.[1] ??
        heading.replace(/^\d+(?:\.\d+)*\.?\s*/u, "");
      title = "";
      description = "";
      type = "";
      continue;
    }
    const titleMatch = line.match(/^- Title:\s*(.+)$/iu);
    if (titleMatch) title = cleanCell(titleMatch[1]);
    const descriptionMatch = line.match(/^- Description:\s*(.+)$/iu);
    if (descriptionMatch) description = cleanCell(descriptionMatch[1]);
    const typeMatch = line.match(/^- Type:\s*`?([^`]+)`?$/iu);
    if (typeMatch) type = cleanCell(typeMatch[1]);
    if (line.trim() !== "```csv") continue;
    const csvLines = [];
    index += 1;
    while (index < lines.length && lines[index].trim() !== "```") {
      csvLines.push(lines[index]);
      index += 1;
    }
    const rows = parseCsv(csvLines.join("\n"));
    if (!rows.length || !hasUsableNumbers(rows)) continue;
    if (type && type !== "graph-data" && source.bucket === "08") continue;
    blocks.push({
      source,
      key: graphId || `csv-${blocks.length + 1}`,
      title: tableTitle({ title, description }, heading),
      description,
      heading,
      rows,
      format: "csv",
    });
  }
  return blocks;
}

function parseMarkdownTables(text, source) {
  const lines = text.split(/\r?\n/u);
  const blocks = [];
  let section = "";
  let graphId = "";
  let description = "";

  for (let index = 0; index < lines.length; index += 1) {
    const headingMatch = lines[index].match(/^#{1,4}\s+(.*)$/u);
    if (headingMatch) {
      const level = lines[index].match(/^#+/u)?.[0].length ?? 1;
      section = cleanCell(headingMatch[1]);
      const nextGraphId =
        section.match(/\b([A-Z]\d-G\d{1,3}[A-Za-z]?)\b/iu)?.[1] ??
        section.match(/\b(I1-[A-Za-z-]+)\b/iu)?.[1];
      if (nextGraphId) graphId = nextGraphId;
      else if (level <= 2) graphId = "";
      description = "";
      continue;
    }
    const descriptionMatch = lines[index].match(/^- Description:\s*(.+)$/iu);
    if (descriptionMatch) description = cleanCell(descriptionMatch[1]);
    if (!/^\s*\|/u.test(lines[index])) continue;
    const parsed = tableRows(lines, index);
    if (!parsed) continue;
    index = parsed.end - 1;
    const headerKey = parsed.headers.map((header) => header.toLocaleLowerCase()).join("|");
    if (
      !hasUsableNumbers(parsed.rows) ||
      /source file\|source path\|source type/iu.test(headerKey) ||
      /source pack\|file\|origin/iu.test(headerKey)
    ) continue;
    blocks.push({
      source,
      key: graphId || `${slugify(section) || "table"}-${blocks.length + 1}`,
      title: tableTitle({ description }, section),
      description,
      heading: section,
      rows: graphId && !normalizedGraphId(section)
        ? parsed.rows.map((row) => ({ RI_SECTION: section, ...row }))
        : parsed.rows,
      format: "markdown",
    });
  }
  return blocks;
}

function rowsForDataset(block) {
  const observations = [];
  const timeFields = new Set(
    Object.keys(block.rows[0] ?? {}).filter((field) =>
      /^(year|рік|period|період|date|дата|start|end|шар)$/iu.test(cleanCell(field)),
    ),
  );
  block.rows.forEach((raw, rowIndex) => {
    const year = parseYear(raw);
    const date = year ? `${year}-12-31` : generatedAt.slice(0, 10);
    const numericFields = Object.entries(raw)
      .filter(([field, value]) =>
        !timeFields.has(field) &&
        !isReferencePeriodField(field, block.rows) &&
        !isProvenanceField(field) &&
        !isUnitField(field) &&
        normalizeNumber(value) !== null,
      )
      .map(([field]) => field);
    const hasWideYears = numericFields.some((field) =>
      /^(19\d{2}|20\d{2})\*?$/u.test(cleanCell(field)),
    );
    const structural = !hasExplicitTimeField(raw) && !hasWideYears;
    const labelField =
      Object.keys(raw).find((field) =>
        !timeFields.has(field) &&
        !isProvenanceField(field) &&
        !isUnitField(field) &&
        normalizeNumber(raw[field]) === null &&
        cleanCell(raw[field]) &&
        !isMissingCell(raw[field])
      );
    const rowLabel = cleanCell(labelField ? raw[labelField] : block.title) ||
      `row ${rowIndex + 1}`;
    const dimensions = structural
      ? {}
      : Object.fromEntries(
          Object.entries(raw)
            .filter(([field, value]) =>
              !timeFields.has(field) &&
              !isProvenanceField(field) &&
              !isUnitField(field) &&
              normalizeNumber(value) === null &&
              cleanCell(value) &&
              !isMissingCell(value),
            )
            .slice(0, 12)
            .map(([field, value]) => [slugify(field) || field, cleanCell(value)]),
        );
    for (const [field, rawValue] of Object.entries(raw)) {
      if (timeFields.has(field)) continue;
      if (isReferencePeriodField(field, block.rows)) continue;
      const value = normalizeNumber(rawValue);
      if (value === null) continue;
      const fieldLabel = cleanCell(field);
      if (/source|id|код|номер|count|кількість джерел/iu.test(fieldLabel)) continue;
      const wideYear = fieldLabel.match(/^(19\d{2}|20\d{2})\*?$/u);
      const pointYear = wideYear ? Number(wideYear[1]) : year;
      const pointDate = pointYear ? `${pointYear}-12-31` : date;
      const indicatorLabel = wideYear
        ? rowLabel
        : structural
          ? fieldLabel
          : numericFields.length === 1 && labelField
            ? rowLabel
            : fieldLabel;
      observations.push({
        timePeriod: pointYear ? String(pointYear) : `row-${rowIndex + 1}`,
        date: pointDate,
        pointLabel: structural ? rowLabel : undefined,
        value,
        indicatorCode: stableKey(
          indicatorLabel,
          wideYear ? `row-${rowIndex + 1}` : `field-${numericFields.indexOf(field) + 1}`,
        ),
        indicatorLabel,
        unit: unitFor(wideYear ? "value" : fieldLabel, raw),
        freq: pointYear ? "A" : "S",
        action: (block.source.bucket === "10" || block.source.bucket === "11") && pointYear >= 2026
          ? "F"
          : "I",
        partial: /канд|candidate|estimate|оцін|partial|hypothesis/iu.test(
          Object.values(raw).join(" "),
        ),
        dimensions: structural
          ? { bucket: block.source.bucket }
          : {
              row: rowLabel,
              bucket: block.source.bucket,
              ...dimensions,
            },
        attributes: {
          sourceFile: basename(block.source.file),
          sourceRole: block.source.role,
          sourceFormat: block.format,
          sourceHeading: block.heading,
        },
        raw: {
          bucket: block.source.bucket,
          source_file: basename(block.source.file),
          source_heading: block.heading,
          ...raw,
        },
      });
    }
  });
  return observations;
}

const documents = await Promise.all(
  sources.map(async (source) => ({
    source,
    text: await readFile(source.file, "utf8"),
  })),
);
try {
  const [graphIndex, sourceIndex] = await Promise.all([
    readFile(resolve(root, "../ri-web/site/public/data/graphs.index.json"), "utf8"),
    readFile(resolve(root, "../ri-web/site/public/data/sources.index.json"), "utf8"),
  ]);
  riGraphById = new Map(
    JSON.parse(graphIndex).map((graph) => [graph.graphId, graph]),
  );
  riSourceById = new Map(
    JSON.parse(sourceIndex).map((source) => [source.sourceId, source]),
  );
} catch {
  // The alpha buckets remain importable even before the RI web registry is built.
}
const parsedBlocks = documents.flatMap(({ source, text }) => {
  const metadata = graphCardMetadata(text);
  return [
    ...parseCsvBlocks(text, source),
    ...parseMarkdownTables(text, source),
  ].map((block) => {
    const item = metadata.get(block.key.replaceAll("-", "_").toUpperCase());
    const graph = riGraphById.get(
      normalizedGraphId(`${item?.graphId ?? ""} ${block.key} ${block.heading}`),
    );
    return item
      ? {
          ...block,
          key: item.graphId || block.key,
          title: graph?.title || item.title || block.title,
          description: graph?.description || item.description || block.description,
        }
      : graph
        ? {
            ...block,
            title: graph.title || block.title,
            description: graph.description || block.description,
          }
        : block;
  });
});
const consolidated = new Map();
for (const block of parsedBlocks) {
  const graphId = normalizedGraphId(block.key);
  const key = graphId
    ? `${block.source.bucket}:${graphId}`
    : `${block.source.bucket}:${block.key}:${consolidated.size}`;
  const existing = consolidated.get(key);
  if (!existing) {
    consolidated.set(key, block);
    continue;
  }
  const seenRows = new Set(existing.rows.map((row) => JSON.stringify(row)));
  for (const row of block.rows) {
    const serialized = JSON.stringify(row);
    if (!seenRows.has(serialized)) {
      existing.rows.push(row);
      seenRows.add(serialized);
    }
  }
  if (!existing.description && block.description) existing.description = block.description;
}
const blocks = [...consolidated.values()];
const operationalBlocks = blocks.filter(isOperationalBlock);

const seen = new Map();
const allDatasets = [];
for (const block of blocks) {
  const rows = rowsForDataset(block);
  if (rows.length < 2) continue;
  const baseId = `ri${block.source.bucket}-${slugify(block.key)}`;
  const duplicateIndex = (seen.get(baseId) ?? 0) + 1;
  seen.set(baseId, duplicateIndex);
  const id = duplicateIndex === 1 ? baseId : `${baseId}-${duplicateIndex}`;
  const category = categoryFor(block.key, `${block.title} ${block.heading}`);
  const originalTitle = cleanCell(block.title || block.heading || block.key);
  const title = originalTitle || readableTableTitle(block.key, category);
  allDatasets.push({
    id,
    number: allDatasets.length + 1,
    operational: isOperationalBlock(block),
    flowId: `RI-${block.source.bucket}:${block.key}`,
    version: "0.3-alpha",
    title,
    originalTitle,
    originalLanguage: /[А-Яа-яІіЇїЄєҐґ]/u.test(originalTitle) ? "uk" : "en",
    category,
    frequency: rows.some((row) => row.freq === "A") ? "Річна / структурна" : "Структурна",
    priority: /A0|A1_G02|J1-G0[1-5]|ВВП|сталь|електроенер/iu.test(
      `${block.key} ${title}`,
    )
      ? "hero"
      : allDatasets.length < 40
        ? "top"
        : "deep",
    officialUrl: "https://ukraine.proto.fund/corner/industrial",
    sourceUrl: "https://ukraine.proto.fund/corner/industrial",
    fetchMode: `RI alpha bucket ${block.source.bucket}: ${block.source.role}`,
    description: block.description ||
      `${title}. Таблиця з RI alpha bucket ${block.source.bucket}; джерельні маркери збережено у первинних рядках.`,
    question: `Яку динаміку або структуру показує «${title}»?`,
    why: `Набір описує ${category.toLocaleLowerCase()} та використовується у промислових і сценарних розрахунках RI.`,
    annualization: "Періоди, одиниці та статуси взято з таблиці RI. Candidate, estimate, partial і forecast не перетворюються на факт.",
    limitation: "Це дослідницький набір RI. Перед зовнішнім використанням перевірте Source IDs, Quality status і позначки candidate/estimate у первинному рядку.",
    lineage: lineageFor(block, originalTitle),
    rows,
  });
}

const headlineOrder = [
  "ri08-a1-g02",
  "ri09-a2-g10",
  "ri09-a2-g14",
  "ri09-a2-g16",
  "ri11-j1-g01",
  "ri11-j1-g02",
  "ri11-j1-g03",
  "ri11-j1-g04",
  "ri11-j1-g05",
  "ri11-j1-g06",
];
const headlineRank = new Map(headlineOrder.map((id, index) => [id, index]));
allDatasets.sort((left, right) => {
  const leftRank = headlineRank.get(left.id);
  const rightRank = headlineRank.get(right.id);
  if (leftRank !== undefined || rightRank !== undefined) {
    return (leftRank ?? headlineOrder.length) - (rightRank ?? headlineOrder.length);
  }
  return left.number - right.number;
});
allDatasets.forEach((dataset, index) => {
  dataset.number = index + 1;
});
const datasets = allDatasets
  .filter((dataset) => !dataset.operational)
  .map(({ operational, ...dataset }) => dataset);
if (datasets.length < 100) {
  throw new Error(`Industrial import found only ${datasets.length} usable datasets; expected at least 100.`);
}

const { db, databasePath } = await createCornerDatabase("industrial");
insertDatasets(db, datasets);
await buildPublicRelease("industrial", db, datasets, []);
db.close();

const graphCards = documents.flatMap(({ source, text }) => {
  const unique = new Map();
  for (const item of graphCardMetadata(text).values()) {
    if (item.graphId) unique.set(item.graphId, item);
  }
  return [...unique.values()].map((item) => ({ bucket: source.bucket, ...item }));
});
const importedGraphIds = new Set(
  datasets.map((dataset) => dataset.lineage.graphId).filter(Boolean),
);
const unmatchedGraphCards = graphCards.filter(
  (card) => !importedGraphIds.has(normalizedGraphId(card.graphId)),
);
const indicatorIdentityAudit = new Map();
for (const dataset of datasets) {
  for (const row of dataset.rows) {
    const key = `${dataset.id}|${row.indicatorLabel}|${row.unit}`;
    const item = indicatorIdentityAudit.get(key) ?? {
      datasetId: dataset.id,
      indicatorLabel: row.indicatorLabel,
      unit: row.unit,
      codes: new Set(),
      observations: 0,
    };
    item.codes.add(row.indicatorCode);
    item.observations += 1;
    indicatorIdentityAudit.set(key, item);
  }
}
const audit = {
  generatedAt,
  sourceFiles: sources.map((source) => ({
    bucket: source.bucket,
    file: basename(source.file),
    role: source.role,
  })),
  parsedBlocks: blocks.length,
  importedDatasets: datasets.length,
  importedObservations: datasets.reduce((sum, dataset) => sum + dataset.rows.length, 0),
  graphCards: graphCards.length,
  unmatchedGraphCards,
  excludedOperationalTables: operationalBlocks.map((block) => ({
    bucket: block.source.bucket,
    key: block.key,
    title: block.title,
    reason: "Внутрішня інвентаризація, readiness summary або реєстр формул; збережено в аудиті, але не показано як економічний графік.",
  })),
  blocksWithoutTwoObservations: blocks
    .filter((block) => rowsForDataset(block).length < 2)
    .map((block) => ({
      bucket: block.source.bucket,
      key: block.key,
      title: block.title,
      reason: "Менше двох числових спостережень після нормалізації.",
    })),
  fragmentedIndicatorLabels: [...indicatorIdentityAudit.values()]
    .filter((item) => item.codes.size > 1)
    .map((item) => ({
      datasetId: item.datasetId,
      indicatorLabel: item.indicatorLabel,
      unit: item.unit,
      codes: [...item.codes],
      observations: item.observations,
    })),
  lineage: {
    native: datasets.filter((dataset) => dataset.lineage.mode === "native").length,
    connected: datasets.filter((dataset) => dataset.lineage.mode === "connected").length,
    connections: datasets
      .filter((dataset) => dataset.lineage.mode === "connected")
      .map((dataset) => ({
        id: dataset.id,
        originalId: dataset.lineage.originalId,
        originalTitle: dataset.lineage.originalTitle,
        connections: dataset.lineage.connections,
      })),
  },
  byBucket: Object.fromEntries(
    sources.map((source) => [
      source.bucket,
      {
        datasets: datasets.filter((dataset) => dataset.lineage.bucket === source.bucket).length,
        observations: datasets
          .filter((dataset) => dataset.lineage.bucket === source.bucket)
          .reduce((sum, dataset) => sum + dataset.rows.length, 0),
      },
    ]),
  ),
};
const auditRoot = resolve(publicRoot, "industrial/dataroom");
await writeFile(resolve(auditRoot, "RI-AUDIT.json"), `${JSON.stringify(audit, null, 2)}\n`);
await writeFile(
  resolve(auditRoot, "RI-AUDIT.md"),
  `# RI data audit

Imported ${audit.importedDatasets} datasets and ${audit.importedObservations} observations from buckets 08–11.

- Parsed table blocks: ${audit.parsedBlocks}
- Registered RI graph cards: ${audit.graphCards}
- Graph cards without a matched imported table: ${audit.unmatchedGraphCards.length}
- Internal operational tables retained only in the audit: ${audit.excludedOperationalTables.length}
- Parsed blocks with fewer than two observations: ${audit.blocksWithoutTwoObservations.length}
- Native RI datasets: ${audit.lineage.native}
- Connected datasets: ${audit.lineage.connected}

Connected datasets remain in RI and point to the canonical Ukraine Dataroom corner. The original RI graph ID and title are preserved in every dataset summary.
`,
);
const manifestPath = resolve(auditRoot, "manifest.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
manifest.meta.riAudit = {
  json: "/data/dataroom/RI-AUDIT.json",
  markdown: "/data/dataroom/RI-AUDIT.md",
  nativeDatasets: audit.lineage.native,
  connectedDatasets: audit.lineage.connected,
  unmatchedGraphCards: audit.unmatchedGraphCards.length,
};
await writeFile(manifestPath, `${JSON.stringify(manifest)}\n`);

const connectionRegistry = {
  generatedAt,
  contract: "Ukraine Proto Fund Dataroom RI connection registry v1",
  canonicalCorner: "https://ukraine.proto.fund/corner/industrial",
  apiBase: "https://ukraine.proto.fund/api/v1/ukraine",
  datasets: datasets.map((dataset) => ({
    riOriginalId: dataset.lineage.originalId,
    riOriginalTitle: dataset.lineage.originalTitle,
    bucket: dataset.lineage.bucket,
    mode: dataset.lineage.mode,
    dataRoomDatasetId: dataset.id,
    graphCodeBase: `UA-RI-${String(dataset.number).padStart(4, "0")}`,
    page: `https://ukraine.proto.fund/corner/industrial/dataset/${dataset.id}`,
    datasetApi: `https://ukraine.proto.fund/api/v1/ukraine/corners/industrial/datasets/${dataset.id}`,
    seriesApi: `https://ukraine.proto.fund/api/v1/ukraine/corners/industrial/datasets/${dataset.id}/series`,
    connections: dataset.lineage.connections,
  })),
};
await writeFile(
  resolve(auditRoot, "ri-connections.json"),
  `${JSON.stringify(connectionRegistry, null, 2)}\n`,
);
const riRegistryTargets = [
  resolve(root, "../ri-web/public/data/ukraine-dataroom-connections.json"),
  resolve(root, "../ri-web/site/public/data/ukraine-dataroom-connections.json"),
];
for (const target of riRegistryTargets) {
  await mkdir(resolve(target, ".."), { recursive: true });
  await writeFile(target, `${JSON.stringify(connectionRegistry, null, 2)}\n`);
}
manifest.meta.riConnections = {
  json: "/data/dataroom/ri-connections.json",
  datasets: connectionRegistry.datasets.length,
};
await writeFile(manifestPath, `${JSON.stringify(manifest)}\n`);

const observations = datasets.reduce((sum, dataset) => sum + dataset.rows.length, 0);
console.log(
  `Industrial corner: ${datasets.length} datasets, ${observations} observations from RI buckets 08-11 -> ${databasePath}`,
);
