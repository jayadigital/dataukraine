interface Env {
  ASSETS: Fetcher;
  API_ORIGIN: string;
  CORNER:
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
    | "ukraine";
}

const sourceCorners = [
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
] as const;

const staticCorners = ["uconomics", "frames", "scenarios"] as const;
const publishedCorners = [...sourceCorners, ...staticCorners] as const;
const apiCorners = [...sourceCorners, "ukraine"] as const;
type PublicCorner = (typeof publishedCorners)[number];
type ActiveCorner = PublicCorner | "ukraine";

const CANONICAL_ORIGIN = "https://dataukraine.proto.fund";
const dataUkraineLogoUrl = "https://storage.googleapis.com/osnova_pub/du/du_logo_id_transparent.png";

const sourceNames: Record<string, string> = {
  nbu: "NBU",
  stat: "State Statistics Service of Ukraine",
  budget: "Open Budget",
  oecd: "OECD",
  wb: "World Bank",
  ilostat: "ILOSTAT",
  imf: "IMF",
  eurostat: "Eurostat",
  comtrade: "UN Comtrade",
  tradingeconomics: "Trading Economics",
  industrial: "RI Industrial Economy",
  worldsteel: "World Steel Association",
  owid: "Our World in Data",
  uconomics: "Uconomics 0.1",
  frames: "Foresight Frames",
  scenarios: "Foresight Scenarios",
  ukraine: "DataUkraine",
};

interface GraphAliasRecord {
  shortId: string;
  graphCodeBase?: string;
  corner?: string;
  datasetId?: string;
  title?: string;
  titleUa?: string;
  titleEn?: string;
  url?: string;
}

interface DatasetSummary {
  title?: string;
  titleUa?: string;
  titleEn?: string;
  description?: string;
  descriptionUa?: string;
  descriptionEn?: string;
}

interface SeoMeta {
  title: string;
  description: string;
  canonical: string;
  locale: "uk" | "en";
  activeCorner: ActiveCorner;
  dataset?: string;
  graphCode?: string;
  datasetTitle?: string;
}

function requestCorner(url: URL, fallback: Env["CORNER"]): Env["CORNER"] {
  const subdomain = url.hostname.split(".")[0];
  return publishedCorners.includes(subdomain as (typeof publishedCorners)[number])
    ? subdomain as Env["CORNER"]
    : fallback;
}

function pathCorner(url: URL): ActiveCorner | null {
  const value = url.pathname.match(/^\/corner\/([^/]+)/)?.[1];
  return value && publishedCorners.includes(value as PublicCorner)
    ? value as PublicCorner
    : null;
}

function canonicalUiUrl(url: URL, corner: Env["CORNER"], activeCorner?: ActiveCorner) {
  const canonical = new URL(CANONICAL_ORIGIN);
  const resolvedCorner = activeCorner ?? corner;
  const pathname = url.pathname;
  const isUniversalPath =
    pathname.startsWith("/corner/") ||
    pathname.startsWith("/id/") ||
    pathname.startsWith("/embed/") ||
    pathname.startsWith("/developers") ||
    pathname.startsWith("/magazine") ||
    pathname === "/frames" ||
    pathname === "/scenarios";

  if (pathname === "/") {
    canonical.pathname = resolvedCorner === "ukraine" ? "/" : `/corner/${resolvedCorner}`;
  } else if (isUniversalPath) {
    canonical.pathname = pathname;
  } else if (pathname.startsWith("/dataset/") || pathname.startsWith("/report/")) {
    canonical.pathname = resolvedCorner === "ukraine"
      ? pathname
      : `/corner/${resolvedCorner}${pathname}`;
  } else {
    canonical.pathname = resolvedCorner === "ukraine" ? pathname : `/corner/${resolvedCorner}`;
  }
  canonical.search = url.search;
  return canonical;
}

