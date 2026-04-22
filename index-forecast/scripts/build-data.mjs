import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.resolve(__dirname, "..");
const sharedScript = path.resolve(appDir, "..", "datasets", "scripts", "build-annual-returns.mjs");
const sharedExport = path.resolve(appDir, "..", "datasets", "exports", "annual-returns.json");
const outputDir = path.join(appDir, "public", "data");
const outputFile = path.join(outputDir, "annual-returns.json");

if (!existsSync(sharedExport)) {
  execFileSync("node", [sharedScript], { stdio: "inherit" });
}

mkdirSync(outputDir, { recursive: true });
copyFileSync(sharedExport, outputFile);
console.log(`Synced shared annual returns dataset to ${outputFile}`);
