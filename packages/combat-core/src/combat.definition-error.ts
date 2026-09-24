/**
 * Typed definition errors: public-contract inputs that cannot become battles.
 * Invalid input is reported with a machine-readable code, never silently
 * coerced into a different attack. Full pre-simulation validation (R3a)
 * reuses these codes with field paths and offending references.
 */
export const COMBAT_DEFINITION_ERROR_CODES = [
  'UNSUPPORTED_ATTACK_TYPE', 'UNSUPPORTED_SCHEDULED_EFFECT', 'SCHEMA_VALIDATION_ERROR',
  'INVALID_DEFINITION_KEY', 'MISSING_DEFINITION', 'DUPLICATE_INSTANCE_ID',
  'DUPLICATE_SQUAD_MEMBER_ID', 'MISSING_SPAWN_TYPE', 'MISSING_SPAWN_DEFINITION',
  'UNCONSTRAINED_SUMMON_CYCLE', 'OUT_OF_BOUNDS_COORDINATES', 'INVALID_FIELD_RANGE',
] as const
export type CombatDefinitionErrorCode = typeof COMBAT_DEFINITION_ERROR_CODES[number]

export interface CombatDefinitionErrorExtra {
  path?: string
  reference?: string
  definitionId?: string
  attackType?: string
  effectId?: string
  effectType?: string
  issues?: Array<{ path: string; message: string }>
}

export class CombatDefinitionError extends Error {
  readonly code: CombatDefinitionErrorCode
  readonly definitionId?: string
  readonly attackType?: string
  readonly effectId?: string
  readonly effectType?: string
  readonly path?: string
  readonly reference?: string
  readonly issues?: Array<{ path: string; message: string }>

  constructor(
    code: CombatDefinitionErrorCode,
    messageOrDefId: string,
    attackTypeOrExtra?: string | CombatDefinitionErrorExtra,
    extra?: { effectId?: string; effectType?: string; path?: string; reference?: string },
  ) {
    let message: string
    let defId: string | undefined
    let atkType: string | undefined
    let effId: string | undefined
    let effType: string | undefined
    let fieldPath: string | undefined
    let refValue: string | undefined
    let schemaIssues: Array<{ path: string; message: string }> | undefined

    if (typeof attackTypeOrExtra === 'object' && attackTypeOrExtra !== null) {
      // Modern signature: (code, message, extra)
      message = messageOrDefId
      defId = attackTypeOrExtra.definitionId
      atkType = attackTypeOrExtra.attackType
      effId = attackTypeOrExtra.effectId
      effType = attackTypeOrExtra.effectType
      fieldPath = attackTypeOrExtra.path
      refValue = attackTypeOrExtra.reference
      schemaIssues = attackTypeOrExtra.issues
    } else if (extra?.effectId !== undefined) {
      // Legacy signature 2: (code, '', '', { effectId, effectType })
      defId = messageOrDefId || undefined
      effId = extra.effectId
      effType = extra.effectType
      fieldPath = extra.path ?? `scheduledEffects[${effId}].type`
      refValue = extra.reference ?? effType
      message = `scheduled effect '${effId}' uses unsupported type '${effType ?? ''}'`
    } else if (typeof attackTypeOrExtra === 'string') {
      // Legacy signature 1: (code, definitionId, attackType, extra?)
      defId = messageOrDefId
      atkType = attackTypeOrExtra
      effId = extra?.effectId
      effType = extra?.effectType
      fieldPath = extra?.path ?? (defId ? `definitions.${defId}.baseStats.attackType` : undefined)
      refValue = extra?.reference ?? atkType
      message = `definition '${defId}' uses unsupported attackType '${atkType}'`
    } else {
      message = messageOrDefId
      fieldPath = extra?.path
      refValue = extra?.reference
    }

    super(`[${code}] ${message}`)
    this.name = 'CombatDefinitionError'
    this.code = code
    this.definitionId = defId
    this.attackType = atkType
    this.effectId = effId
    this.effectType = effType
    this.path = fieldPath
    this.reference = refValue
    this.issues = schemaIssues
  }
}

