import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const bucket = process.env.GCS_BUCKET;
if (!bucket) {
  console.error("Set GCS_BUCKET to the flat-file bucket name.");
  process.exit(1);
}

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const day = new Date().toISOString().slice(0, 10);
const source = "public/data";
const liveDestination = `gs://${bucket}/ri-derzhstat-data-corner/data`;

function gcloud(args) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn("gcloud", ["storage", ...args], {
      cwd: root,
      stdio: "inherit",
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`gcloud storage exited with ${code}`));
    });
  });
}

await gcloud(["rsync", "--recursive", source, liveDestination]);

if (process.env.GCS_ARCHIVE_RELEASES === "1") {
  await gcloud([
    "cp",
    "--recursive",
    `${source}/**`,
    `gs://${bucket}/ri-derzhstat-data-corner/releases/${day}/data`,
  ]);
}

console.log(`Published the flat-file data room to ${liveDestination}.`);
console.log(
  `Optional UI origin: https://storage.googleapis.com/${bucket}/ri-derzhstat-data-corner/data`,
);
