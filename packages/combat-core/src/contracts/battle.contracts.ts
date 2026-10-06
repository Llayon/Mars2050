import { z } from 'zod'
import { teamSchema, unitDefinitionSchema, unitSpawnSpecSchema } from './unit.contracts.js'
import { combatReplayUnitSchema, combatTickSchema } from './replay.contracts.js'
import {
  combatMetadataSchema, defenseResolutionModeSchema,
  type CombatMetadata, type DefenseResolutionMode,
} from './identity.contracts.js'
export { defenseResolutionModeSchema, type DefenseResolutionMode }

export const obstacleSchema = z.object({
  x: z.number(),
  y: z.number(),
  radius: z.number().positive(),
})
export type Obstacle = z.infer<typeof obstacleSchema>

export const deploymentZoneSpecSchema = z.object({
  minX: z.number().min(0).optional(),
  maxX: z.number().positive().optional(),
  minY: z.number().min(0).optional(),
  maxY: z.number().positive().optional(),
})
export type DeploymentZoneSpec = z.infer<typeof deploymentZoneSpecSchema>

export const arenaDeploymentSchema = z.object({
  depth: z.number().positive().optional(),
  strategy: z.enum(['center', 'fit_formation']).optional(),
  attacker: deploymentZoneSpecSchema.optional(),
  defender: deploymentZoneSpecSchema.optional(),
})
export type ArenaDeployment = z.infer<typeof arenaDeploymentSchema>

export const arenaSpecSchema = z.object({
  width: z.number().int().min(100).max(5000).default(600),
  height: z.number().int().min(100).max(5000).default(1200),
  tileSize: z.number().int().positive().default(40),
  obstacles: z.array(obstacleSchema).default([]),
  deployment: arenaDeploymentSchema.optional(),
})
export type ArenaSpec = z.infer<typeof arenaSpecSchema>

export const timeoutPolicySchema = z.enum(['draw', 'attacker_win', 'defender_win'])
export type TimeoutPolicy = z.infer<typeof timeoutPolicySchema>

export const battleRulesSchema = z.object({
  maxTicks: z.number().int().min(1).max(5000).default(2000),
  timeoutPolicy: timeoutPolicySchema.default('draw'),
  defenseResolutionMode: defenseResolutionModeSchema.default('v9_snapshot'),
  trackMetrics: z.boolean().optional(),
  profile: z.boolean().optional(),
  rulesetId: z.string().min(1).optional(),
  rulesetVersion: z.string().min(1).optional(),
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
  rulesetId: z.string().min(1).optional(),
  rulesetVersion: z.string().min(1).optional(),
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
  metadata: combatMetadataSchema.optional(),
  profile: z.record(z.string(), z.unknown()).optional(),
  metrics: z.record(z.string(), z.unknown()).optional(),
})
export type CombatRunResult = z.infer<typeof combatRunResultSchema>
export type { CombatMetadata }

