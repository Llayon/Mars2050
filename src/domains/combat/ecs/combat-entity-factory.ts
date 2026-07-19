import { createRuntimeSquad } from '../combat.squad-factory'
import { cloneRuntimeUnit, createRuntimeUnitFromConfig, type RuntimeUnitFactoryInput } from '../combat.unit-factory'
import type { Team } from '../combat.sim.types'
import type { UnitRow } from '../combat.types'
import type { PRNG } from '../combat.utils'
import type { CombatWorld } from './combat-world'
import type { EntityId } from './entity'

export function createConfiguredUnitEntity(world: CombatWorld, input: RuntimeUnitFactoryInput): EntityId | null {
  const unit = createRuntimeUnitFromConfig(input)
  if (!unit) return null
  world.queueUnitCreation(unit)
  world.flushStructuralCommands()
  return world.getEntityId(unit.id) ?? null
}

export function createSquadEntities(world: CombatWorld, row: UnitRow, team: Team, rng: PRNG): EntityId[] {
  const units = createRuntimeSquad(row, team, rng)
  world.queueUnitCreation(...units)
  world.flushStructuralCommands()
  return units.flatMap(unit => {
    const entityId = world.getEntityId(unit.id)
    return entityId === undefined ? [] : [entityId]
  })
}

export function cloneUnitEntity(world: CombatWorld, sourceId: EntityId, id: string, x: number, y: number): EntityId | null {
  const source = world.snapshotEntity(sourceId)
  const clone = cloneRuntimeUnit(source, id, x, y)
  world.queueUnitCreation(clone)
  world.flushStructuralCommands()
  return world.getEntityId(clone.id) ?? null
}
