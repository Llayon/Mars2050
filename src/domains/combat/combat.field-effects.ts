import type { BattleAction } from './combat.actions'
import { HARMFUL_STATUS_TYPES, cleanseStatuses } from './combat.status'
import type { HazardKind, RuntimeFieldEffect, SimHazard, SimUnit } from './combat.sim.types'
import { getDistance } from './combat.utils'

const CLEANSE_HAZARDS: HazardKind[] = ['napalm', 'acid', 'emp', 'emp_field', 'radiation', 'smoke']

export function processFieldEffects(tick: number, units: SimUnit[], hazards: SimHazard[], actions: BattleAction[]): void {
  const sources = units
    .filter(unit => !unit.isDead && (unit.fieldEffect?.length ?? 0) > 0)
    .sort((a, b) => a.id.localeCompare(b.id))

  for (const source of sources) {
    for (const effect of source.fieldEffect ?? []) {
      if (tick < effect.nextTick) continue
      effect.nextTick = tick + Math.max(1, effect.intervalTicks)
      applyFieldEffect(source, effect, units, hazards, actions, tick)
    }
  }
}

export function getFieldDamageReduction(target: SimUnit, hazards: SimHazard[] | undefined): number {
  if (!hazards) return 0
  let reduction = 0
  for (const hazard of hazards) {
    if (hazard.type !== 'barrier_dome' || hazard.team !== target.team || hazard.duration <= 0) continue
    if (getDistance(target.x, target.y, hazard.x, hazard.y) > hazard.radius) continue
    reduction = Math.max(reduction, Math.max(0, Math.min(0.95, hazard.damageReduction ?? 0)))
  }
  return reduction
}

function applyFieldEffect(
  source: SimUnit,
  effect: RuntimeFieldEffect,
  units: SimUnit[],
  hazards: SimHazard[],
  actions: BattleAction[],
  tick: number
): void {
  actions.push({ unitId: source.id, type: 'field_effect', statusType: effect.kind, radius: effect.radius })
  if (effect.kind === 'barrier_dome') {
    const capacity = effect.capacity === undefined ? undefined : Math.max(1, Math.floor(effect.capacity))
    hazards.push({
      id: `barrier_${source.id}_${effect.id}_${tick}`,
      team: source.team,
      type: 'barrier_dome',
      x: source.x,
      y: source.y,
      radius: effect.radius,
      damagePerTick: 0,
      duration: effect.duration ?? effect.intervalTicks,
      damageReduction: capacity === undefined ? Math.max(0, Math.min(0.95, effect.value ?? 0.35)) : undefined,
      capacity,
      maxCapacity: capacity,
      sourceUnitId: source.id,
    })
    if (capacity !== undefined) actions.push({ unitId: source.id, type: 'barrier_spawn', hazardId: `barrier_${source.id}_${effect.id}_${tick}`, radius: effect.radius, damage: capacity })
    return
  }

  if (effect.kind === 'cleanse_field') {
    cleanseHazardsInRadius(source, effect, hazards, actions)
    cleanseUnitsInRadius(source, effect.radius, units, actions)
    return
  }

  hazards.push({
    id: `field_${source.id}_${effect.id}_${tick}`,
    team: source.team,
    type: effect.hazardType ?? 'smoke',
    x: source.x,
    y: source.y,
    radius: effect.radius,
    damagePerTick: effect.damagePerTick ?? 0,
    duration: effect.duration ?? effect.intervalTicks,
    statusEffects: effect.statusEffects?.map(status => ({ ...status })),
  })
}

function cleanseHazardsInRadius(source: SimUnit, effect: RuntimeFieldEffect, hazards: SimHazard[], actions: BattleAction[]): void {
  const removable = new Set(effect.hazardTypes ?? CLEANSE_HAZARDS)
  for (let i = hazards.length - 1; i >= 0; i--) {
    const hazard = hazards[i]
    if (!removable.has(hazard.type) || getDistance(source.x, source.y, hazard.x, hazard.y) > effect.radius) continue
    hazards.splice(i, 1)
    actions.push({ unitId: source.id, type: 'hazard_cleanse', hazardId: hazard.id, statusType: hazard.type })
  }
}

function cleanseUnitsInRadius(source: SimUnit, radius: number, units: SimUnit[], actions: BattleAction[]): void {
  const allies = units
    .filter(unit => !unit.isDead && unit.team === source.team && getDistance(source.x, source.y, unit.x, unit.y) <= radius)
    .sort((a, b) => a.id.localeCompare(b.id))
  for (const ally of allies) cleanseStatuses(ally, HARMFUL_STATUS_TYPES, actions)
}
