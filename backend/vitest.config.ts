import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  // Resolves the path aliases declared in tsconfig.json, including the ones
  // added by `nest g library`.
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['src/**/*.spec.ts'],
    exclude: ['test/**', '**/node_modules/**', 'dist/**'],
    testTimeout: 120000,
    hookTimeout: 120000,
    setupFiles: ['dotenv/config'],
  },
});
