import type { BattleAction } from '../../combat.actions.js'
import type { CombatWorld } from '../combat-world.js'
import type { EntityId } from '../entity.js'
import type { DamageAttribution } from '../damage-source.js'
import {
  fireEcsTrigger,
} from './post-hit-trigger-system.js'

export function processEcsDeathTriggers(
  world: CombatWorld,
  deadId: EntityId,
  attribution: DamageAttribution | undefined,
  liveKillerId: EntityId | undefined,
  actions: BattleAction[],
): void {
  const triggers = world.stores.lifecycle.require(deadId).triggerEffects ?? []
  for (const trigger of triggers) {
    if (trigger.event === 'death') {
      fireEcsTrigger(world, deadId, trigger, deadId, liveKillerId, actions, attribution)
    }
  }
}
