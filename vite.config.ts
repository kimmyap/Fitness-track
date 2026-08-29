/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react({ jsxImportSource: '@emotion/react' })],
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
  },
});
