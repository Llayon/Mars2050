import type { BattleAction } from '../../combat.actions'
import type { RuntimeStatusEffect } from '../../combat.primitives'
import type { CombatWorld } from '../combat-world'
import type { EntityId } from '../entity'

export function runModifierSystem(
  world: CombatWorld,
  entityId: EntityId,
  actions: BattleAction[],
  onExpire: (entityId: EntityId) => void,
): void {
  const identity = world.stores.identity.require(entityId)
  const vitality = world.stores.vitality.require(entityId)
  const combat = world.stores.combat.require(entityId)
  const defense = world.stores.defense.require(entityId)
  const statusControl = world.stores.statusControl.require(entityId)
  const lifecycle = world.stores.lifecycle.require(entityId)
  if (!identity.id) return

  if ((combat.actionCooldown ?? 0) > 0) {
    combat.actionCooldown = Math.max(0, combat.actionCooldown! - getCooldownRecovery(statusControl.statusEffects))
  }
  if ((defense.projectileInterceptCooldown ?? 0) > 0) {
    defense.projectileInterceptCooldown = Math.max(0, defense.projectileInterceptCooldown! - 1)
  }
  if (vitality.isTemporary && vitality.temporaryDuration !== undefined && !vitality.isDead) {
    vitality.temporaryDuration--
    if (vitality.temporaryDuration <= 0) onExpire(entityId)
  }
  if (statusControl.targetMark) {
    statusControl.targetMark.duration--
    if (statusControl.targetMark.duration <= 0) {
      const sourceUnitId = statusControl.targetMark.sourceUnitId
      statusControl.targetMark = undefined
      actions.push({ unitId: sourceUnitId, type: 'target_mark_expire', targetId: identity.id })
    }
  }
  for (const trigger of lifecycle.triggerEffects ?? []) {
    if (trigger.cooldownRemaining > 0) trigger.cooldownRemaining--
  }
}

function getCooldownRecovery(statuses: RuntimeStatusEffect[] = []): number {
  let haste: number | undefined
  for (const effect of statuses) {
    if (effect.type !== 'haste' || effect.duration <= 0 || effect.value === undefined) continue
    haste = haste === undefined ? effect.value : Math.max(haste, effect.value)
  }
  if (haste === undefined) return 1
  return haste >= 1 ? haste : 1 + Math.max(0, haste)
}
