import type { BattleAction } from '../../combat.actions'
import type { CombatWorld } from '../combat-world'
import type { EntityId } from '../entity'
import { applyEcsFieldEffectAt } from './trigger-field-system'

export function getEcsFieldEffectEntities(world: CombatWorld): EntityId[] {
  return world.query(['identity', 'transform', 'vitality', 'support'])
    .filter(entityId =>
      (world.stores.support.require(entityId).fieldEffect?.length ?? 0) > 0,
    )
}

export function runEcsFieldEffectSystem(
  world: CombatWorld,
  tick: number,
  actions: BattleAction[],
  entityIds = getEcsFieldEffectEntities(world),
): void {
  const ordered = [...entityIds].sort((left, right) =>
    world.stores.identity.require(left).id.localeCompare(
      world.stores.identity.require(right).id,
    ),
  )
  for (const entityId of ordered) {
    const vitality = world.stores.vitality.require(entityId)
    if (vitality.isDead) continue
    const source = world.stores.transform.require(entityId)
    const support = world.stores.support.require(entityId)
    for (const effect of support.fieldEffect ?? []) {
      if (tick < effect.nextTick) continue
      effect.nextTick = tick + Math.max(1, effect.intervalTicks)
      applyEcsFieldEffectAt(
        world,
        entityId,
        source,
        effect,
        actions,
        String(tick),
      )
    }
  }
}
