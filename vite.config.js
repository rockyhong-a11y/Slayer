import { defineConfig } from 'vite';

export default defineConfig({
  // Relative paths, so the build runs from any folder on any static host.
  base: './',
  build: { target: 'es2022' },
  // `vite preview` is what the smoke test and screenshots run against. Serving
  // it under a strict policy -- same-origin requests only -- means anything the
  // game reaches for that a locked-down host would refuse fails here first,
  // instead of on someone's phone.
  preview: {
    headers: {
      'Content-Security-Policy':
        "default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'",
    },
  },
});
