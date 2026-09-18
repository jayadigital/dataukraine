import { cp, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function run(command, args) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      env: process.env,
      stdio: "inherit",
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`${command} ${args.join(" ")} exited with ${code}`));
    });
  });
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function validateRelease(dataDir, corner) {
  const manifest = await readJson(
    join(dataDir, `${corner}/dataroom/manifest.json`),
  );
  const reports = await readJson(
    join(dataDir, `${corner}/reports/manifest.json`),
  );

  const minimum = {
    nbu: 24,
    stat: 32,
    budget: 9,
    oecd: 1,
    wb: 1_000,
    ilostat: 330,
    imf: 80,
    eurostat: 300,
    comtrade: 90,
    tradingeconomics: 30,
    industrial: 100,
    worldsteel: 2,
    owid: 10,
    uconomics: 100,
    ukraine: 13,
  }[corner];
  if (
    manifest.meta?.datasetCount < minimum ||
    manifest.meta?.liveDatasetCount < minimum
  ) {
    throw new Error(`${corner} release contains fewer than ${minimum} live datasets.`);
  }
  if (!Array.isArray(reports) || reports.length !== 3) {
    throw new Error(`${corner} release must contain all three reports.`);
  }
  for (const dataset of manifest.datasets) {
    if (!dataset.titleUa || !dataset.titleEn) {
      throw new Error(`${corner}/${dataset.id} is missing a bilingual title.`);
    }
    if (!dataset.graphCodeBase) {
      throw new Error(`${corner}/${dataset.id} is missing a stable graph code.`);
    }
    if (!dataset.readerGuide?.ua?.what || !dataset.readerGuide?.en?.what) {
      throw new Error(`${corner}/${dataset.id} is missing reader guidance.`);
    }
  }
}

async function validateStaticRelease(dataDir, corner) {
  const manifest = await readJson(
    join(dataDir, `${corner}/dataroom/manifest.json`),
  );
  const minimum = { frames: 12, scenarios: 4 }[corner];
  if (
    manifest.meta?.datasetCount < minimum ||
    manifest.meta?.liveDatasetCount < minimum
  ) {
    throw new Error(`${corner} static release contains fewer than ${minimum} live datasets.`);
  }
  for (const dataset of manifest.datasets) {
    const summary = await readJson(
      join(dataDir, `${corner}/dataroom/${dataset.id}/summary.json`),
    );
    if (!dataset.titleUa || !dataset.titleEn || !dataset.graphCodeBase) {
      throw new Error(`${corner}/${dataset.id} is missing bilingual metadata or a graph code.`);
    }
    if (!summary.indicators?.length && !summary.fallbackFacts?.length) {
      throw new Error(`${corner}/${dataset.id} has neither graph indicators nor fallback facts.`);
    }
    if (summary.indicators?.some((indicator) => !indicator.series?.length)) {
      throw new Error(`${corner}/${dataset.id} contains an indicator without chartable points.`);
    }
    if (corner === "frames" && !summary.sourceReferences?.some((reference) => /^uc-s-/u.test(reference.id))) {
      throw new Error(`${corner}/${dataset.id} is missing a canonical UC source reference.`);
    }
  }
  const reports = await readJson(join(dataDir, `${corner}/reports/manifest.json`));
  if (!Array.isArray(reports) || reports.length !== 3) {
    throw new Error(`${corner} static release must contain all three report entries.`);
  }
}

const releaseDir = await mkdtemp(join(tmpdir(), "ri-country-data-corners-"));
const corners = [
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
  "uconomics",
  "ukraine",
];
const validatedCorners = corners;
const staticCorners = ["frames", "scenarios"];

try {
  if (process.env.RI_DEPLOY_PREPARED !== "1") {
    await run("npm", ["run", "data:all"]);
    await run("npm", ["test"]);
    await run("npx", ["tsc", "-b"]);
  }
  await run("npm", ["run", "audit:release"]);
  for (const corner of validatedCorners) {
    await validateRelease(join(root, "public/data"), corner);
  }
  for (const corner of staticCorners) {
    await validateStaticRelease(join(root, "public/uc"), corner);
  }
  const audit = await readJson(join(root, "public/uc/data-quality-audit.json"));
  if (audit.status !== "pass" || audit.blockingFindings !== 0) {
    throw new Error("Release data-quality audit has blocking findings.");
  }
  await run("npx", [
    "vite",
    "build",
    "--outDir",
    releaseDir,
    "--emptyOutDir",
  ]);
  await cp(join(root, "public/uc"), join(releaseDir, "uc"), { recursive: true });
  const buildEntries = await readdir(releaseDir);
  if (buildEntries.includes("data")) {
    throw new Error("Frontend build contains the local data warehouse.");
  }
  await run("npx", [
    "wrangler",
    "deploy",
    "--config",
    "wrangler.ukraine.jsonc",
    "--assets",
    releaseDir,
  ]);
} finally {
  await rm(releaseDir, { recursive: true, force: true });
}
