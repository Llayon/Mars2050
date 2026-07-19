import type { BattleAction } from '../combat.actions'
import type { PRNG } from '../combat.utils'
import type { CombatWorld } from './combat-world'
import {
  getEcsControlBeamEntities,
  getEcsPeriodicAbilityEntities,
  runEcsControlBeamSystem,
  runEcsPeriodicAbilitySystem,
  syncEcsTargetRefs,
} from './systems'

const CONTROL_COMPONENTS = [
  'identity',
  'transform',
  'vitality',
  'combat',
  'targeting',
] as const

export function runEcsControlBeamPhase(
  world: CombatWorld,
  actions: BattleAction[],
): void {
  const entityIds = getEcsControlBeamEntities(world)
  if (entityIds.length === 0) return
  world.syncAllComponentsToStore(CONTROL_COMPONENTS)
  world.resources.require('entitySpatial').rebuild(world)
  runEcsControlBeamSystem(world, actions, entityIds)
  world.syncAllComponentsFromStore(['identity', 'vitality', 'targeting'])
}

export function runEcsPeriodicAbilityPhase(
  world: CombatWorld,
  tick: number,
  actions: BattleAction[],
  rng: PRNG,
): void {
  const entityIds = getEcsPeriodicAbilityEntities(world)
  if (entityIds.length === 0) return
  world.flushStructuralCommands()
  world.syncAllToComponents()
  syncEcsTargetRefs(world)
  world.resources.set('rng', rng)
  world.resources.require('entitySpatial').rebuild(world)
  runEcsPeriodicAbilitySystem(world, tick, actions, entityIds)
  world.flushStructuralCommands()
  world.syncAllFromComponents()
}
