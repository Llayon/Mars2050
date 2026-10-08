import { z } from 'zod'

export const attackChargeConfigSchema = z.object({
  intervalTicks: z.number().int().positive(),
  maxStacks: z.number().int().positive(),
  attackMultPerStack: z.number().finite(),
}).passthrough()
export type AttackChargeConfigContract = z.infer<typeof attackChargeConfigSchema>

export const delayedReassemblyConfigSchema = z.object({
  delayTicks: z.number().int().positive(),
  hpPercent: z.number().finite().optional(),
  maxTriggers: z.number().int().positive().optional(),
}).passthrough()
export type DelayedReassemblyConfigContract = z.infer<typeof delayedReassemblyConfigSchema>

export const conditionalRangeTargetSchema = z.enum(['air', 'ground', 'tag', 'same_rank', 'higher_rank', 'lower_rank'])
export const conditionalRangeConfigSchema = z.object({
  target: conditionalRangeTargetSchema,
  tag: z.string().optional(),
  rangeAdd: z.number().finite().optional(),
  rangeMult: z.number().finite().optional(),
}).passthrough()
export type ConditionalRangeConfigContract = z.infer<typeof conditionalRangeConfigSchema>

export const flatDamageBlockConfigSchema = z.object({
  amount: z.number().finite(),
  perRank: z.number().finite().optional(),
  minimumDamage: z.number().finite().optional(),
}).passthrough()
export type FlatDamageBlockConfigContract = z.infer<typeof flatDamageBlockConfigSchema>

export const shieldHitBlockConfigSchema = z.object({
  charges: z.number().int().positive(),
}).passthrough()
export type ShieldHitBlockConfigContract = z.infer<typeof shieldHitBlockConfigSchema>

export const targetPriorityProfileSchema = z.enum(['highest_max_hp', 'air_first', 'heavy_first', 'marked_focus'])
export type TargetPriorityProfileContract = z.infer<typeof targetPriorityProfileSchema>
