import { configDefaults, defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/setup.ts'],
    exclude: [...configDefaults.exclude, 'tests/e2e/**', 'packages/**', 'examples/**', 'apps/**', 'artifacts/**'],
    maxWorkers: 4,
    testTimeout: 15000,
  },
  resolve: {
    alias: [
      // Documented test-only resolver for legacy combat diagnostic tests (R6 / ISO-08).
      // Production code never imports from @/domains/combat/ecs or private combat internals.
      { find: '@/domains/combat/combat.unit-factory', replacement: path.resolve(__dirname, './src/__tests__/helpers/combat-unit-factory.ts') },
      { find: '@/domains/combat/combat.metrics-collector', replacement: path.resolve(__dirname, './packages/combat-core/src/combat.metrics.ts') },
      { find: /^@\/domains\/combat\/ecs\/(.*)$/, replacement: path.resolve(__dirname, './packages/combat-core/src/ecs/$1') },
      { find: '@/domains/combat/ecs', replacement: path.resolve(__dirname, './packages/combat-core/src/ecs') },
      { find: /^@\/domains\/combat\/(combat\.(?:ability-compiler|ability-legacy|ability\.types|action-intent|advanced-primitives|catalog\.types|control-mode|death\.types|definition-mapper|outcome|pathfinding|phase|primitive-coverage|primitives|replay-mapper|runner|runtime-primitives|runtime|sim\.types|spawn-spec-compiler|squad-compiler|status-core|support-aura-config|targeting\.config|temporal-compiler|temporal\.types|unit-ability-components|unit-build\.types|unit-compiler-utils|unit-components|unit-core-components|unit-stat-compiler|upgrade-runtime|weapon-validation))$/, replacement: path.resolve(__dirname, './packages/combat-core/src/$1') },
      { find: '@', replacement: path.resolve(__dirname, './src') },
    ],
  },
})
