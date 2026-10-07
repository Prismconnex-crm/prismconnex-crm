/**
 * Copies the pdf.js worker into public/ before the Next build.
 *
 * Why this exists: pdf-plan-viewer.tsx used
 *
 *   new URL('pdfjs-dist/legacy/build/pdf.worker.min.mjs', import.meta.url)
 *
 * which makes webpack emit the worker as a build asset
 * (static/media/pdf.worker.min.<hash>.mjs) and then hand it to Terser. The
 * worker is an ES module — it contains `import.meta`, `import` and `export` —
 * and Terser parses emitted assets as classic scripts, so every production
 * build died with:
 *
 *   x 'import.meta' cannot be used outside of module code.
 *
 * `next dev` never minifies, which is why this only ever broke on Vercel.
 *
 * Serving the worker as a plain static file keeps it out of the bundler
 * entirely: no emit, no minification, and the browser loads it as a module
 * from /pdf.worker.min.mjs. Copied at build time rather than committed so it
 * can never drift from the installed pdfjs-dist version.
 */
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "node_modules", "pdfjs-dist", "legacy", "build", "pdf.worker.min.mjs");
const destination = join(root, "public", "pdf.worker.min.mjs");

if (!existsSync(source)) {
  // Not fatal: the viewer reports a load failure for that one plan, and the
  // rest of the site still builds. Failing the build here would be worse.
  console.warn(`[copy-pdf-worker] pdfjs-dist worker not found at ${source} — skipping.`);
  process.exit(0);
}

mkdirSync(dirname(destination), { recursive: true });
copyFileSync(source, destination);
console.log("[copy-pdf-worker] public/pdf.worker.min.mjs written.");
