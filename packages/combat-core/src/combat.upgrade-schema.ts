import { z } from 'zod'
import { CombatDefinitionError } from './combat.definition-error.js'

export const upgradeNumericModifiersSchema = z.object({
  hpMult: z.number().finite().optional(),
  attackMult: z.number().finite().optional(),
  speedMult: z.number().finite().optional(),
  rangeAdd: z.number().finite().optional(),
  cooldownMult: z.number().finite().optional(),
  addAoE: z.number().finite().optional(),
  defenseAdd: z.number().finite().optional(),
  grantShield: z.number().finite().optional(),
  grantShieldFlat: z.number().finite().optional(),
  damageReductionWhileMoving: z.number().finite().optional(),
  multishot: z.number().finite().optional(),
  antiAirDamageMult: z.number().finite().optional(),
  executeThreshold: z.number().finite().optional(),
  lifestealMult: z.number().finite().optional(),
  groundDamageMult: z.number().finite().optional(),
  shieldDamageMult: z.number().finite().optional(),
  armorPierceRatio: z.number().finite().optional(),
  summonCounterDamageMult: z.number().finite().optional(),
  accuracyPenaltyResist: z.number().finite().optional(),
  addFlying: z.boolean().optional(),
  stealthWhileMoving: z.boolean().optional(),
  disableEnemyTech: z.boolean().optional(),
  leaveAoePuddle: z.boolean().optional(),
  grantAntiAir: z.boolean().optional(),
  replicateOnKill: z.boolean().optional(),
  resurrectOnce: z.boolean().optional(),
  stealthUntilAttack: z.boolean().optional(),
  onDeathSpawn: z.string().optional(),
  onDeathPuddle: z.enum(['napalm', 'acid', 'emp']).optional(),
  periodicSpawn: z.object({
    unit: z.string().min(1),
    interval: z.number().finite().positive(),
  }).optional(),
  burrowWhileMoving: z.object({
    damageReduction: z.number().finite(),
  }).optional(),
  grantRevealAura: z.object({
    radius: z.number().finite().positive(),
    duration: z.number().finite().positive(),
    interval: z.number().finite().positive().optional(),
  }).optional(),
}).passthrough()

export const upgradeConfigSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  description: z.string().optional(),
  cost: z.number().finite().optional(),
  allowedUnits: z.array(z.string()).optional(),
  hiddenFromSimulator: z.boolean().optional(),
  modifiers: upgradeNumericModifiersSchema.optional(),
}).passthrough()

/**
 * Validates an upgrade configuration and its numeric modifiers before simulation.
 * Throws a CombatDefinitionError with SCHEMA_VALIDATION_ERROR if validation fails.
 *
 * @param upgId Identifier of the upgrade being validated.
 * @param upg Unknown upgrade config payload.
 */
export function validateUpgradeConfig(upgId: string, upg: unknown): void {
  if (!upg || typeof upg !== 'object') {
    throw new CombatDefinitionError(
      'SCHEMA_VALIDATION_ERROR',
      `upgrade '${upgId}' must be a non-null object`,
      { path: `catalog.upgrades.${upgId}`, definitionId: upgId, reference: String(upg) },
    )
  }
  const result = upgradeConfigSchema.safeParse(upg)
  if (!result.success) {
    const first = result.error.issues[0]
    const pathStr = first ? first.path.join('.') : ''
    const received = (first as unknown as { received?: unknown })?.received
    throw new CombatDefinitionError(
      'SCHEMA_VALIDATION_ERROR',
      `upgrade '${upgId}' validation failed: ${first ? first.message : 'invalid upgrade'} at '${pathStr}'`,
      {
        path: `catalog.upgrades.${upgId}${pathStr ? `.${pathStr}` : ''}`,
        definitionId: upgId,
        reference: String(received ?? ''),
        issues: result.error.issues.map(i => ({ path: i.path.join('.'), message: i.message })),
      },
    )
  }
}
