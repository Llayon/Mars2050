import type { BattleAction } from '../combat.actions'
import type { PRNG } from '../combat.utils'
import type { CombatWorld } from './combat-world'
import {
  getEcsControlBeamEntities,
  getEcsPeriodicAbilityEntities,
  hasEcsGlobalEffectAtTick,
  runEcsControlBeamSystem,
  runEcsGlobalEffectSystem,
  runEcsPeriodicAbilitySystem,
  syncEcsTargetRefs,
} from './systems'
import type { GlobalUpgradeConfig } from '../combat.upgrades'
import type { Team } from '../combat.sim.types'

const CONTROL_COMPONENTS = [
  'identity',
  'transform',
  'vitality',
  'combat',
  'targeting',
] as const

export function runEcsGlobalEffectPhase(
  world: CombatWorld,
  tick: number,
  activeGlobals: { team: Team, upg: GlobalUpgradeConfig }[],
  actions: BattleAction[],
  rng: PRNG,
): void {
  if (!hasEcsGlobalEffectAtTick(tick, activeGlobals)) return
  world.syncAllComponentsToStore([
    'identity',
    'transform',
    'vitality',
    'statusControl',
  ])
  runEcsGlobalEffectSystem(world, tick, activeGlobals, actions, rng)
  world.syncAllComponentsFromStore(['vitality', 'statusControl'])
}

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
