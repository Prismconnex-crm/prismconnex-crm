/**
 * Runs scripts/event-timings/recheck-verified.ts: bundles it (with the app's
 * lib/ modules and the "@/" alias from tsconfig) using the esbuild that ships
 * with vitest, then executes it. Arguments are passed through:
 *
 *   node --max-old-space-size=512 --expose-gc scripts/event-timings/recheck-run.mjs --batches=1
 */
import { build } from 'esbuild';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const outfile = path.join(root, '.next', 'cache', 'event-timing-batch', 'recheck-verified.cjs');

await build({
  entryPoints: [path.join(root, 'scripts', 'event-timings', 'recheck-verified.ts')],
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
