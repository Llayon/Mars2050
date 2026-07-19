import type { BattleAction } from '@/domains/combat/combat.actions'
import type { DeathCause } from '@/domains/combat/combat.death'
import type { SimHazard, SimUnit } from '@/domains/combat/combat.sim.types'
import type { PRNG } from '@/domains/combat/combat.utils'
import { CombatWorld } from '@/domains/combat/ecs/combat-world'
import { resolveEcsDeath } from '@/domains/combat/ecs/systems'

export function resolveDeathInEcs(
  target: SimUnit,
  source: SimUnit | undefined,
  units: SimUnit[],
  actions: BattleAction[],
  hazards: SimHazard[],
  rng: PRNG,
  cause: DeathCause = 'weapon',
): boolean {
  const world = new CombatWorld(structuredClone(units))
  world.hazards.push(...structuredClone(hazards))
  world.flushStructuralCommands()
  world.resources.set('rng', rng)
  const targetId = world.getEntityId(target.id)
  const sourceId = source === undefined ? undefined : world.getEntityId(source.id)
  if (targetId === undefined) return false

  const resolved = resolveEcsDeath(world, targetId, sourceId, actions, cause)
  world.flushStructuralCommands()
  exportState(world, units, hazards)
  return resolved
}

function exportState(
  world: CombatWorld,
  units: SimUnit[],
  hazards: SimHazard[],
): void {
  const snapshots = world.snapshot()
  const byId = new Map(snapshots.map(snapshot => [snapshot.id, snapshot]))
  for (const unit of units) {
    const snapshot = byId.get(unit.id)
    if (snapshot) Object.assign(unit, snapshot)
  }
  const knownIds = new Set(units.map(unit => unit.id))
  units.push(...snapshots.filter(snapshot => !knownIds.has(snapshot.id)))
  const hazardSnapshots = world.query(['hazard'], true).flatMap(entityId => {
    const hazard = world.getHazard(entityId)
    return hazard ? [structuredClone(hazard)] : []
  })
  hazards.splice(0, hazards.length, ...hazardSnapshots)
}
