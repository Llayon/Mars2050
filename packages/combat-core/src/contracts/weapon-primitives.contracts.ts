import { z } from 'zod'

export const conditionalAttackModeConfigSchema = z.object({
  minTargets: z.number().int().positive(),
  radius: z.number().finite().positive(),
  damageMultiplier: z.number().finite(),
}).passthrough()
export type ConditionalAttackModeConfigContract = z.infer<typeof conditionalAttackModeConfigSchema>

export const sweepAttackConfigSchema = z.object({
  width: z.number().finite().positive(),
  damageMultiplier: z.number().finite(),
  maxTargets: z.number().int().positive().optional(),
  sizeBonusMultiplier: z.record(z.string(), z.number().finite()).optional(),
}).passthrough()
export type SweepAttackConfigContract = z.infer<typeof sweepAttackConfigSchema>

export const linePierceConfigSchema = z.object({
  width: z.number().finite().positive(),
  damageMultiplier: z.number().finite(),
  maxTargets: z.number().int().positive().optional(),
}).passthrough()
export type LinePierceConfigContract = z.infer<typeof linePierceConfigSchema>

export const coneAttackConfigSchema = z.object({
  angleDeg: z.number().finite().positive(),
  damageMultiplier: z.number().finite(),
  maxTargets: z.number().int().positive().optional(),
}).passthrough()
export type ConeAttackConfigContract = z.infer<typeof coneAttackConfigSchema>

export const beamAttackConfigSchema = z.object({
  width: z.number().finite().positive(),
  damageMultiplier: z.number().finite(),
  maxTargets: z.number().int().positive().optional(),
}).passthrough()
export type BeamAttackConfigContract = z.infer<typeof beamAttackConfigSchema>

export const barrageAttackConfigSchema = z.object({
  impacts: z.number().int().positive(),
  radius: z.number().finite().positive(),
  spreadRadius: z.number().finite().nonnegative(),
  damageMultiplier: z.number().finite(),
  maxTargetsPerImpact: z.number().int().positive().optional(),
  impactIntervalTicks: z.number().int().positive().optional(),
}).passthrough()
export type BarrageAttackConfigContract = z.infer<typeof barrageAttackConfigSchema>

export const chainAttackConfigSchema = z.object({
  jumps: z.number().int().positive(),
  radius: z.number().finite().positive(),
  damageMultiplier: z.number().finite(),
  falloff: z.number().finite().optional(),
}).passthrough()
export type ChainAttackConfigContract = z.infer<typeof chainAttackConfigSchema>

export const splitFireConfigSchema = z.object({
  maxTargets: z.number().int().positive(),
  damageMultiplier: z.number().finite(),
  range: z.number().finite().positive().optional(),
  canTargetAir: z.boolean().optional(),
  allowMinimumDamage: z.boolean().optional(),
}).passthrough()
export type SplitFireConfigContract = z.infer<typeof splitFireConfigSchema>

export const sideWeaponConfigSchema = z.object({
  damage: z.number().finite().nonnegative(),
  range: z.number().finite().positive(),
  maxTargets: z.number().int().positive(),
  canTargetAir: z.boolean().optional(),
}).passthrough()
export type SideWeaponConfigContract = z.infer<typeof sideWeaponConfigSchema>