function json(value: unknown) {
  return Response.json(value, {
    headers: {
      "cache-control": "public, max-age=300",
      "x-content-type-options": "nosniff",
    },
  });
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escapeXml(value: string) {
  return escapeHtml(value).replaceAll("'", "&apos;");
}

function safeJson(value: unknown) {
  return JSON.stringify(value).replaceAll("<", "\\u003c");
}

async function loadAliasRecord(url: URL, shortId: string, assets: Fetcher) {
  try {
    const response = await assets.fetch(new Request(new URL("/uc/id-index.json", url)));
    if (!response.ok) return null;
    const payload = await response.json() as {
      byShortId?: Record<string, GraphAliasRecord>;
    };
    return payload.byShortId?.[shortId.toLowerCase()] ?? null;
  } catch {
    return null;
  }
}

async function loadDatasetSummary(
  url: URL,
  activeCorner: ActiveCorner,
  dataset: string,
  apiOrigin: string,
  assets: Fetcher,
) {
  try {
    if (staticCorners.includes(activeCorner as (typeof staticCorners)[number])) {
      const response = await assets.fetch(
        new Request(new URL(`/uc/${activeCorner}/dataroom/${dataset}/summary.json`, url)),
      );
      return response.ok ? await response.json() as DatasetSummary : null;
    }
    if (activeCorner === "ukraine" || !apiOrigin) return null;
    const response = await fetch(
      new URL(`/v1/${activeCorner}/data/dataroom/${dataset}/summary.json`, apiOrigin),
      { headers: { accept: "application/json" } },
    );
    return response.ok ? await response.json() as DatasetSummary : null;
  } catch {
    return null;
  }
}

async function socialMetadata(
  url: URL,
  corner: Env["CORNER"],
  apiOrigin: string,
  assets: Fetcher,
) : Promise<SeoMeta> {
  const locale = url.searchParams.get("lang") === "en" ? "en" : "uk";
  const idMatch = url.pathname.match(/^\/(?:id|embed)\/([^/?#]+)/);
  const alias = idMatch ? await loadAliasRecord(url, idMatch[1], assets) : null;
  const activeCorner = (
    alias?.corner && (publishedCorners.includes(alias.corner as PublicCorner) || alias.corner === "ukraine")
      ? alias.corner
      : pathCorner(url) ?? corner
  ) as ActiveCorner;
  const dataset = url.pathname.match(/\/dataset\/([^/]+)/)?.[1] ?? alias?.datasetId;
  const summary = dataset
    ? await loadDatasetSummary(url, activeCorner, dataset, apiOrigin, assets)
    : null;
  const sourceName = sourceNames[activeCorner] ?? "DataUkraine";
  const baseTitle = activeCorner === "ukraine"
    ? "DataUkraine — дані про економіку України"
    : `${sourceName} · DataUkraine`;
  const baseDescription = activeCorner === "ukraine"
    ? "Відкриті дані про економіку України: макроекономіка, державні фінанси, банки, торгівля, праця, промисловість і міжнародні порівняння."
    : `Показники, визначення, періоди, одиниці та вихідні ряди ${sourceName} для дослідження України.`;
  const datasetTitle = locale === "en"
    ? summary?.titleEn ?? alias?.titleEn ?? summary?.title ?? alias?.title
    : summary?.titleUa ?? alias?.titleUa ?? summary?.title ?? alias?.title;
  const description = locale === "en"
    ? summary?.descriptionEn ?? summary?.description ?? baseDescription
    : summary?.descriptionUa ?? summary?.description ?? baseDescription;
  const title = datasetTitle
    ? `${datasetTitle} · ${sourceName} · DataUkraine`
    : baseTitle;
  const canonical = canonicalUiUrl(url, corner, activeCorner);
  canonical.searchParams.delete("lang");
  canonical.searchParams.delete("chart");
  canonical.searchParams.delete("view");
  canonical.searchParams.delete("theme");
  canonical.hash = "";
  return {
    title,
    description,
    canonical: canonical.toString(),
    locale,
    activeCorner,
    dataset,
    graphCode: alias?.graphCodeBase,
    datasetTitle,
  };
}

function structuredData(meta: SeoMeta) {
  const page = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: meta.title,
    description: meta.description,
    url: meta.canonical,
    inLanguage: meta.locale,
    isAccessibleForFree: true,
    isPartOf: { "@type": "WebSite", name: "DataUkraine", url: CANONICAL_ORIGIN },
  };
  const website = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "DataUkraine",
    url: CANONICAL_ORIGIN,
    description: "Source-backed public data about Ukraine and its economy.",
    inLanguage: ["uk", "en"],
    publisher: {
      "@type": "Organization",
      name: "DataUkraine",
      url: CANONICAL_ORIGIN,
      logo: { "@type": "ImageObject", url: dataUkraineLogoUrl },
    },
  };
  const nodes: Record<string, unknown>[] = [website, page];
  if (meta.dataset) {
    nodes.push({
      "@context": "https://schema.org",
      "@type": "Dataset",
      name: meta.datasetTitle ?? meta.title,
      description: meta.description,
      url: meta.canonical,
      identifier: meta.graphCode ?? meta.dataset,
      inLanguage: meta.locale,
      isAccessibleForFree: true,
      creator: { "@type": "Organization", name: sourceNames[meta.activeCorner] ?? "DataUkraine" },
      publisher: { "@type": "Organization", name: "DataUkraine", url: CANONICAL_ORIGIN },
      distribution: [{
        "@type": "DataDownload",
        encodingFormat: "application/json",
        contentUrl: staticCorners.includes(meta.activeCorner as (typeof staticCorners)[number])
          ? `${CANONICAL_ORIGIN}/uc/${meta.activeCorner}/dataroom/${encodeURIComponent(meta.dataset)}/summary.json`
          : `${CANONICAL_ORIGIN}/api/corners/${meta.activeCorner}/data/dataroom/${encodeURIComponent(meta.dataset)}/summary.json`,
      }],
    });
    nodes.push({
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "DataUkraine", item: CANONICAL_ORIGIN },
        { "@type": "ListItem", position: 2, name: sourceNames[meta.activeCorner] ?? meta.activeCorner, item: `${CANONICAL_ORIGIN}/corner/${meta.activeCorner}` },
        { "@type": "ListItem", position: 3, name: meta.datasetTitle ?? meta.dataset, item: meta.canonical },
      ],
    });
  }
  return safeJson(nodes);
}

