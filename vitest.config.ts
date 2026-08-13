import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { configDefaults, defineConfig } from 'vitest/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@': __dirname,
    },
  },
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.{test,spec}.{ts,tsx}'],
    // tests/e2e holds Playwright specs, which need their own runner (and a live
    // server). Vitest would otherwise glob them and fail on the @playwright/test
    // import.
    exclude: [...configDefaults.exclude, 'tests/e2e/**'],
  },
});
