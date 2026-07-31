import { getDir } from '@/domains/combat/combat.utils'
import type {
  ReplayUnit,
  ReplayUnitVisualState,
  ReplayVisualClip,
  ReplayVisualDirection,
} from './battle-replay-canvas-types'
import {
  getReplayVisualClipDuration,
  normalizeReplayVisualDirection,
} from './battle-replay-visual-clips'

const MOVEMENT_CONTINUITY_MS = 160

export interface ReplayResolvedVisualState {
  clip: ReplayVisualClip
  direction: ReplayVisualDirection
  elapsedMs: number
}

export function createReplayUnitVisualState(
  team: ReplayUnit['team'],
  isDead = false,
): ReplayUnitVisualState {
  return {
    facing: team === 'attacker' ? 'north' : 'south',
    clipStartedAtMs: 0,
    attackStartedAtMs: null,
    deathStartedAtMs: isDead ? 0 : null,
    lastMovementAtMs: null,
  }
}

export function markReplayUnitMovement(
  unit: ReplayUnit,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  replayTimeMs: number,
): void {
  const dx = toX - fromX
  const dy = toY - fromY
  if (Math.hypot(dx, dy) <= 0.1) return
  unit.visual.facing = normalizeReplayVisualDirection(getDir(dx, dy))
  const lastMovementAtMs = unit.visual.lastMovementAtMs
  if (
    lastMovementAtMs === null ||
    replayTimeMs - lastMovementAtMs > MOVEMENT_CONTINUITY_MS
  ) {
    unit.visual.clipStartedAtMs = replayTimeMs
  }
  unit.visual.lastMovementAtMs = replayTimeMs
}

export function markReplayUnitAttack(
  unit: ReplayUnit,
  targetX: number,
  targetY: number,
  replayTimeMs: number,
): void {
  const dx = targetX - unit.tX
  const dy = targetY - unit.tY
  if (Math.hypot(dx, dy) > 0.1) {
    unit.visual.facing = normalizeReplayVisualDirection(getDir(dx, dy))
  }
  unit.visual.attackStartedAtMs = replayTimeMs
  unit.visual.clipStartedAtMs = replayTimeMs
}

export function markReplayUnitDeath(
  unit: ReplayUnit,
  replayTimeMs: number,
): void {
  if (unit.visual.deathStartedAtMs !== null) return
  unit.visual.deathStartedAtMs = replayTimeMs
  unit.visual.clipStartedAtMs = replayTimeMs
}

export function resolveReplayUnitVisualState(
  unit: ReplayUnit,
  replayTimeMs: number,
): ReplayResolvedVisualState {
  if (unit.isDead) {
    return resolvedState(
      'death',
      unit.visual.facing,
      replayTimeMs,
      unit.visual.deathStartedAtMs ?? replayTimeMs,
    )
  }

  const attackStartedAtMs = unit.visual.attackStartedAtMs
  if (
    attackStartedAtMs !== null &&
    replayTimeMs - attackStartedAtMs <
      getReplayVisualClipDuration(unit.type, 'attack')
  ) {
    return resolvedState(
      'attack',
      unit.visual.facing,
      replayTimeMs,
      attackStartedAtMs,
    )
  }

  const moving = Math.hypot(unit.tX - unit.sX, unit.tY - unit.sY) > 0.1
  return resolvedState(
    moving ? 'walk' : 'idle',
    unit.visual.facing,
    replayTimeMs,
    unit.visual.clipStartedAtMs,
  )
}

function resolvedState(
  clip: ReplayVisualClip,
  direction: ReplayVisualDirection,
  replayTimeMs: number,
  startedAtMs: number,
): ReplayResolvedVisualState {
  return {
    clip,
    direction,
    elapsedMs: Math.max(0, replayTimeMs - startedAtMs),
  }
}
