import { z } from 'zod'
import {
  attackTypeSchema,
  formationSchema,
  statusEffectSchema,
  teamSchema,
  unitSizeSchema,
} from './unit-primitives.contracts.js'
import { preparedStatsSchema } from './prepared.contracts.js'

export * from './unit-primitives.contracts.js'
export * from './prepared.contracts.js'

export const baseStatsSchema = z.object({
  hp: z.number().finite().positive(),
  attack: z.number().finite().nonnegative(),
  defense: z.number().finite().nonnegative(),
  speed: z.number().finite().nonnegative(),
  range: z.number().finite().nonnegative(),
  attackType: attackTypeSchema.default('single'),
  actionCooldownMax: z.number().int().positive().default(10),
  turnSpeed: z.number().finite().nonnegative().default(5),
  size: unitSizeSchema.default('M'),
  combatTags: z.array(z.string()).default([]),
  spawnType: z.string().optional(),
  spawnCap: z.number().int().positive().optional(),
  statusOnHit: z.array(statusEffectSchema).optional(),
  healTargetTags: z.array(z.string()).optional(),
  targetingProfile: z.string().optional(),
  stationaryAlignment: z.boolean().optional(),
  formationAnchorMode: z.enum(['leader', 'centroid']).optional(),
  velocityDamping: z.boolean().optional(),
  projectileInterceptable: z.boolean().optional(),
  isFlying: z.boolean().optional(),
  canTargetAir: z.boolean().optional(),
  minimumRange: z.number().finite().nonnegative().optional(),
  aoeRadius: z.number().finite().nonnegative().optional(),
  selfDestructOnAttack: z.boolean().optional(),
  shieldDamageMult: z.number().finite().optional(),
  armorPierceRatio: z.number().finite().optional(),
  antiAirDamageMult: z.number().finite().optional(),
  summonCounterDamageMult: z.number().finite().optional(),
  accuracyPenaltyResist: z.number().finite().optional(),
}).passthrough()
export type BaseStats = z.infer<typeof baseStatsSchema>

export const unitDefinitionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  baseStats: baseStatsSchema,
  squadSize: z.number().int().positive().default(1),
  squadSpacing: z.number().nonnegative().default(20),
  formation: formationSchema.default('grid'),
  targetingProfile: z.string().optional(),
  abilities: z.array(z.unknown()).optional(),
  preparedStats: preparedStatsSchema.optional(),
}).passthrough()
export type UnitDefinition = z.infer<typeof unitDefinitionSchema>

export const unitPlacementSchema = z.object({
  x: z.number().optional(),
  y: z.number().optional(),
  angle: z.number().optional(),
})
export type UnitPlacement = z.infer<typeof unitPlacementSchema>

export const unitSpawnSpecSchema = z.object({
  instanceId: z.string().min(1),
  definitionId: z.string().min(1),
  team: teamSchema,
  placement: unitPlacementSchema.default({}),
  currentHp: z.number().positive().optional(),
  rank: z.number().int().positive().default(1),
  upgradeIds: z.array(z.string()).default([]),
  preparedStats: preparedStatsSchema.optional(),
})
export type UnitSpawnSpec = z.infer<typeof unitSpawnSpecSchema>
