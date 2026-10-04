import { defineConfig } from 'vitest/config';

// Enhetstester for ren logikk (f.eks. fysikkmodellene i src/viz). Ingen DOM.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
