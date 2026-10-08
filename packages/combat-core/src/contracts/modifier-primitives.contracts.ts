import { z } from 'zod'
import { statusEffectSchema } from './unit-primitives.contracts.js'

export const fieldEffectKindSchema = z.enum(['barrier_dome', 'cleanse_field', 'hazard_field'])
export type FieldEffectKind = z.infer<typeof fieldEffectKindSchema>

export const fieldEffectConfigSchema = z.object({
  id: z.string().min(1),
  kind: fieldEffectKindSchema,
  radius: z.number().finite().positive(),
  intervalTicks: z.number().int().positive(),
  initialDelayTicks: z.number().int().nonnegative().optional(),
  duration: z.number().int().positive().optional(),
  value: z.number().finite().optional(),
  capacity: z.number().finite().optional(),
  damagePerTick: z.number().finite().optional(),
  hazardType: z.string().optional(),
  hazardTypes: z.array(z.string()).optional(),
  statusEffects: z.array(statusEffectSchema).optional(),
  nextTick: z.number().int().nonnegative().optional(),
}).passthrough()
export type FieldEffectConfigContract = z.infer<typeof fieldEffectConfigSchema>

export const controlBeamConfigSchema = z.object({
  range: z.number().finite().nonnegative().optional(),
  progressPerTick: z.number().finite().positive(),
  conversionThreshold: z.number().finite().positive(),
  maxTargets: z.number().int().positive().optional(),
  multiTargetProgressMultiplier: z.number().finite().optional(),
  breakOnRange: z.boolean().optional(),
  breakOnDeath: z.boolean().optional(),
  breakOnCleanse: z.boolean().optional(),
  healConvertedToMax: z.boolean().optional(),
}).passthrough()
export type ControlBeamConfigContract = z.infer<typeof controlBeamConfigSchema>

export const rankRelationSchema = z.enum(['same_rank', 'higher_rank', 'lower_rank'])
export const rankDamageModifierSchema = z.object({
  relation: rankRelationSchema,
  multiplier: z.number().finite(),
}).passthrough()

export const rankScalingConfigSchema = z.object({
  hpMultPerRank: z.number().finite().optional(),
  attackMultPerRank: z.number().finite().optional(),
  defenseAddPerRank: z.number().finite().optional(),
  rangeAddPerRank: z.number().finite().optional(),
  cooldownReductionPerRank: z.number().finite().optional(),
  damageModifiers: z.array(rankDamageModifierSchema).optional(),
}).passthrough()
export type RankScalingConfigContract = z.infer<typeof rankScalingConfigSchema>

export const transformModeKindSchema = z.enum(['assault', 'aerial', 'land', 'entrenched', 'jump'])
export const transformModeConfigSchema = z.object({
  id: z.string().min(1),
  mode: transformModeKindSchema,
  trigger: z.enum(['battle_start', 'hp_threshold']),
  hpThreshold: z.number().finite().optional(),
  hpMult: z.number().finite().optional(),
  attackMult: z.number().finite().optional(),
  speedMult: z.number().finite().optional(),
  rangeMult: z.number().finite().optional(),
  cooldownMult: z.number().finite().optional(),
  aoeRadiusAdd: z.number().finite().optional(),
  isFlying: z.boolean().optional(),
  canTargetAir: z.boolean().optional(),
  jumpDistance: z.number().finite().optional(),
}).passthrough()
export type TransformModeConfigContract = z.infer<typeof transformModeConfigSchema>

export const formationModifiersConfigSchema = z.object({
  spacingMultiplier: z.number().finite().optional(),
  adjacencyBonus: z.object({
    radius: z.number().finite().positive(),
    maxStacks: z.number().int().positive(),
    damageReductionPerAlly: z.number().finite().optional(),
    rangeBoostPerAlly: z.number().finite().optional(),
    attackBoostPerAlly: z.number().finite().optional(),
  }).passthrough().optional(),
}).passthrough()
export type FormationModifiersConfigContract = z.infer<typeof formationModifiersConfigSchema>

export const statGrowthConfigSchema = z.object({
  intervalTicks: z.number().int().positive(),
  maxStacks: z.number().int().positive(),
  attackMultPerStack: z.number().finite().optional(),
  hpMultPerStack: z.number().finite().optional(),
}).passthrough()
export type StatGrowthConfigContract = z.infer<typeof statGrowthConfigSchema>
