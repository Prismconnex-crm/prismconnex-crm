/**
 * Runs scripts/exhibitors/directories-report.ts the way run.mjs runs discovery: bundled with esbuild (shipped
 * with vitest) so the app's lib/ modules and the "@/" alias resolve. Reads files only — no database.
 *
 *   npm run exhibitors:directories
 */
import { build } from 'esbuild';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const outfile = path.join(root, '.next', 'cache', 'exhibitor-batch', 'directories-report.cjs');

await build({
  entryPoints: [path.join(root, 'scripts', 'exhibitors', 'directories-report.ts')],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  outfile,
  tsconfig: path.join(root, 'tsconfig.json'),
  external: ['next', 'next/*', '@prisma/client', '.prisma/client'],
  logLevel: 'warning',
});

await import(pathToFileURL(outfile).href);
