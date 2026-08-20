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
  // Next compiles JSX with the automatic runtime, so components do not import
  // React. esbuild defaults to the classic transform, under which any component
  // rendered in a test throws "React is not defined" — matching Next here is
  // what lets the .tsx tests the include pattern already globs actually run.
  esbuild: { jsx: 'automatic' },
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
