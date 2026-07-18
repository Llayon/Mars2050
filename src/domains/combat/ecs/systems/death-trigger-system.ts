import type { BattleAction } from '../../combat.actions'
import type { CombatWorld } from '../combat-world'
import type { EntityId } from '../entity'
import {
  fireEcsTrigger,
} from './post-hit-trigger-system'

export function processEcsDeathTriggers(
  world: CombatWorld,
  deadId: EntityId,
  killerId: EntityId,
  actions: BattleAction[],
): void {
  const triggers = world.stores.lifecycle.require(deadId).triggerEffects ?? []
  for (const trigger of triggers) {
    if (trigger.event === 'death') {
      fireEcsTrigger(world, deadId, trigger, deadId, killerId, actions)
    }
  }
  world.syncComponentsFromStore(deadId, ['lifecycle'])
}
