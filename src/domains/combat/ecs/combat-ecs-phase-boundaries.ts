import type { BattleAction } from '../combat.actions'
import type { PRNG } from '../combat.utils'
import type { CombatWorld } from './combat-world'
import {
  getEcsControlBeamEntities,
  getEcsFieldEffectEntities,
  getEcsFormationBonusEntities,
  getEcsPeriodicAbilityEntities,
  getEcsSupportAuraEntities,
  hasEcsGlobalEffectAtTick,
  hasEcsSupportAuraAtTick,
  runEcsControlBeamSystem,
  runEcsFieldEffectSystem,
  runEcsFormationBonusSystem,
  runEcsGlobalEffectSystem,
  runEcsPeriodicAbilitySystem,
  runEcsSupportAuraSystem,
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
  runEcsGlobalEffectSystem(world, tick, activeGlobals, actions, rng)
  world.syncAllComponentsFromStore(['vitality', 'statusControl'])
}

export function runEcsSupportAuraPhase(
  world: CombatWorld,
  tick: number,
  actions: BattleAction[],
): void {
  const entityIds = getEcsSupportAuraEntities(world)
  if (!hasEcsSupportAuraAtTick(world, tick, entityIds)) return
  world.syncAllToComponents()
  world.resources.require('entitySpatial').rebuild(world)
  runEcsSupportAuraSystem(world, tick, actions, entityIds)
  world.syncAllFromComponents()
}

export function runEcsFieldEffectPhase(
  world: CombatWorld,
  tick: number,
  actions: BattleAction[],
): void {
  const entityIds = getEcsFieldEffectEntities(world)
  if (entityIds.length === 0) return
  world.flushStructuralCommands()
  world.reconcileHazards()
  world.syncAllComponentsToStore([
    'transform',
    'vitality',
    'support',
    'statusControl',
    'targeting',
  ])
  runEcsFieldEffectSystem(world, tick, actions, entityIds)
  for (const entityId of entityIds) {
    world.syncComponentsFromStore(entityId, ['support'])
  }
  world.syncAllComponentsFromStore(['statusControl', 'targeting'])
}

export function runEcsFormationBonusPhase(
  world: CombatWorld,
  tick: number,
  actions: BattleAction[],
): void {
  if (tick % 10 !== 0) return
  const entityIds = getEcsFormationBonusEntities(world)
  if (entityIds.length === 0) return
  world.syncAllComponentsToStore([
    'transform',
    'vitality',
    'support',
    'statusControl',
    'movement',
  ])
  world.resources.require('entitySpatial').rebuild(world)
  runEcsFormationBonusSystem(world, tick, actions, entityIds)
  for (const entityId of entityIds) {
    world.syncComponentsFromStore(entityId, ['statusControl', 'movement'])
  }
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
