import { spawn } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const reportPath = resolve(
  process.env.REPORT_INPUT ||
    resolve(root, "public/data/ukraine/reports/dataroom-update.md"),
);
const outputPath = resolve(
  process.env.REPORT_OUTPUT ||
    resolve(root, "public/data/ukraine/reports/dataroom-update.reviewed.md"),
);

function runCommand(command, prompt, timeoutMs = 10 * 60 * 1000) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, {
      shell: true,
      stdio: ["pipe", "pipe", "pipe"],
      env: process.env,
    });
    let stdout = "";
    let stderr = "";
    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`Command timed out: ${command}`));
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      clearTimeout(timeout);
      if (code === 0 && stdout.trim()) {
        resolvePromise(stdout.trim());
      } else {
        reject(
          new Error(
            `Command failed (${code}): ${command}\n${stderr.slice(-1200)}`,
          ),
        );
      }
    });
    child.stdin.end(prompt);
  });
}

const original = await readFile(reportPath, "utf8");
let critique =
  "Локальний Phi-прохід пропущено: змінна PHI_CMD не налаштована.";
let edited = original;

if (process.env.PHI_CMD) {
  console.log("Launching Phi critic...");
  critique = await runCommand(
    process.env.PHI_CMD,
    `Ти критичний макроекономічний редактор. Перевір звіт нижче на перебільшення, слабкі причинні висновки, неузгоджені періоди порівняння та пропущені ризики. Не змінюй цифри. Поверни стислий список правок українською.\n\n${original}`,
  );
  console.log("Phi critic closed.");
}

if (process.env.MAMAY_CMD) {
  console.log("Launching Mamay literary editor...");
  edited = await runCommand(
    process.env.MAMAY_CMD,
    `Ти український літературний редактор економічного видання. Відредагуй звіт: зроби його ясним, точним і природним, збережи Markdown та всі цифри без змін. Врахуй критичні зауваження, але не додавай причин без доказів.\n\nКРИТИКА:\n${critique}\n\nОРИГІНАЛ:\n${original}`,
  );
  console.log("Mamay editor closed.");
}

await writeFile(outputPath, `${edited.trim()}\n`);

const payload = {
  generatedAt: new Date().toISOString(),
  editorialStatus:
    process.env.PHI_CMD || process.env.MAMAY_CMD ? "local-ai-reviewed" : "deterministic",
  critique,
  markdown: edited,
};

if (process.env.PUBLISH_ENDPOINT && process.env.AI_REPORT_TOKEN) {
  const response = await fetch(process.env.PUBLISH_ENDPOINT, {
    method: "POST",
    headers: {
      authorization: `Bearer ${process.env.AI_REPORT_TOKEN}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(`Report publication failed: ${response.status}`);
  }
  console.log(`Published AI-reviewed report to ${process.env.PUBLISH_ENDPOINT}`);
}

console.log(`Weekly editorial output: ${outputPath}`);
