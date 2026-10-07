import { z } from 'zod'
import { baseStatsSchema, formationSchema } from './unit.contracts.js'

export const supportAuraModifierSchema = z.object({
  type: z.string(), radius: z.number().finite(), value: z.number().finite().default(0),
  duration: z.number().int().nonnegative().optional(), interval: z.number().int().positive().optional(),
  target: z.enum(['allies', 'enemies']), targetTags: z.array(z.string()).optional(),
})
export type SupportAuraModifierContract = z.infer<typeof supportAuraModifierSchema>

export const upgradeModifierSchema = z.object({
  hpMult: z.number().optional(),
  attackMult: z.number().optional(),
  speedMult: z.number().optional(),
  rangeAdd: z.number().optional(),
  cooldownMult: z.number().optional(),
  addFlying: z.boolean().optional(),
  addAoE: z.number().optional(),
  defenseAdd: z.number().optional(),
  grantShield: z.number().optional(),
  grantShieldFlat: z.number().optional(),
  stealthWhileMoving: z.boolean().optional(),
  onDeathSpawn: z.string().optional(),
  periodicSpawn: z.object({ unit: z.string(), interval: z.number() }).optional(),
  disableEnemyTech: z.boolean().optional(),
  leaveAoePuddle: z.boolean().optional(),
  damageReductionWhileMoving: z.number().optional(),
  burrowWhileMoving: z.object({ damageReduction: z.number() }).optional(),
  onDeathPuddle: z.enum(['napalm', 'acid', 'emp']).optional(),
  multishot: z.number().optional(),
  antiAirDamageMult: z.number().optional(),
  grantAntiAir: z.boolean().optional(),
  replicateOnKill: z.boolean().optional(),
  resurrectOnce: z.boolean().optional(),
  stealthUntilAttack: z.boolean().optional(),
  executeThreshold: z.number().optional(),
  lifestealMult: z.number().optional(),
  groundDamageMult: z.number().optional(),
  shieldDamageMult: z.number().optional(),
  armorPierceRatio: z.number().optional(),
  summonCounterDamageMult: z.number().optional(),
  accuracyPenaltyResist: z.number().optional(),
  grantRevealAura: z.object({ radius: z.number(), duration: z.number(), interval: z.number().optional() }).optional(),
  supportAuras: z.array(supportAuraModifierSchema).optional(),
}).passthrough()

export type UpgradeModifierContract = z.infer<typeof upgradeModifierSchema>

export const upgradeConfigSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  description: z.string().optional(),
  cost: z.number().optional(),
  allowedUnits: z.array(z.string()).optional(),
  hiddenFromSimulator: z.boolean().optional(),
  modifiers: upgradeModifierSchema,
})
export type UpgradeConfigContract = z.infer<typeof upgradeConfigSchema>

export const targetingAcquisitionSchema = z.enum(['local', 'global'])
export const targetingProfileSchema = z.object({
  acquisition: targetingAcquisitionSchema.default('local'),
  distanceWeight: z.number().finite(),
  currentTargetBonus: z.number().finite().default(0),
  lowHpWeight: z.number().finite().default(0),
  targetingCooldownTicks: z.number().int().nonnegative().optional(),
  preferredTags: z.record(z.string(), z.number().finite()).optional(),
  avoidedTags: z.record(z.string(), z.number().finite()).optional(),
})
export type TargetingProfileContract = z.infer<typeof targetingProfileSchema>

export const catalogUnitTypeSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  baseStats: baseStatsSchema.partial().optional(),
  squadSize: z.number().optional(),
  squadSpacing: z.number().optional(),
  formation: formationSchema.optional(),
  targetingProfile: z.string().optional(),
  abilities: z.array(z.unknown()).optional(),
  periodicAbilities: z.array(z.unknown()).optional(),
  hireCost: z.record(z.string(), z.number()).optional(),
  recruitable: z.boolean().optional(),
})
export type CatalogUnitTypeContract = z.infer<typeof catalogUnitTypeSchema>

export const combatCatalogSchema = z.object({
  unitTypes: z.record(z.string(), catalogUnitTypeSchema).optional(),
  upgrades: z.record(z.string(), upgradeConfigSchema).optional(),
  targetingProfiles: z.record(z.string(), targetingProfileSchema).optional(),
})

export type CombatCatalogContract = z.infer<typeof combatCatalogSchema>
