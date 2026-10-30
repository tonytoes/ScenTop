import { defineConfig } from 'vitest/config';

// Server tests only. The Angular tests run through `ng test`.
export default defineConfig({
  test: {
    include: ['server/tests/**/*.test.ts'],
    environment: 'node',
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
