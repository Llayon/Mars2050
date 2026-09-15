/**
 * Typed definition errors: public-contract inputs that cannot become battles.
 * Invalid input is reported with a machine-readable code, never silently
 * coerced into a different attack. Full pre-simulation validation (R3a)
 * reuses these codes with field paths.
 */
export const COMBAT_DEFINITION_ERROR_CODES = ['UNSUPPORTED_ATTACK_TYPE', 'UNSUPPORTED_SCHEDULED_EFFECT'] as const
export type CombatDefinitionErrorCode = typeof COMBAT_DEFINITION_ERROR_CODES[number]

export class CombatDefinitionError extends Error {
  readonly code: CombatDefinitionErrorCode
  readonly definitionId: string
  readonly attackType: string
  readonly effectId?: string
  readonly effectType?: string

  constructor(
    code: CombatDefinitionErrorCode,
    definitionId: string,
    attackType: string,
    extra?: { effectId?: string; effectType?: string },
  ) {
    super(extra?.effectId !== undefined
      ? `[${code}] scheduled effect '${extra.effectId}' uses unsupported type '${extra.effectType ?? ''}'`
      : `[${code}] definition '${definitionId}' uses unsupported attackType '${attackType}'`)
    this.name = 'CombatDefinitionError'
    this.code = code
    this.definitionId = definitionId
    this.attackType = attackType
    this.effectId = extra?.effectId
    this.effectType = extra?.effectType
  }
}
