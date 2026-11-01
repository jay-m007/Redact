// Copies the web page, the engine and the text-reading files into site/. No bundler.
// Run `npm install` once first: the text reader (tesseract.js) and its English data come from npm.
import { cpSync, mkdirSync, rmSync, existsSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "site");
const nm = (p) => join(root, "node_modules", p);
const need = [
  ["tesseract.js/dist/tesseract.esm.min.js", "vendor/tesseract.esm.min.js"],
  ["tesseract.js/dist/worker.min.js", "vendor/worker.min.js"],
  ["tesseract.js-core/tesseract-core-lstm.wasm.js", "vendor/core/tesseract-core-lstm.wasm.js"],
  ["tesseract.js-core/tesseract-core-simd-lstm.wasm.js", "vendor/core/tesseract-core-simd-lstm.wasm.js"],
  ["@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz", "vendor/lang/eng.traineddata.gz"],
  ["tesseract.js/LICENSE.md", "vendor/LICENSE-tesseract.js.txt"],
];
for (const [from] of need) if (!existsSync(nm(from))) { console.error(`Missing ${from}. Run "npm install" first.`); process.exit(1); }
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync(join(root, "web"), out, { recursive: true });
cpSync(join(root, "engine"), join(out, "engine"), { recursive: true });
for (const [from, to] of need) { mkdirSync(dirname(join(out, to)), { recursive: true }); cpSync(nm(from), join(out, to)); }
for (const f of ["index.html", "app.js", "style.css", "ocr.js", "sw.js", "engine/index.js", "vendor/worker.min.js", "vendor/lang/eng.traineddata.gz"]) {
  if (!existsSync(join(out, f))) { console.error("Build is missing " + f); process.exit(1); }
}
const mb = (p) => (statSync(join(out, p)).size / 1048576).toFixed(1) + " MB";
console.log(`Built site/ -> ${out}\n  text reader loads on demand: ${mb("vendor/core/tesseract-core-simd-lstm.wasm.js")} + ${mb("vendor/lang/eng.traineddata.gz")}`);
