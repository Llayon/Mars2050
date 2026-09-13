import { z } from 'zod'
import { teamSchema, unitDefinitionSchema, unitSpawnSpecSchema } from './unit.contracts.js'
import { combatReplayUnitSchema, combatTickSchema } from './replay.contracts.js'

export const obstacleSchema = z.object({
  x: z.number(),
  y: z.number(),
  radius: z.number().positive(),
})
export type Obstacle = z.infer<typeof obstacleSchema>

export const arenaSpecSchema = z.object({
  width: z.number().int().min(100).max(5000).default(600),
  height: z.number().int().min(100).max(5000).default(1200),
  tileSize: z.number().int().positive().default(40),
  obstacles: z.array(obstacleSchema).default([]),
})
export type ArenaSpec = z.infer<typeof arenaSpecSchema>

export const timeoutPolicySchema = z.enum(['draw', 'attacker_win', 'defender_win'])
export type TimeoutPolicy = z.infer<typeof timeoutPolicySchema>

export const defenseResolutionModeSchema = z.enum(['v9_snapshot', 'v8_sequential'])
export type DefenseResolutionMode = z.infer<typeof defenseResolutionModeSchema>

export const battleRulesSchema = z.object({
  maxTicks: z.number().int().min(1).max(5000).default(2000),
  timeoutPolicy: timeoutPolicySchema.default('draw'),
  defenseResolutionMode: defenseResolutionModeSchema.default('v9_snapshot'),
  trackMetrics: z.boolean().optional(),
  profile: z.boolean().optional(),
})
export type BattleRules = z.infer<typeof battleRulesSchema>

export const scheduledEffectSchema = z.object({
  id: z.string().min(1),
  tick: z.number().int().nonnegative(),
  team: teamSchema,
  type: z.string().min(1),
  value: z.number(),
})
export type ScheduledEffect = z.infer<typeof scheduledEffectSchema>

export const battleInputSchema = z.object({
  seed: z.number().int(),
  arena: arenaSpecSchema.default({ width: 600, height: 1200, tileSize: 40, obstacles: [] }),
  rules: battleRulesSchema.default({ maxTicks: 2000, timeoutPolicy: 'draw', defenseResolutionMode: 'v9_snapshot' }),
  definitions: z.record(z.string(), unitDefinitionSchema),
  units: z.array(unitSpawnSpecSchema),
  scheduledEffects: z.array(scheduledEffectSchema).default([]),
  catalog: z.record(z.string(), z.unknown()).optional(),
})
export type BattleInput = z.infer<typeof battleInputSchema>
export type BattleInputSpec = z.input<typeof battleInputSchema>

export const combatWinnerSchema = z.enum(['attacker', 'defender', 'draw'])
export type CombatWinner = z.infer<typeof combatWinnerSchema>

export const combatRunResultSchema = z.object({
  winner: combatWinnerSchema,
  seed: z.number().int(),
  elapsedTicks: z.number().int().nonnegative(),
  terminationReason: z.string(),
  initialState: z.array(combatReplayUnitSchema),
  survivors: z.array(combatReplayUnitSchema),
  logs: z.array(combatTickSchema),
  engineVersion: z.number().int(),
  engineRevision: z.string(),
  profile: z.record(z.string(), z.unknown()).optional(),
})
export type CombatRunResult = z.infer<typeof combatRunResultSchema>
