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

const publishedCorners = [...sourceCorners, "uconomics"] as const;

const apiCorners = [...sourceCorners, "ukraine"] as const;
const dataUkraineLogoUrl = "https://storage.googleapis.com/osnova_pub/du/du_logo_id_transparent.png";

function requestCorner(url: URL, fallback: Env["CORNER"]): Env["CORNER"] {
  const subdomain = url.hostname.split(".")[0];
  return publishedCorners.includes(subdomain as (typeof publishedCorners)[number])
    ? subdomain as Env["CORNER"]
    : fallback;
}

function canonicalUiUrl(url: URL, corner: Env["CORNER"]) {
  const canonical = new URL("https://ukraine.proto.fund");
  const suffix = url.pathname === "/"
    ? ""
    : url.pathname.startsWith("/dataset/") || url.pathname.startsWith("/report/")
      ? url.pathname
      : "";
  canonical.pathname = `/corner/${corner}${suffix}`;
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

async function socialMetadata(
  url: URL,
  corner: Env["CORNER"],
  apiOrigin: string,
  assets: Fetcher,
) {
  const sourceNames: Record<Env["CORNER"], string> = {
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
    ukraine: "Ukraine Dataroom",
  };
  const pathCorner = url.pathname.match(/^\/corner\/([^/]+)/)?.[1];
  const activeCorner = publishedCorners.includes(pathCorner as (typeof publishedCorners)[number])
    ? pathCorner as Env["CORNER"]
    : corner;
  const dataset = url.pathname.match(/\/dataset\/([^/]+)/)?.[1];
  const subject = url.searchParams.get("chart") ?? dataset;
  let title = subject
    ? `${sourceNames[activeCorner]} · ${subject.replaceAll("-", " ")}`
    : sourceNames[activeCorner];
  let description = activeCorner === "ukraine"
    ? "Thirteen sources for Ukraine: macroeconomics, public finance, banking, trade, labour, budget, industry, steel and long international series."
    : `Definitions, periods, units and source series from ${sourceNames[activeCorner]}.`;
  if (dataset && activeCorner === "uconomics") {
    try {
      const response = await assets.fetch(
        new Request(new URL(`/uc/uconomics/dataroom/${dataset}/summary.json`, url)),
      );
      if (response.ok) {
        const summary = await response.json() as {
          title?: string;
          titleUa?: string;
          description?: string;
          descriptionUa?: string;
        };
        title = `${sourceNames[activeCorner]} · ${summary.titleUa ?? summary.title ?? dataset}`;
        description = summary.descriptionUa ?? summary.description ?? description;
      }
    } catch {
      // A readable source-and-slug fallback keeps the public page available.
    }
  } else if (dataset && activeCorner !== "ukraine" && apiOrigin) {
    try {
      const summaryUrl = new URL(
        `/v1/${activeCorner}/data/dataroom/${dataset}/summary.json`,
        apiOrigin,
      );
      const response = await fetch(summaryUrl, {
        headers: { accept: "application/json" },
      });
      if (response.ok) {
        const summary = await response.json() as {
          title?: string;
          titleUa?: string;
          description?: string;
          descriptionUa?: string;
        };
        title = `${sourceNames[activeCorner]} · ${summary.titleUa ?? summary.title ?? dataset}`;
        description = summary.descriptionUa ?? summary.description ?? description;
      }
    } catch {
      // A readable source-and-slug fallback keeps the public page available.
    }
  }
  const canonical = new URL(url);
  canonical.searchParams.delete("lang");
  canonical.hash = "";
  return { title, description, canonical: canonical.toString() };
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
  const tags = `
    <link rel="canonical" href="${escapeHtml(meta.canonical)}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Ukraine Dataroom" />
    <meta property="og:title" content="${escapeHtml(meta.title)}" />
    <meta property="og:description" content="${escapeHtml(meta.description)}" />
    <meta property="og:url" content="${escapeHtml(meta.canonical)}" />
    <meta property="og:image" content="${escapeHtml(dataUkraineLogoUrl)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(meta.title)}" />
    <meta name="twitter:description" content="${escapeHtml(meta.description)}" />`;
  const decorated = html
    .replace(/<title>.*?<\/title>/i, `<title>${escapeHtml(meta.title)}</title>`)
    .replace("</head>", `${tags}\n</head>`);
  const headers = new Headers(response.headers);
  headers.delete("content-length");
  headers.set("x-robots-tag", "index, follow");
  return new Response(decorated, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);
    const corner = requestCorner(url, env.CORNER);
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
    if (corner !== "ukraine") {
      return Response.redirect(canonicalUiUrl(url, corner), 308);
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
