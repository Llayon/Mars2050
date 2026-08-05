import type { BattleAction } from '../../combat.actions'
import type { CombatWorld } from '../combat-world'
import type { EntityId } from '../entity'
import type { DamageAttribution } from '../damage-source'
import {
  fireEcsTrigger,
} from './post-hit-trigger-system'

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
