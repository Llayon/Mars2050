import type { CombatRuntime } from '../combat.runtime'
import { CombatWorld } from './combat-world'
import { getEcsTerminalOutcome } from './systems'
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
  world.resources.set('entitySpatial', new EntitySpatialIndex(undefined, profilingEnabled))
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
