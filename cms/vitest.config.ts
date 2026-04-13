// cms/vitest.config.ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    globalSetup: './src/test/global-setup.ts',
    environment: 'node',
    testTimeout: 60_000,
    hookTimeout: 60_000,
    // Only pick up our own test files, not node_modules
    include: ['src/test/**/*.test.ts'],
    // Run files sequentially so multiple getPayload() calls don't race
    // on schema push against the shared Postgres container
    fileParallelism: false,
  },
})
