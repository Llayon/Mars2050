import type { BattleAction } from '../../combat.actions'
import type { CombatWorld } from '../combat-world'

export function runEcsReassemblySystem(
  world: CombatWorld,
  actions: BattleAction[],
): void {
  const waiting = world.query(['identity', 'vitality'], true)
    .filter(entityId => world.stores.vitality.require(entityId).reassemblyState)
    .sort((left, right) =>
      world.stores.identity.require(left).id.localeCompare(
        world.stores.identity.require(right).id,
      ),
    )

  for (const entityId of waiting) {
    const vitality = world.stores.vitality.require(entityId)
    const state = vitality.reassemblyState
    if (!state) continue
    state.remainingTicks--
    if (state.remainingTicks > 0) continue

    const hp = Math.max(1, Math.floor(vitality.maxHp * state.hpPercent))
    const identity = world.stores.identity.require(entityId)
    const combat = world.stores.combat.require(entityId)
    const status = world.stores.statusControl.require(entityId)
    const targeting = world.stores.targeting.require(entityId)
    vitality.hp = hp
    vitality.isDead = false
    vitality.reassemblyState = undefined
    combat.actionCooldown = 0
    status.statusEffects = []
    status.targetMark = undefined
    targeting.controlProgress = undefined
    actions.push({
      unitId: identity.id,
      type: 'reassembly_complete',
      targetId: identity.id,
      damage: hp,
    })
  }
}
