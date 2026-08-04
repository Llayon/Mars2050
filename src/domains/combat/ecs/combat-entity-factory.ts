import { compileSquadBundles } from '../combat.squad-compiler'
import type { Team } from '../combat.sim.types'
import type { RuntimeUnitFactoryInput } from '../combat.unit-build.types'
import { compileUnit } from '../combat.unit-compiler'
import type { UnitRow, UnitTypeKey } from '../combat.types'
import type { PRNG } from '../combat.utils'
import type { CombatWorld } from './combat-world'
import type { EntityId } from './entity'

export function createConfiguredUnitEntity(world: CombatWorld, input: RuntimeUnitFactoryInput): EntityId | null {
  const hp = input.hp === undefined ? undefined : Math.max(1, Math.floor(input.hp))
  const unit = compileUnit({
    definitionId: input.type as UnitTypeKey,
    identity: {
      id: input.id,
      team: input.team,
      summonOwnerId: input.summonOwnerId,
      summonSourceId: input.summonSourceId,
    },
    loadout: { rank: 1, upgradeIds: [] },
    placement: { x: input.x, y: input.y, angle: input.currentAngle },
    spawn: { inheritance: 'base' },
    overrides: {
      currentHp: hp,
      maxHp: hp,
      attack: input.attack,
      isTemporary: input.isTemporary,
      temporaryDuration: input.temporaryDuration,
    },
  })
  if (!unit) return null
  world.queueCompiledUnitCreation(unit)
  world.flushStructuralCommands()
  return world.getEntityId(unit.externalId) ?? null
}

export function createSquadEntities(world: CombatWorld, row: UnitRow, team: Team, rng: PRNG): EntityId[] {
  const units = compileSquadBundles(row, team, rng)
  world.queueCompiledUnitCreation(...units)
  world.flushStructuralCommands()
  return units.flatMap(unit => {
    const entityId = world.getEntityId(unit.externalId)
    return entityId === undefined ? [] : [entityId]
  })
}

export function cloneUnitEntity(world: CombatWorld, sourceId: EntityId, id: string, x: number, y: number): EntityId | null {
  world.queueUnitClone(sourceId, id, x, y)
  world.flushStructuralCommands()
  return world.getEntityId(id) ?? null
}
