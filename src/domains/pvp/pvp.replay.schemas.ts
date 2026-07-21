import { z } from 'zod'
import { BATTLE_ACTION_TYPES } from '@/domains/combat/combat.actions'
import { TERMINATION_REASONS } from '@/domains/combat/combat.result'

const replayUnitSchema = z.object({
  id: z.string().min(1),
  team: z.enum(['attacker', 'defender']),
  type: z.string().min(1),
  x: z.number(),
  y: z.number(),
  velocity: z.object({ x: z.number(), y: z.number() }),
  currentAngle: z.number(),
  size: z.enum(['S', 'M', 'L', 'XL']),
  isFlying: z.boolean(),
  hp: z.number(),
  maxHp: z.number().positive(),
  shield: z.number(),
  maxShield: z.number(),
  isDead: z.boolean(),
  attack: z.number(),
  defense: z.number(),
  speed: z.number(),
  range: z.number(),
  actionCooldownMax: z.number(),
  actionCooldown: z.number(),
  canTargetAir: z.boolean(),
  attackType: z.enum(['single', 'aoe', 'heal', 'spawn']),
  aggroLockTicks: z.number(),
  turnSpeed: z.number(),
  statusEffects: z.array(z.unknown()),
}).passthrough()

const replayActionSchema = z.object({
  unitId: z.string().min(1),
  type: z.enum(BATTLE_ACTION_TYPES),
}).passthrough()

export const battleReplayEnvelopeSchema = z.object({
  battle: z.object({ id: z.string().min(1) }).passthrough(),
  snapshot: z.object({
    version: z.number().int(),
    initial_state: z.unknown(),
    log: z.unknown(),
    termination_reason: z.enum(TERMINATION_REASONS).nullable().optional(),
    elapsed_ticks: z.number().int().nonnegative().nullable().optional(),
  }).passthrough(),
}).passthrough()

export const playableBattleSnapshotSchema = z.object({
  initial_state: z.array(replayUnitSchema),
  log: z.array(z.object({
    tick: z.number().int().nonnegative(),
    actions: z.array(replayActionSchema),
  }).passthrough()),
}).passthrough()
