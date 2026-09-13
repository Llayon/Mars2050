import type { BattleAction } from '../../combat.actions.js'
import type { CombatWorld } from '../combat-world.js'
import type { EntityId } from '../entity.js'
import { applyEcsHealing } from './healing-system.js'
import { applyEcsStatus } from './status-application-system.js'

export function applyEcsOnKillEffects(
  world: CombatWorld,
  killerId: EntityId,
  victimId: EntityId,
  actions: BattleAction[],
): void {
  const killer = world.stores.identity.require(killerId)
  const victim = world.stores.identity.require(victimId)
  const effect = world.stores.runtimeRules.require(killerId).onKill
  if (!effect || killer.team === victim.team) return

  actions.push({ unitId: killer.id, type: 'on_kill', targetId: victim.id })
  if (effect.cooldownReset) world.stores.combat.require(killerId).actionCooldown = 0
  if (effect.healPercent) {
    const maxHp = world.stores.vitality.require(killerId).maxHp
    applyEcsHealing(
      world,
      killerId,
      killerId,
      Math.max(1, Math.floor(maxHp * effect.healPercent)),
      actions,
    )
  }
  if (effect.status) {
    applyEcsStatus(world, killerId, { ...effect.status, sourceUnitId: killer.id }, actions)
  }
}
