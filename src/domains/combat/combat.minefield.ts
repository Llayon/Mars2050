import type { BattleAction } from './combat.actions'
import { UNIT_TYPES } from './combat.config'
import type { SimHazard, SimUnit } from './combat.sim.types'
import type { UnitTypeKey } from './combat.types'
import { FIELD_HEIGHT, FIELD_WIDTH, PRNG } from './combat.utils'

/**
 * Deploys a mine for units configured with mineOnAction.
 * @param unit Unit deploying the mine
 * @param target Current combat target
 * @param hazards Global hazard list
 * @param actions Replay action sink
 * @param rng Seeded PRNG
 * @returns true when a mine was deployed
 */
export function tryDeployMine(
  unit: SimUnit,
  target: SimUnit,
  hazards: SimHazard[],
  actions: BattleAction[],
  rng: PRNG
): boolean {
  const config = UNIT_TYPES[unit.type as UnitTypeKey]?.baseStats.mineOnAction
  if (!config) return false

  const dx = target.x - unit.x
  const dy = target.y - unit.y
  const distance = Math.hypot(dx, dy) || 1
  const placementDistance = Math.min(unit.range, Math.max(24, distance * 0.65))
  const x = clamp(unit.x + (dx / distance) * placementDistance, 0, FIELD_WIDTH)
  const y = clamp(unit.y + (dy / distance) * placementDistance, 0, FIELD_HEIGHT)
  const id = `mine_${Math.floor(rng.next() * 1000000)}`

  hazards.push({
    id,
    team: unit.team,
    type: 'mine',
    x,
    y,
    radius: config.radius,
    damagePerTick: config.damage,
    duration: config.duration,
    sourceUnitId: unit.id,
  })
  actions.push({
    unitId: unit.id,
    type: 'hazard_spawn',
    hazardId: id,
    toX: Math.round(x * 100) / 100,
    toY: Math.round(y * 100) / 100,
    radius: config.radius,
  })

  return true
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}
