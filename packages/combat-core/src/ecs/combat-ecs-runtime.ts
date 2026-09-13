import type { CombatRuntime } from '../combat.runtime.js'
import { CombatWorld } from './combat-world.js'
import { getEcsTerminalOutcome } from './systems/index.js'
import { createSquadEntities } from './combat-entity-factory.js'
import { EntitySpatialIndex } from './entity-spatial-index.js'
import { EcsCombatPhaseScheduler } from './combat-phase-scheduler.js'
import { TargetingRuntime } from './targeting-runtime.js'
import { DesignationIndex } from './designation-index.js'
import { PendingImpactQueue } from './pending-impacts.js'
import type { DefenseResolutionMode } from './defense-batch.js'
import { getDefaultCombatCatalog, type CombatCatalog } from '../combat.catalog.types.js'

export interface EcsCombatRuntime extends CombatRuntime {
  readonly world: CombatWorld
}

export function createEcsCombatRuntime(options: {
  profile?: boolean
  defenseResolutionMode?: DefenseResolutionMode
  catalog?: CombatCatalog
} = {}): EcsCombatRuntime {
  const profilingEnabled = options.profile === true
  const world = new CombatWorld([], { profile: profilingEnabled })
  const scheduler = new EcsCombatPhaseScheduler(world)
  const initialCatalog = options.catalog ?? getDefaultCombatCatalog()
  if (initialCatalog) world.resources.set('catalog', initialCatalog)
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
