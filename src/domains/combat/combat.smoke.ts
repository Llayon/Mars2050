import type { BattleAction } from './combat.actions'
import type { SimHazard, SimUnit, StatusEffect } from './combat.sim.types'
import { FIELD_HEIGHT, FIELD_WIDTH, PRNG } from './combat.utils'

/**
 * Deploys a deterministic smoke field for units configured with smokeOnAction.
 * @param unit Unit deploying smoke
 * @param target Current combat target
 * @param hazards Global hazard list
 * @param actions Replay action sink
 * @param rng Seeded PRNG
 * @returns true when smoke was deployed
 */
export function tryDeploySmoke(unit: SimUnit, target: SimUnit, hazards: SimHazard[], actions: BattleAction[], rng: PRNG): boolean {
  const config = unit.smokeOnAction
  if (!config) return false

  const statusEffects = createSmokeStatuses(config)
  if (statusEffects.length === 0) return false

  const dx = target.x - unit.x
  const dy = target.y - unit.y
  const distance = Math.hypot(dx, dy) || 1
  const placementDistance = Math.min(unit.range, Math.max(24, distance * 0.75))
  const x = clamp(unit.x + (dx / distance) * placementDistance, 0, FIELD_WIDTH)
  const y = clamp(unit.y + (dy / distance) * placementDistance, 0, FIELD_HEIGHT)
  const id = `smoke_${Math.floor(rng.next() * 1000000)}`

  hazards.push({ id, team: unit.team, type: 'smoke', x, y, radius: config.radius, damagePerTick: 0, duration: config.duration, statusEffects })
  actions.push({ unitId: unit.id, type: 'hazard_spawn', hazardId: id, toX: round(x), toY: round(y), radius: config.radius, statusType: 'smoke' })
  return true
}

function createSmokeStatuses(config: NonNullable<SimUnit['smokeOnAction']>): StatusEffect[] {
  const effects: StatusEffect[] = []
  if ((config.rangeSuppression ?? 0) > 0) effects.push({ type: 'range_suppressed', duration: 12, value: config.rangeSuppression })
  if ((config.outputSuppression ?? 0) > 0) effects.push({ type: 'output_suppressed', duration: 12, value: config.outputSuppression })
  if ((config.accuracySuppression ?? 0) > 0) effects.push({ type: 'accuracy_reduced', duration: 12, value: config.accuracySuppression })
  return effects
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function round(value: number): number {
  return Math.round(value * 100) / 100
}
