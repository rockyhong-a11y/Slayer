import { defineConfig } from 'vite';

export default defineConfig({
  // Relative paths, so the build runs from any folder on any static host.
  base: './',
  build: { target: 'es2022' },
});
