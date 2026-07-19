import type { BattleAction } from '../combat.actions'
import type { CombatWorld } from './combat-world'
import {
  getEcsControlBeamEntities,
  runEcsControlBeamSystem,
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
