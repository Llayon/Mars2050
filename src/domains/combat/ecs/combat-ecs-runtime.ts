import type { BattleAction } from '../combat.actions'
import type { SimHazard } from '../combat.sim.types'
import type { CombatRuntime, RuntimeDeathHandler } from '../combat.runtime'
import { CombatWorld } from './combat-world'
import { getEcsTerminalOutcome, getEcsTurnOrder, runModifierSystem, runStatusSystem } from './systems'
import { processHazards } from '../combat.hazards'

const MODIFIER_COMPONENTS = ['vitality', 'combat', 'defense', 'statusControl', 'lifecycle'] as const
const TICK_READ_COMPONENTS = ['identity', 'transform', 'vitality', 'combat', 'weapon', 'targeting', 'statusControl', 'support', 'lifecycle'] as const
const STATUS_WRITE_COMPONENTS = ['vitality', 'statusControl'] as const

export interface EcsCombatRuntime extends CombatRuntime {
  readonly world: CombatWorld
}

export function createEcsCombatRuntime(): EcsCombatRuntime {
  const world = new CombatWorld()
  return {
    world,
    units: world.roster,
    hazards: world.hazards,
    snapshotUnits: () => { world.syncAllToComponents(); return world.snapshot() },
    getSurvivors: () => {
      world.syncAllToComponents()
      return world.query(['identity', 'vitality']).flatMap(entityId => {
        if (world.stores.vitality.require(entityId).isTemporary) return []
        return [world.snapshotEntity(entityId)]
      })
    },
    getTurnOrder: () => {
      return getEcsTurnOrder(world).flatMap(entityId => {
        const unit = world.getEntity(entityId)
        return unit ? [unit] : []
      })
    },
    tickModifiers(unit, _dt, actions, onExpire): void {
      const entityId = world.getEntityId(unit.id)
      if (entityId === undefined) return
      world.syncComponentsToStore(entityId, MODIFIER_COMPONENTS)
      runModifierSystem(world, entityId, actions, expiredId => {
        world.syncComponentsFromStore(expiredId, MODIFIER_COMPONENTS)
        const expired = world.getEntity(expiredId)
        if (expired) {
          onExpire(expired)
          world.syncComponentsToStore(expiredId, MODIFIER_COMPONENTS)
        }
      })
      world.syncComponentsFromStore(entityId, MODIFIER_COMPONENTS)
    },
    runStatusPhase(actions: BattleAction[], onUnitDeath: RuntimeDeathHandler): void {
      world.syncAllComponentsToStore(TICK_READ_COMPONENTS)
      runStatusSystem(world, actions, (entityId, sourceUnitId, cause) => {
        world.syncAllFromComponents()
        const unit = world.getEntity(entityId)
        if (unit) {
          onUnitDeath(unit, sourceUnitId, cause)
          world.syncAllToComponents()
        }
      })
      world.syncAllComponentsFromStore(STATUS_WRITE_COMPONENTS)
    },
    runHazardPhase(actions, onUnitDeath, spatialHash): void {
      processHazards(world.hazards, world.roster, actions, onUnitDeath, spatialHash)
      world.reconcileHazards()
    },
    getTerminalOutcome(hazards: SimHazard[], pendingAttackers: boolean, pendingDefenders: boolean) {
      return getEcsTerminalOutcome(world, hazards, pendingAttackers, pendingDefenders)
    },
  }
}
