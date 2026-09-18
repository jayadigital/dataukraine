import { resolve } from "node:path";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
export const root = resolve(here, "../..");
export const dataRoot = resolve(root, "data");
export const publicRoot = resolve(root, "public/data");
