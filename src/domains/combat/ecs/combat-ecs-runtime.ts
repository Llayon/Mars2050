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
      syncEcsTargetRefs(world)
      world.resources.require('entitySpatial').rebuild(world)
      meleeEngagement = createEcsMeleeEngagementState()
    },
    selectTarget: entityId => {
      const targetId = runTargetingSystem(world, entityId, meleeEngagement)
      world.syncComponentsFromStore(entityId, ['targeting'])
      return targetId
    },
    reserveMeleeSlot: (entityId, targetId) => {
      const reserved = reserveEcsMeleeSlot(world, entityId, targetId, meleeEngagement)
      world.syncComponentsFromStore(entityId, ['targeting'])
      return reserved
    },
    processSpawner: (entityId, targetId, actions, context) => {
      runEcsPeriodicSpawnerSystem(world, entityId, targetId, actions, context)
      world.syncComponentsFromStore(entityId, ['lifecycle', 'transform', 'combat', 'weapon', 'movement'])
    },
    actUnit: (entityId, targetId, actions, context) => {
      return runActionSystem(world, entityId, targetId, actions, context)
    },
    moveUnit: (entityId, targetId, actions, context) => {
      runMovementSystem(world, entityId, targetId, actions, context)
    },
    insertSpatialUnit: entityId =>
      world.resources.require('entitySpatial').insert(world, entityId),
    isDead: entityId => world.stores.vitality.require(entityId).isDead,
    canActOnTarget: (entityId, targetId) => {
      const source = world.stores.identity.require(entityId)
      const target = world.stores.identity.require(targetId)
      if (source.team !== target.team) return true
      if (world.stores.weapon.require(entityId).attackType === 'heal') return true
      return world.stores.statusControl.require(entityId).statusEffects.some(effect =>
        effect.type === 'hacked' &&
        effect.duration > 0 &&
        (effect.controlMode === 'redirect' || effect.controlMode === 'confuse'),
      )
    },
    snapshotUnits: () => { world.flushStructuralCommands(); return world.snapshot() },
    getSurvivors: () => {
      world.flushStructuralCommands()
      return world.query(['identity', 'vitality']).flatMap(entityId => {
        if (world.stores.vitality.require(entityId).isTemporary) return []
        return [world.snapshotEntity(entityId)]
      })
    },
    getTurnOrder: () => getEcsTurnOrder(world),
    tickModifiers(entityId, _dt, actions, _rng): void {
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
    runHazardPhase(actions, _rng): void {
      world.flushStructuralCommands()
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
