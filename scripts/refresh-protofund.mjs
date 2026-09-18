import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const countryRoot = resolve(here, "..");
const workspaceRoot = resolve(countryRoot, "..");
const nbuRoot = resolve(workspaceRoot, "nbu-data-corner");
const statRoot = resolve(workspaceRoot, "derzhstat-data-corner");
const apiRoot = resolve(workspaceRoot, "osnova-data-plane");
const args = new Set(process.argv.slice(2));
const cadence = args.has("--weekly") ? "weekly" : "monthly";
const publish = args.has("--publish");
const refresh = !args.has("--cached");
const editorial = !args.has("--no-editorial");

const genericMonthly = [
  "budget",
  "oecd",
  "wb",
  "ilostat",
  "imf",
  "eurostat",
  "comtrade",
  "tradingeconomics",
];
const genericWeekly = ["tradingeconomics"];

function run(command, commandArgs, cwd, extraEnv = {}) {
  return new Promise((resolvePromise, reject) => {
    console.log(`\n[ProtoFund] ${command} ${commandArgs.join(" ")} (${cwd})`);
    const child = spawn(command, commandArgs, {
      cwd,
      env: {
        ...process.env,
        ...(refresh ? { RI_REFRESH: "1" } : {}),
        ...extraEnv,
      },
      stdio: "inherit",
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`${command} ${commandArgs.join(" ")} exited with ${code}`));
    });
  });
}

async function publishCorner(corner) {
  const script = corner === "nbu"
    ? "publish:nbu"
    : corner === "stat"
      ? "publish:stat"
      : `publish:${corner}`;
  await run("npm", ["run", script], apiRoot);
}

console.log(
  `[ProtoFund] ${cadence} refresh · source fetch ${refresh ? "enabled" : "cached"} · publish ${publish ? "enabled" : "disabled"}`,
);

await run("npm", ["run", "data:all"], nbuRoot);
if (cadence === "monthly") {
  await run("npm", ["run", "data:all"], statRoot);
}

const genericCorners = cadence === "monthly" ? genericMonthly : genericWeekly;
for (const corner of genericCorners) {
  await run("npm", ["run", `data:${corner}`], countryRoot);
}

if (publish) {
  await publishCorner("nbu");
  if (cadence === "monthly") await publishCorner("stat");
  for (const corner of genericCorners) await publishCorner(corner);
}

await run("npm", ["run", "data:ukraine"], countryRoot);
if (editorial) {
  await run("npm", ["run", "report:review"], countryRoot);
}
await run("npm", ["run", "build:app"], countryRoot);
await run("npm", ["test"], apiRoot);

if (publish) {
  await publishCorner("ukraine");
  await run("npx", [
    "wrangler",
    "deploy",
    "--config",
    "wrangler.ukraine.jsonc",
  ], countryRoot);
}

console.log(
  `[ProtoFund] ${cadence} refresh complete${publish ? " and published" : " locally"}.`,
);
