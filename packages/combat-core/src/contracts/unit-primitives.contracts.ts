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
