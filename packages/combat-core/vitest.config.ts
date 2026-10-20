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
    // Full-battle regressions (both CORE-HANDOFF MREs, the dense O2 fixtures) legitimately take
    // several seconds; the 5s default turns a loaded machine into a false red build. No assertion
    // is relaxed: a wrong result still fails immediately, only the wall-clock budget changes.
    testTimeout: 60_000,
  },
})
