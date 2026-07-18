import type { BattleAction } from '../../combat.actions'
import type { CombatWorld } from '../combat-world'
import { applyEcsHealing } from './healing-system'

export function runEcsBurrowRegenerationSystem(
  world: CombatWorld,
  actions: BattleAction[],
): void {
  const burrowed = world.query(['identity', 'vitality', 'movement'])
    .filter(entityId => {
      const movement = world.stores.movement.require(entityId)
      return movement.isBurrowed &&
        Boolean(movement.burrowConfig?.regenPercentPerTick)
    })
    .sort((left, right) =>
      world.stores.identity.require(left).id.localeCompare(
        world.stores.identity.require(right).id,
      ),
    )

  for (const entityId of burrowed) {
    const vitality = world.stores.vitality.require(entityId)
    const movement = world.stores.movement.require(entityId)
    const regen = Math.max(
      1,
      Math.floor(
        vitality.maxHp * (movement.burrowConfig?.regenPercentPerTick ?? 0),
      ),
    )
    const actualHeal = applyEcsHealing(
      world,
      entityId,
      entityId,
      regen,
    )
    if (actualHeal <= 0) continue
    const externalId = world.stores.identity.require(entityId).id
    actions.push({
      unitId: externalId,
      type: 'burrow_regen',
      targetId: externalId,
      damage: actualHeal,
    })
  }
}
