/**
 * Runs scripts/exhibitors/sync-crm.ts the way run.mjs runs discovery: bundled with esbuild (shipped with
 * vitest) so the app's lib/ modules and the "@/" alias resolve; Prisma stays external and loads as installed.
 * Arguments are passed through:
 *
 *   npm run exhibitors:sync-crm -- --slug=aapex-las-vegas-nv-2026-11-03 [--write]
 */
import { build } from 'esbuild';
import nextEnv from '@next/env';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
// The app's own .env resolution (.env, .env.local, …), so Prisma reaches the same database the app does.
nextEnv.loadEnvConfig(root);
const outfile = path.join(root, '.next', 'cache', 'exhibitor-batch', 'sync-crm.cjs');

await build({
  entryPoints: [path.join(root, 'scripts', 'exhibitors', 'sync-crm.ts')],
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
