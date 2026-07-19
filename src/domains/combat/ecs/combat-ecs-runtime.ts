import type { BattleAction } from '../combat.actions'
import type { CombatRuntime } from '../combat.runtime'
import { CombatWorld } from './combat-world'
import { createEcsMeleeEngagementState, getEcsBurrowRegenerationEntities, getEcsGrowthAndChargeEntities, getEcsTerminalOutcome, getEcsTransformModeEntities, getEcsTurnOrder, processEcsHpThresholdTriggers, reserveEcsMeleeSlot, resolveEcsDeath, runActionSystem, runDepenetrationSystem, runEcsBurrowRegenerationSystem, runEcsGrowthAndChargeSystem, runEcsPeriodicSpawnerSystem, runEcsReassemblySystem, runEcsTransformModeSystem, runHazardSystem, runModifierSystem, runMovementSystem, runStatusSystem, runTargetingSystem, syncEcsTargetRefs } from './systems'
import { createSquadEntities } from './combat-entity-factory'
import { EntitySpatialIndex } from './entity-spatial-index'
import { runEcsControlBeamPhase, runEcsFieldEffectPhase, runEcsFormationBonusPhase, runEcsGlobalEffectPhase, runEcsPeriodicAbilityPhase, runEcsSupportAuraPhase } from './combat-ecs-phase-boundaries'

const MODIFIER_COMPONENTS = ['vitality', 'combat', 'defense', 'statusControl', 'lifecycle'] as const

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
    processSpawner: (unit, target, actions, context) => {
      const unitId = world.getEntityId(unit.id)
      const targetId = world.getEntityId(target.id)
      if (unitId === undefined || targetId === undefined) return
      runEcsPeriodicSpawnerSystem(world, unitId, targetId, actions, context)
      world.syncComponentsFromStore(unitId, ['lifecycle', 'transform', 'combat', 'weapon', 'movement'])
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
    tickModifiers(unit, _dt, actions, _rng): void {
      const entityId = world.getEntityId(unit.id)
      if (entityId === undefined) return
      world.syncComponentsToStore(entityId, MODIFIER_COMPONENTS)
      runModifierSystem(world, entityId, actions, expiredId => {
        resolveEcsDeath(world, expiredId, undefined, actions, 'expiration')
      })
      world.syncComponentsFromStore(entityId, MODIFIER_COMPONENTS)
    },
    runReassemblyPhase(actions): void {
      runEcsReassemblySystem(world, actions)
      world.syncAllComponentsFromStore(['vitality', 'combat', 'statusControl', 'targeting'])
    },
    runGlobalEffectPhase: (tick, activeGlobals, actions, rng) =>
      runEcsGlobalEffectPhase(world, tick, activeGlobals, actions, rng),
    runSupportAuraPhase: (tick, actions) =>
      runEcsSupportAuraPhase(world, tick, actions),
    runGrowthAndChargePhase(tick, actions): void {
      const entityIds = getEcsGrowthAndChargeEntities(world)
      runEcsGrowthAndChargeSystem(world, tick, actions, entityIds)
      for (const entityId of entityIds) {
        world.syncComponentsFromStore(entityId, ['vitality', 'combat', 'lifecycle'])
      }
    },
    runBurrowRegenerationPhase(actions): void {
      const entityIds = getEcsBurrowRegenerationEntities(world)
      runEcsBurrowRegenerationSystem(world, actions, entityIds)
      for (const entityId of entityIds) {
        world.syncComponentsFromStore(entityId, ['vitality'])
      }
    },
    runTransformModePhase(tick, actions): void {
      const entityIds = getEcsTransformModeEntities(world)
      runEcsTransformModeSystem(world, tick, actions, entityIds)
      for (const entityId of entityIds) {
        world.syncComponentsFromStore(entityId, [
          'transform',
          'vitality',
          'combat',
          'weapon',
          'statusControl',
        ])
      }
    },
    runFieldEffectPhase: (tick, actions) =>
      runEcsFieldEffectPhase(world, tick, actions),
    runFormationBonusPhase: (tick, actions) =>
      runEcsFormationBonusPhase(world, tick, actions),
    runControlBeamPhase: actions => runEcsControlBeamPhase(world, actions),
    runPeriodicAbilityPhase: (tick, actions, rng) =>
      runEcsPeriodicAbilityPhase(world, tick, actions, rng),
    runStatusPhase(actions: BattleAction[], _rng): void {
      world.flushStructuralCommands()
      runStatusSystem(world, actions, (entityId, sourceUnitId, cause) => {
        const sourceId = sourceUnitId === undefined
          ? undefined
          : world.getEntityId(sourceUnitId)
        resolveEcsDeath(world, entityId, sourceId, actions, cause)
        world.flushStructuralCommands()
      })
      world.syncAllFromComponents()
    },
    runHazardPhase(actions, spatialHash, _rng): void {
      void spatialHash
      world.flushStructuralCommands()
      world.reconcileHazards()
      world.syncHazardsToComponents()
      world.resources.require('entitySpatial').rebuild(world)
      runHazardSystem(world, actions, (entityId, sourceUnitId, cause) => {
        const sourceId = sourceUnitId === undefined
          ? undefined
          : world.getEntityId(sourceUnitId)
        resolveEcsDeath(world, entityId, sourceId, actions, cause)
        world.flushStructuralCommands()
      })
      world.syncAllFromComponents()
      world.syncHazardsFromComponents()
    },
    runPostHazardPhase(_tick, actions, _rng): void {
      const ordered = world.query(['identity', 'vitality', 'lifecycle'])
        .sort((left, right) =>
          world.stores.identity.require(left).id.localeCompare(
            world.stores.identity.require(right).id,
          ),
        )
      for (const entityId of ordered) {
        processEcsHpThresholdTriggers(world, entityId, actions)
      }
    },
    runDepenetration: actions => {
      runDepenetrationSystem(world, actions)
      world.syncAllComponentsFromStore(['transform'])
    },
    getTerminalOutcome() {
      world.flushStructuralCommands()
      return getEcsTerminalOutcome(world)
    },
  }
}
