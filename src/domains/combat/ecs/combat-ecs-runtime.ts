import type { CombatRuntime } from '../combat.runtime'
import { CombatWorld } from './combat-world'
import { getEcsTerminalOutcome } from './systems'
import { createSquadEntities } from './combat-entity-factory'
import { EntitySpatialIndex } from './entity-spatial-index'
import { EcsCombatPhaseScheduler } from './combat-phase-scheduler'
import { TargetingRuntime } from './targeting-runtime'
import { DesignationIndex } from './designation-index'
import { PendingImpactQueue } from './pending-impacts'
import type { DefenseResolutionMode } from './defense-batch'

export interface EcsCombatRuntime extends CombatRuntime {
  readonly world: CombatWorld
}

export function createEcsCombatRuntime(options: { profile?: boolean; defenseResolutionMode?: DefenseResolutionMode } = {}): EcsCombatRuntime {
  const profilingEnabled = options.profile === true
  const world = new CombatWorld([], { profile: profilingEnabled })
  const scheduler = new EcsCombatPhaseScheduler(world)
  world.resources.set('entitySpatial', new EntitySpatialIndex(undefined, profilingEnabled))
  world.resources.set('combatTagCache', new Map())
  world.resources.set('dirtySpatialEntities', new Set())
  world.resources.set(
    'targetingRuntime',
    new TargetingRuntime(profilingEnabled),
  )
  world.resources.set('designationIndex', new DesignationIndex())
  world.resources.set('pendingImpacts', new PendingImpactQueue())
  world.resources.set('temporalAttacks', new Map())
  world.resources.set('defenseResolutionMode', options.defenseResolutionMode ?? 'v9_snapshot')
  world.resources.set('v9FollowUps', [])
  world.resources.set('statusDamageAttribution', new Map())
  return {
    world,
    addSquad: (row, team, rng) => { createSquadEntities(world, row, team, rng) },
    flushStructuralCommands: () => world.flushStructuralCommands(),
    snapshotUnits: () => { world.flushStructuralCommands(); return world.snapshot() },
    getSurvivors: () => {
      world.flushStructuralCommands()
      return world.query(['identity', 'vitality']).flatMap(entityId => {
        if (world.stores.vitality.require(entityId).isTemporary) return []
        return [world.snapshotEntity(entityId)]
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
