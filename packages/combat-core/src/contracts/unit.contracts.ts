import { z } from 'zod'

export const teamSchema = z.enum(['attacker', 'defender'])
export type Team = z.infer<typeof teamSchema>

export const unitSizeSchema = z.enum(['S', 'M', 'L', 'XL'])
export type UnitSize = z.infer<typeof unitSizeSchema>

export const attackTypeSchema = z.enum(['single', 'aoe', 'beam', 'spread', 'spawn', 'heal'])
export type AttackType = z.infer<typeof attackTypeSchema>

export const formationSchema = z.enum(['grid', 'line', 'wedge'])
export type Formation = z.infer<typeof formationSchema>

export const baseStatsSchema = z.object({
  hp: z.number().positive(),
  attack: z.number().nonnegative(),
  defense: z.number().nonnegative(),
  speed: z.number().nonnegative(),
  range: z.number().nonnegative(),
  attackType: attackTypeSchema.default('single'),
  actionCooldownMax: z.number().int().positive().default(10),
  turnSpeed: z.number().positive().default(5),
  size: unitSizeSchema.default('M'),
  combatTags: z.array(z.string()).default([]),
  spawnType: z.string().optional(),
  spawnCap: z.number().int().positive().optional(),
})
export type BaseStats = z.infer<typeof baseStatsSchema>

export const unitDefinitionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  baseStats: baseStatsSchema,
  squadSize: z.number().int().positive().default(1),
  squadSpacing: z.number().nonnegative().default(20),
  formation: formationSchema.default('grid'),
})
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
})
export type UnitSpawnSpec = z.infer<typeof unitSpawnSpecSchema>
