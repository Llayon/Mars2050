import type { CombatRuntime } from '../combat.runtime'
import { CombatWorld } from './combat-world'
import { createEcsMeleeEngagementState, getEcsTerminalOutcome, getEcsTurnOrder, reserveEcsMeleeSlot, resolveEcsDeath, runActionSystem, runEcsPeriodicSpawnerSystem, runModifierSystem, runMovementSystem, runTargetingSystem } from './systems'
import { createSquadEntities } from './combat-entity-factory'
import { EntitySpatialIndex } from './entity-spatial-index'
import { EcsCombatPhaseScheduler } from './combat-phase-scheduler'

export interface EcsCombatRuntime extends CombatRuntime {
  readonly world: CombatWorld
}

export function createEcsCombatRuntime(options: { profile?: boolean } = {}): EcsCombatRuntime {
  const profilingEnabled = options.profile === true
  const world = new CombatWorld([], { profile: profilingEnabled })
  const scheduler = new EcsCombatPhaseScheduler(world)
  let meleeEngagement = createEcsMeleeEngagementState()
  world.resources.set('entitySpatial', new EntitySpatialIndex(undefined, profilingEnabled))
  return {
    world,
    addSquad: (row, team, rng) => { createSquadEntities(world, row, team, rng) },
    flushStructuralCommands: () => world.flushStructuralCommands(),
    beginTargetingPhase: () => {
      world.flushStructuralCommands()
      world.resources.require('entitySpatial').ensureCurrent(world)
      meleeEngagement = createEcsMeleeEngagementState()
    },
    selectTarget: entityId =>
      runTargetingSystem(world, entityId, meleeEngagement),
    reserveMeleeSlot: (entityId, targetId) =>
      reserveEcsMeleeSlot(world, entityId, targetId, meleeEngagement),
    processSpawner: (entityId, targetId, actions, context) => {
      if (!world.stores.periodicSpawnerCapability.has(entityId)) return
      runEcsPeriodicSpawnerSystem(world, entityId, targetId, actions, context)
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
    },
    runPhase: (id, context) => scheduler.runPhase(id, context),
    runStage: (stage, context) => scheduler.runStage(stage, context),
    getTerminalOutcome() {
      world.flushStructuralCommands()
      return getEcsTerminalOutcome(world)
    },
  }
}
