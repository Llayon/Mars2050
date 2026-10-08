import type { UnitBaseStats } from './combat.types.js'
import { CombatDefinitionError } from './combat.definition-error.js'
import {
  fieldEffectConfigSchema,
  controlBeamConfigSchema,
  rankScalingConfigSchema,
} from './contracts/modifier-primitives.contracts.js'

/**
 * Validates nested primitive configurations (fieldEffect, controlBeam, rankScaling) on assembled primitives.
 */
export function validatePrimitiveConfigs(
  primitives: UnitBaseStats,
  pathPrefix: string,
  definitionId: string,
): void {
  if (primitives.fieldEffect) {
    for (let i = 0; i < primitives.fieldEffect.length; i++) {
      const res = fieldEffectConfigSchema.safeParse(primitives.fieldEffect[i])
      if (!res.success) {
        throw new CombatDefinitionError(
          'SCHEMA_VALIDATION_ERROR',
          `fieldEffect[${i}] validation failed: ${res.error.issues[0]?.message} at '${pathPrefix}.fieldEffect[${i}]'`,
          { path: `${pathPrefix}.fieldEffect[${i}]`, definitionId },
        )
      }
    }
  }

  if (primitives.controlBeam) {
    const res = controlBeamConfigSchema.safeParse(primitives.controlBeam)
    if (!res.success) {
      throw new CombatDefinitionError(
        'SCHEMA_VALIDATION_ERROR',
        `controlBeam validation failed: ${res.error.issues[0]?.message} at '${pathPrefix}.controlBeam'`,
        { path: `${pathPrefix}.controlBeam`, definitionId },
      )
    }
  }

  if (primitives.rankScaling) {
    const res = rankScalingConfigSchema.safeParse(primitives.rankScaling)
    if (!res.success) {
      throw new CombatDefinitionError(
        'SCHEMA_VALIDATION_ERROR',
        `rankScaling validation failed: ${res.error.issues[0]?.message} at '${pathPrefix}.rankScaling'`,
        { path: `${pathPrefix}.rankScaling`, definitionId },
      )
    }
  }
}