async function withSocialMetadata(
  request: Request,
  response: Response,
  corner: Env["CORNER"],
  apiOrigin: string,
  assets: Fetcher,
) {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html")) return response;
  const url = new URL(request.url);
  const meta = await socialMetadata(url, corner, apiOrigin, assets);
  const html = await response.text();
  const alternateUk = new URL(meta.canonical);
  alternateUk.searchParams.set("lang", "uk");
  const alternateEn = new URL(meta.canonical);
  alternateEn.searchParams.set("lang", "en");
  const localeCode = meta.locale === "en" ? "en_US" : "uk_UA";
  const tags = `
    <link rel="canonical" href="${escapeHtml(meta.canonical)}" data-dataukraine-seo="canonical" />
    <link rel="alternate" hreflang="uk" href="${escapeHtml(alternateUk.toString())}" data-dataukraine-seo="alternate" />
    <link rel="alternate" hreflang="en" href="${escapeHtml(alternateEn.toString())}" data-dataukraine-seo="alternate" />
    <link rel="alternate" hreflang="x-default" href="${escapeHtml(meta.canonical)}" data-dataukraine-seo="alternate" />
    <meta name="description" content="${escapeHtml(meta.description)}" data-dataukraine-seo="description" />
    <meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1" data-dataukraine-seo="robots" />
    <meta name="googlebot" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1" data-dataukraine-seo="googlebot" />
    <meta name="author" content="DataUkraine" data-dataukraine-seo="author" />
    <meta property="og:type" content="website" data-dataukraine-seo="og" />
    <meta property="og:site_name" content="DataUkraine" data-dataukraine-seo="og" />
    <meta property="og:locale" content="${localeCode}" data-dataukraine-seo="og" />
    <meta property="og:locale:alternate" content="${meta.locale === "en" ? "uk_UA" : "en_US"}" data-dataukraine-seo="og" />
    <meta property="og:title" content="${escapeHtml(meta.title)}" data-dataukraine-seo="og" />
    <meta property="og:description" content="${escapeHtml(meta.description)}" data-dataukraine-seo="og" />
    <meta property="og:url" content="${escapeHtml(meta.canonical)}" data-dataukraine-seo="og" />
    <meta property="og:image" content="${escapeHtml(dataUkraineLogoUrl)}" data-dataukraine-seo="og" />
    <meta property="og:image:alt" content="DataUkraine" data-dataukraine-seo="og" />
    <meta name="twitter:card" content="summary_large_image" data-dataukraine-seo="twitter" />
    <meta name="twitter:title" content="${escapeHtml(meta.title)}" data-dataukraine-seo="twitter" />
    <meta name="twitter:description" content="${escapeHtml(meta.description)}" data-dataukraine-seo="twitter" />
    <meta name="twitter:image" content="${escapeHtml(dataUkraineLogoUrl)}" data-dataukraine-seo="twitter" />
    <script type="application/ld+json" data-dataukraine-seo="jsonld">${structuredData(meta)}</script>`;
  const fallback = `
    <noscript data-dataukraine-seo="fallback"><main><h1>${escapeHtml(meta.title)}</h1><p>${escapeHtml(meta.description)}</p><p><a href="${escapeHtml(meta.canonical)}">DataUkraine</a></p></main></noscript>`;
  const decorated = html
    .replace(/<html([^>]*?)lang="[^"]*"/i, '<html$1lang="' + meta.locale + '"')
    .replace(/<title>.*?<\/title>/i, `<title>${escapeHtml(meta.title)}</title>`)
    .replace(/<meta\s+name="description"[^>]*>/i, "")
    .replace("</head>", `${tags}\n</head>`)
    .replace("<body>", `${fallback}\n<body>`);
  const headers = new Headers(response.headers);
  headers.delete("content-length");
  headers.set("x-robots-tag", "index, follow");
  headers.set("link", `<${meta.canonical}>; rel="canonical"`);
  return new Response(decorated, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function robots() {
  return new Response(
    [
      "User-agent: *",
      "Allow: /",
      "Disallow: /api/",
      "Disallow: /embed/",
      `Sitemap: ${CANONICAL_ORIGIN}/sitemap.xml`,
      "",
    ].join("\n"),
    {
      headers: {
        "cache-control": "public, max-age=3600",
        "content-type": "text/plain; charset=utf-8",
      },
    },
  );
}

async function sitemap(url: URL, assets: Fetcher) {
  const paths = new Set<string>([
    "/",
    "/magazine",
    "/developers",
    "/developers/widgets",
    "/frames",
    "/scenarios",
    ...publishedCorners.map((corner) => `/corner/${corner}`),
  ]);
  try {
    const response = await assets.fetch(new Request(new URL("/uc/id-index.json", url)));
    if (response.ok) {
      const payload = await response.json() as { byShortId?: Record<string, GraphAliasRecord> };
      for (const record of Object.values(payload.byShortId ?? {})) {
        if (record.shortId) paths.add(`/id/${encodeURIComponent(record.shortId)}`);
        if (record.corner && record.datasetId && publishedCorners.includes(record.corner as PublicCorner)) {
          paths.add(`/corner/${record.corner}/dataset/${encodeURIComponent(record.datasetId)}`);
        }
      }
    }
  } catch {
    // The core catalogue remains in the sitemap if the generated alias index is unavailable.
  }
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${[...paths]
    .sort()
    .map((path) => `<url><loc>${escapeXml(`${CANONICAL_ORIGIN}${path}`)}</loc></url>`)
    .join("")}</urlset>`;
  return new Response(body, {
    headers: {
      "cache-control": "public, max-age=3600",
      "content-type": "application/xml; charset=utf-8",
      "x-content-type-options": "nosniff",
    },
  });
}

export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);
    const corner = requestCorner(url, env.CORNER);
    if (url.pathname === "/robots.txt") return robots();
    if (url.pathname === "/sitemap.xml") return sitemap(url, env.ASSETS);
    if (
      env.CORNER === "ukraine" &&
      (url.pathname.startsWith("/api/v1/ukraine") ||
        url.pathname === "/api/openapi.json")
    ) {
      if (!env.API_ORIGIN) {
        return json({ ok: false, error: "Cloud data API is not configured" });
      }
      if (request.method !== "GET" && request.method !== "HEAD") {
        return Response.json({ error: "Public API is read-only" }, { status: 405 });
      }
      const upstream = new URL(env.API_ORIGIN);
      upstream.pathname = url.pathname === "/api/openapi.json"
        ? "/v1/ukraine/openapi.json"
        : url.pathname.slice("/api".length);
      upstream.search = url.search;
      return fetch(new Request(upstream, request));
    }
    if (url.pathname === "/api/data/universal.json" || url.pathname === "/api/data/id-index.json") {
      const assetPath = url.pathname.replace("/api/data/", "/uc/");
      return env.ASSETS.fetch(new Request(new URL(assetPath, url), request));
    }
    if (url.pathname.startsWith("/api/data/")) {
      if (!env.API_ORIGIN) {
        return json({ ok: false, error: "Cloud data API is not configured" });
      }
      const upstream = new URL(env.API_ORIGIN);
      upstream.pathname = url.pathname.replace(
        "/api/data/",
        `/v1/${corner}/data/`,
      );
      upstream.search = url.search;
      return fetch(new Request(upstream, request));
    }
    const cornerData = url.pathname.match(/^\/api\/corners\/([^/]+)\/data\/(.+)$/);
    if (cornerData && apiCorners.includes(cornerData[1] as (typeof apiCorners)[number])) {
      if (!env.API_ORIGIN) {
        return json({ ok: false, error: "Cloud data API is not configured" });
      }
      const upstream = new URL(env.API_ORIGIN);
      upstream.pathname = `/v1/${cornerData[1]}/data/${cornerData[2]}`;
      upstream.search = url.search;
      return fetch(new Request(upstream, request));
    }
    const legacyDataPrefix =
      corner === "nbu"
        ? "/api/nbu-data/"
        : corner === "stat"
          ? "/api/stat-data/"
          : null;
    if (legacyDataPrefix && url.pathname.startsWith(legacyDataPrefix)) {
      if (!env.API_ORIGIN) {
        return json({ ok: false, error: "Cloud data API is not configured" });
      }
      const upstream = new URL(env.API_ORIGIN);
      upstream.pathname = url.pathname.replace(
        legacyDataPrefix,
        `/v1/${corner}/data/`,
      );
      upstream.search = url.search;
      return fetch(new Request(upstream, request));
    }
    if (url.pathname === "/api/cloud-health") {
      if (!env.API_ORIGIN) {
        return json({ ok: false, error: "Cloud data API is not configured" });
      }
      return fetch(new URL("/health", env.API_ORIGIN));
    }
    if (url.pathname === "/api/health") {
      return json({
        ok: true,
        service: `ukraine-dataroom-${corner}`,
        dataManifest: "/api/data/dataroom/manifest.json",
        time: new Date().toISOString(),
      });
    }
    const legacyHtmlHost = url.hostname === "ukraine.proto.fund" || url.hostname === "ukraine.osnova.ai";
    if (legacyHtmlHost && request.method === "GET" && !url.pathname.startsWith("/api/")) {
      return Response.redirect(canonicalUiUrl(url, corner, pathCorner(url) ?? corner), 308);
    }
    if (corner !== "ukraine") {
      return Response.redirect(canonicalUiUrl(url, corner, pathCorner(url) ?? corner), 308);
    }
    return withSocialMetadata(
      request,
      await env.ASSETS.fetch(request),
      corner,
      env.API_ORIGIN,
      env.ASSETS,
    );
  },
};
