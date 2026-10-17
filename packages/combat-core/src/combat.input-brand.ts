import type { BattleInput } from './contracts/index.js'

/**
 * Normalization marker symbol.
 *
 * Deliberately not registered in the global symbol registry and not re-exported
 * from the package entrypoint, so no consumer can fabricate the fast path used by
 * executeCombatSimulation.
 */
export const NORMALIZED_INPUT_BRAND = Symbol('@mars2050/combat-core.normalized-input')

/**
 * Marks a validated BattleInput as normalized.
 * @param input - Input produced by validateBattleInput.
 * @returns The same object carrying the non-enumerable brand.
 */
export function brandNormalizedInput(input: BattleInput): BattleInput {
  Object.defineProperty(input, NORMALIZED_INPUT_BRAND, { value: true, enumerable: false })
  return input
}

/**
 * Internal fast-path check used by executeCombatSimulation to skip duplicate
 * validation of input produced by validateBattleInput. Public entrypoints must
 * always validate external input regardless of this check.
 * @param input - Candidate battle input object.
 * @returns True only for objects branded by brandNormalizedInput.
 */
export function isNormalizedBattleInput(input: unknown): input is BattleInput {
  return typeof input === 'object' && input !== null && (input as Record<symbol, unknown>)[NORMALIZED_INPUT_BRAND] === true
}
