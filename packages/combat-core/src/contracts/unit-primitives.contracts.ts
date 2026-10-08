import { z } from 'zod'

export const teamSchema = z.enum(['attacker', 'defender'])
export type Team = z.infer<typeof teamSchema>

export const unitSizeSchema = z.enum(['S', 'M', 'L', 'XL'])
export type UnitSize = z.infer<typeof unitSizeSchema>

export const attackTypeSchema = z.enum(['single', 'aoe', 'beam', 'spread', 'spawn', 'heal'])
export type AttackType = z.infer<typeof attackTypeSchema>

export const formationSchema = z.enum(['grid', 'line', 'wedge'])
export type Formation = z.infer<typeof formationSchema>

export const statusTypeSchema = z.enum([
  'emp', 'slow', 'burn', 'acid', 'vulnerable', 'range_suppressed', 'revealed',
  'hacked', 'damage_reduction', 'regen', 'output_suppressed', 'accuracy_reduced',
  'armor_broken', 'degeneration', 'haste', 'range_boost', 'attack_boost', 'status_immunity',
])
export type StatusType = z.infer<typeof statusTypeSchema>

export const statusEffectSchema = z.object({
  type: statusTypeSchema,
  duration: z.number().int().positive(),
  value: z.number().optional(),
  sourceUnitId: z.string().optional(),
  stackKey: z.string().optional(),
})
export type StatusEffect = z.infer<typeof statusEffectSchema>

export const burrowConfigSchema = z.object({
  damageReduction: z.number().finite().nonnegative(),
  regenPercentPerTick: z.number().finite().nonnegative().optional(),
  emergeAttackMult: z.number().finite().positive().optional(),
  emergeAoeRadiusAdd: z.number().finite().nonnegative().optional(),
})
export type BurrowConfigContract = z.infer<typeof burrowConfigSchema>

export const supportAuraTypeSchema = z.enum([
  'shield', 'shield_repair', 'regen', 'reveal', 'damage_reduction', 'haste', 'range_boost', 'attack_boost', 'cleanse', 'status_immunity',
])
export type SupportAuraType = z.infer<typeof supportAuraTypeSchema>

export const supportAuraModifierSchema = z.object({
  type: z.string(),
  radius: z.number().finite(),
  value: z.number().finite().default(0),
  duration: z.number().int().nonnegative().optional(),
  interval: z.number().int().positive().optional(),
  target: z.enum(['allies', 'enemies']),
  targetTags: z.array(z.string()).optional(),
})
export type SupportAuraModifierContract = z.infer<typeof supportAuraModifierSchema>
