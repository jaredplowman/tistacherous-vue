import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['rules/**/*.test.ts'],
    // One emulator, one database: files and tests must not run side by side.
    fileParallelism: false,
    testTimeout: 20000,
  },
})
