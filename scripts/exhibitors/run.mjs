/**
 * Runs scripts/exhibitors/discover-catalog.ts: bundles it (with the app's
 * lib/ modules and the "@/" alias from tsconfig) using the esbuild that ships
 * with vitest, then executes it. Arguments are passed through:
 *
 *   npm run exhibitors:discover -- --limit=200 --concurrency=8
 */
import { build } from 'esbuild';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const outfile = path.join(root, '.next', 'cache', 'exhibitor-batch', 'discover-catalog.cjs');

await build({
  entryPoints: [path.join(root, 'scripts', 'exhibitors', 'discover-catalog.ts')],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  outfile,
  tsconfig: path.join(root, 'tsconfig.json'),
  external: ['next', 'next/*'],
  logLevel: 'warning',
});

await import(pathToFileURL(outfile).href);
