import { z } from 'zod'
import { statusEffectSchema, statusTypeSchema } from './contracts/unit.contracts.js'
import { CombatDefinitionError } from './combat.definition-error.js'

export const percentHpDamageConfigSchema = z.object({
  percent: z.number().finite().positive(),
  basis: z.enum(['max', 'current']).optional(),
  maxBonus: z.number().finite().optional(), minBonus: z.number().finite().optional(),
}).passthrough()

export const targetMarkConfigSchema = z.object({
  duration: z.number().int().positive(),
  damageMultiplier: z.number().finite().positive().optional(),
  sharedDamage: z.boolean().optional(), squadWide: z.boolean().optional(),
  executeThreshold: z.number().finite().optional(), focusPriority: z.number().finite().optional(),
  focusRadius: z.number().finite().positive().optional(),
  retargetPolicy: z.enum(['always', 'new_squad_only', 'none']).optional(),
  retargetLockTicks: z.number().int().nonnegative().optional(),
}).passthrough()

export const periodicAbilityPayloadSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('damage'),
    amount: z.number().finite().nonnegative().optional(),
    percentHp: percentHpDamageConfigSchema.optional(),
    radius: z.number().finite().positive().optional(),
    statusEffects: z.array(statusEffectSchema).optional(),
  }).passthrough(),
  z.object({ kind: z.literal('status'), effects: z.array(statusEffectSchema).min(1) }).passthrough(),
  z.object({
    kind: z.literal('hazard'),
    hazardType: z.enum(['napalm', 'radiation', 'emp_field', 'acid', 'emp', 'mine', 'smoke', 'barrier_dome']),
    radius: z.number().finite().positive(), duration: z.number().finite().positive(),
    damagePerTick: z.number().finite().nonnegative().optional(),
    statusEffects: z.array(statusEffectSchema).optional(),
  }).passthrough(),
  z.object({ kind: z.literal('shield'), amount: z.number().finite().positive() }).passthrough(),
  z.object({
    kind: z.literal('heal'),
    amount: z.number().finite().nonnegative().optional(),
    percentMaxHp: z.number().finite().nonnegative().optional(),
    radius: z.number().finite().positive().optional(),
    cleanse: z.array(statusTypeSchema).optional(),
  }).passthrough(),
  z.object({
    kind: z.literal('spawn'),
    unitType: z.string().min(1),
    count: z.number().int().positive().optional(), cap: z.number().int().positive().optional(),
    hpPercent: z.number().finite().positive().optional(),
    spreadRadius: z.number().finite().nonnegative().optional(),
  }).passthrough(),
  z.object({
    kind: z.literal('mark'),
    mark: targetMarkConfigSchema, radius: z.number().finite().positive().optional(),
  }).passthrough(),
])

export const periodicAbilityConfigSchema = z.object({
  id: z.string().min(1),
  intervalTicks: z.number().int().positive(),
  initialDelayTicks: z.number().int().nonnegative().optional(),
  charges: z.number().int().positive().optional(),
  targetPolicy: z.enum(['current_target', 'nearest_enemy', 'nearest_air', 'nearest_ground', 'ally_lowest_hp', 'self']).optional(),
  payload: periodicAbilityPayloadSchema,
  canTargetAir: z.boolean().optional(),
  minRange: z.number().finite().nonnegative().optional(),
  maxRange: z.number().finite().positive().optional(),
}).passthrough()

/**
 * Validates a periodic ability config structure against its Zod schema.
 */
export function validatePeriodicAbilityConfig(ability: unknown, path: string, definitionId?: string): void {
  if (!ability || typeof ability !== 'object') {
    throw new CombatDefinitionError(
      'SCHEMA_VALIDATION_ERROR',
      `periodic ability must be a non-null object at '${path}'`,
      { path, definitionId, reference: String(ability) },
    )
  }
  const result = periodicAbilityConfigSchema.safeParse(ability)
  if (!result.success) {
    const first = result.error.issues[0]
    const subpath = first ? first.path.join('.') : ''
    const fullPath = subpath ? `${path}.${subpath}` : path
    const received = (first as unknown as { received?: unknown })?.received
    throw new CombatDefinitionError(
      'SCHEMA_VALIDATION_ERROR',
      `periodic ability validation failed: ${first?.message ?? 'invalid periodic ability'} at '${fullPath}'`,
      {
        path: fullPath,
        definitionId,
        reference: String(received ?? ''),
        issues: result.error.issues.map(i => ({ path: i.path.join('.'), message: i.message })),
      },
    )
  }
}
