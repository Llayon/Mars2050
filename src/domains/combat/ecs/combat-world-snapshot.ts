import type { SimHazard, SimUnit } from '../combat.sim.types'
import { COMPONENT_FIELDS, type UnitComponentName } from './combat-components'
import type { CombatWorld } from './combat-world'
import type { EntityId } from './entity'
import { serializeUnitRelations, type PendingUnitRelations } from './unit-relation-codec'

export function createUnitSnapshot(
  world: CombatWorld,
  entityId: EntityId,
  pending?: PendingUnitRelations,
): SimUnit {
  const snapshot: Record<string, unknown> = {}
  for (const name of Object.keys(COMPONENT_FIELDS) as UnitComponentName[]) {
    Object.assign(snapshot, world.stores[name].get(entityId))
  }
  Object.assign(snapshot, serializeUnitRelations(world, entityId, pending))
  return structuredClone(snapshot) as unknown as SimUnit
}

export function createUnitSnapshots(
  world: CombatWorld,
  entityIds: readonly EntityId[],
  getPending: (entityId: EntityId) => PendingUnitRelations | undefined,
): SimUnit[] {
  return entityIds
    .filter(entityId => world.stores.entityMeta.get(entityId)?.kind === 'unit')
    .map(entityId => createUnitSnapshot(world, entityId, getPending(entityId)))
}

export function createHazardSnapshots(world: CombatWorld): SimHazard[] {
  return world.query(['hazard'], true).flatMap(entityId => {
    const hazard = world.stores.hazard.get(entityId)
    return hazard ? [structuredClone(hazard)] : []
  })
}
