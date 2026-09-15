import { defineConfig } from 'vitest/config'

// Standalone combat-core tests: plain Node environment, no jsdom, no Mars
// setup files, no app env. Each test file here runs ONLY in this project;
// the root vitest config excludes packages/** to avoid double runs.
// Invoked from the repo root as:
//   vitest run --config packages/combat-core/vitest.config.ts
// (root stays the repo root, so no import.meta/dirname math is needed here)
export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    include: ['packages/combat-core/tests/**/*.test.ts'],
  },
})
