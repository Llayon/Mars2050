import { compileSquadBundles } from '../combat.squad-compiler.js'
import type { Team } from '../combat.sim.types.js'
import type { RuntimeUnitFactoryInput } from '../combat.unit-build.types.js'
import { compileUnit } from '../combat.unit-compiler.js'
import type { UnitRow, UnitTypeKey } from '../combat.types.js'
import type { PRNG } from '../combat.utils.js'
import { getDefaultCombatCatalog } from '../combat.catalog.types.js'
import type { CombatWorld } from './combat-world.js'
import type { EntityId } from './entity.js'

export function createConfiguredUnitEntity(world: CombatWorld, input: RuntimeUnitFactoryInput): EntityId | null {
  const hp = input.hp === undefined ? undefined : Math.max(1, Math.floor(input.hp))
  const catalog = world.resources.get('catalog') ?? getDefaultCombatCatalog()
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
    catalog,
  })
  if (!unit) return null
  world.queueCompiledUnitCreation(unit)
  world.flushStructuralCommands()
  return world.getEntityId(unit.externalId) ?? null
}

export function createSquadEntities(world: CombatWorld, row: UnitRow, team: Team, rng: PRNG): EntityId[] {
  const catalog = world.resources.get('catalog') ?? getDefaultCombatCatalog()
  const arena = world.resources.get('arena')
  const units = compileSquadBundles(row, team, rng, catalog, arena)
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
