import type { BattleAction } from '../combat.actions'
import type { SimHazard } from '../combat.sim.types'
import type { CombatRuntime, RuntimeDeathHandler } from '../combat.runtime'
import { CombatWorld } from './combat-world'
import { createEcsMeleeEngagementState, getEcsTerminalOutcome, getEcsTurnOrder, processEcsHpThresholdTriggers, reserveEcsMeleeSlot, resolveEcsDeath, runActionSystem, runDepenetrationSystem, runHazardSystem, runModifierSystem, runMovementSystem, runStatusSystem, runTargetingSystem, syncEcsTargetRefs } from './systems'
import { createSquadEntities } from './combat-entity-factory'
import { EntitySpatialIndex } from './entity-spatial-index'

const MODIFIER_COMPONENTS = ['vitality', 'combat', 'defense', 'statusControl', 'lifecycle'] as const
const TICK_READ_COMPONENTS = ['identity', 'transform', 'vitality', 'combat', 'weapon', 'targeting', 'statusControl', 'support', 'lifecycle'] as const

export interface EcsCombatRuntime extends CombatRuntime {
  readonly world: CombatWorld
}

export function createEcsCombatRuntime(): EcsCombatRuntime {
  const world = new CombatWorld()
  let meleeEngagement = createEcsMeleeEngagementState()
  world.resources.set('entitySpatial', new EntitySpatialIndex())
  return {
    world,
    units: world.roster,
    hazards: world.hazards,
    addSquad: (row, team, rng) => { createSquadEntities(world, row, team, rng) },
    flushStructuralCommands: () => world.flushStructuralCommands(),
    beginTargetingPhase: () => {
      world.flushStructuralCommands()
      world.syncAllToComponents()
      syncEcsTargetRefs(world)
      world.resources.require('entitySpatial').rebuild(world)
      meleeEngagement = createEcsMeleeEngagementState()
    },
    selectTarget: unit => {
      const entityId = world.getEntityId(unit.id)
      if (entityId === undefined) return null
      const targetId = runTargetingSystem(world, entityId, meleeEngagement)
      world.syncComponentsFromStore(entityId, ['targeting'])
      return targetId === null ? null : world.getEntity(targetId) ?? null
    },
    reserveMeleeSlot: (unit, target) => {
      const unitId = world.getEntityId(unit.id)
      const targetId = world.getEntityId(target.id)
      if (unitId === undefined || targetId === undefined) return false
      const reserved = reserveEcsMeleeSlot(world, unitId, targetId, meleeEngagement)
      world.syncComponentsFromStore(unitId, ['targeting'])
      return reserved
    },
    actUnit: (unit, target, actions, context) => {
      const unitId = world.getEntityId(unit.id)
      const targetId = world.getEntityId(target.id)
      if (unitId === undefined || targetId === undefined) return { acted: false, actorSynchronized: false }
      return runActionSystem(world, unitId, targetId, actions, context)
    },
    moveUnit: (unit, target, actions, context) => {
      const unitId = world.getEntityId(unit.id)
      const targetId = world.getEntityId(target.id)
      if (unitId === undefined || targetId === undefined) return
      runMovementSystem(world, unitId, targetId, actions, context)
    },
    completeActorTurn: (unit, actions, actionStart, actorSynchronized = false) => {
      const dirtyIds = new Set<number>()
      const actorId = world.getEntityId(unit.id)
      if (actorId !== undefined && !actorSynchronized) dirtyIds.add(actorId)
      let hasSquadMark = false
      for (let index = actionStart; index < actions.length; index++) {
        const action = actions[index]
        for (const externalId of [action.unitId, action.targetId, action.sourceUnitId]) {
          const entityId = externalId ? world.getEntityId(externalId) : undefined
          if (entityId !== undefined && (!actorSynchronized || entityId !== actorId)) dirtyIds.add(entityId)
        }
        if (action.type === 'target_mark') hasSquadMark = true
      }
      for (const entityId of dirtyIds) world.syncEntityToComponents(entityId)
      if (hasSquadMark) {
        world.syncAllComponentsToStore(['targeting', 'statusControl'])
        syncEcsTargetRefs(world)
      } else syncEcsTargetRefs(world, [...dirtyIds])
    },
    insertSpatialUnit: unit => {
      const entityId = world.getEntityId(unit.id)
      if (entityId !== undefined) world.resources.require('entitySpatial').insert(world, entityId)
    },
    snapshotUnits: () => { world.flushStructuralCommands(); world.syncAllToComponents(); return world.snapshot() },
    getSurvivors: () => {
      world.flushStructuralCommands()
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
    runStatusPhase(actions: BattleAction[], _onUnitDeath: RuntimeDeathHandler): void {
      world.flushStructuralCommands()
      world.syncAllComponentsToStore(TICK_READ_COMPONENTS)
      runStatusSystem(world, actions, (entityId, sourceUnitId, cause) => {
        const sourceId = sourceUnitId === undefined
          ? undefined
          : world.getEntityId(sourceUnitId)
        resolveEcsDeath(world, entityId, sourceId, actions, cause)
        world.flushStructuralCommands()
      })
      world.syncAllFromComponents()
    },
    runHazardPhase(actions, onUnitDeath, spatialHash): void {
      void spatialHash
      world.syncAllToComponents()
      world.flushStructuralCommands()
      world.reconcileHazards()
      world.syncHazardsToComponents()
      world.resources.require('entitySpatial').rebuild(world)
      runHazardSystem(world, actions, (entityId, sourceUnitId, cause) => {
        world.syncAllFromComponents()
        world.syncHazardsFromComponents()
        const unit = world.getEntity(entityId)
        if (unit) {
          onUnitDeath(unit, sourceUnitId, cause)
          world.flushStructuralCommands()
          world.syncAllToComponents()
          world.syncHazardsToComponents()
        }
      })
      world.syncAllFromComponents()
      world.syncHazardsFromComponents()
    },
    runPostHazardPhase(triggerContext): void {
      const ordered = world.query(['identity', 'vitality', 'lifecycle'])
        .sort((left, right) =>
          world.stores.identity.require(left).id.localeCompare(
            world.stores.identity.require(right).id,
          ),
        )
      for (const entityId of ordered) {
        processEcsHpThresholdTriggers(world, entityId, triggerContext.actions)
      }
    },
    runDepenetration: actions => {
      runDepenetrationSystem(world, actions)
      world.syncAllComponentsFromStore(['transform'])
    },
    getTerminalOutcome(hazards: SimHazard[], pendingAttackers: boolean, pendingDefenders: boolean) {
      return getEcsTerminalOutcome(world, hazards, pendingAttackers, pendingDefenders)
    },
  }
}
