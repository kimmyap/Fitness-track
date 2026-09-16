/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { swPrecache } from './vite-plugin-sw-precache';

export default defineConfig({
  plugins: [react({ jsxImportSource: '@emotion/react' }), swPrecache()],
  resolve: {
    // must match tsconfig.app.json "paths" — "@/..." → "./src/..."
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  // Served at https://kimmyap.github.io/Fitness-track/ — must match repo name.
  base: '/Fitness-track/',
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true,
    // e2e/ is Playwright's; vitest's default glob would grab those specs and
    // run them in jsdom, where `test` comes from a different runner entirely.
    exclude: ['**/node_modules/**', '**/dist/**', '**/e2e/**'],
  },
});
