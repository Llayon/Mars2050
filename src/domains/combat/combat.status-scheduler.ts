import type { BattleAction } from './combat.actions'
import type { DeathCause } from './combat.death'
import { applyHealing } from './combat.healing'
import type { RuntimeStatusEffect, SimUnit, StatusEffect } from './combat.sim.types'

export interface StatusTickContext {
  onUnitDeath?: (unit: SimUnit, sourceUnitId: string | undefined, cause: DeathCause) => void
}

export function tickStatuses(unit: SimUnit, actions: BattleAction[], context: StatusTickContext = {}): void {
  for (let index = unit.statusEffects.length - 1; index >= 0; index--) {
    const effect = unit.statusEffects[index]
    effect.duration--
    if (effect.tickInterval > 0) {
      effect.nextTickIn--
      if (effect.nextTickIn <= 0) {
        applyPeriodicStatusEffect(unit, effect, actions, context)
        effect.nextTickIn = effect.tickInterval
      }
    }
    if (effect.duration > 0) continue

    unit.statusEffects.splice(index, 1)
    actions.push({ unitId: unit.id, type: 'status_expire', statusType: effect.type })
  }
}

function applyPeriodicStatusEffect(unit: SimUnit, effect: RuntimeStatusEffect, actions: BattleAction[], context: StatusTickContext): void {
  if (unit.isDead) return
  if (effect.type === 'regen') {
    const heal = Math.max(1, Math.floor(effect.value ?? unit.maxHp * 0.02))
    applyHealing(effect.sourceUnitId ?? effect.type, unit, heal, actions, { statusType: effect.type, emitStatusTick: true })
    return
  }

  const damage = getPeriodicStatusDamage(unit, effect)
  if (damage <= 0) return
  unit.hp -= damage
  const sourceId = effect.sourceUnitId ?? effect.type
  actions.push({ unitId: sourceId, type: 'status_tick', targetId: unit.id, statusType: effect.type, value: damage })
  actions.push({ unitId: sourceId, type: 'damage', targetId: unit.id, damage, statusType: effect.type, damageKind: 'dot' })

  if (unit.hp <= 0 && !unit.isDead) {
    const cause = effect.type === 'burn' || effect.type === 'acid' ? effect.type : 'degeneration'
    context.onUnitDeath?.(unit, effect.sourceUnitId, cause)
  }
}

function getPeriodicStatusDamage(unit: SimUnit, effect: StatusEffect): number {
  if (effect.type === 'burn') return Math.max(1, Math.floor(effect.value ?? 3))
  if (effect.type === 'acid') return Math.max(1, Math.floor(effect.value ?? unit.maxHp * 0.02))
  if (effect.type === 'degeneration') {
    if (effect.value === undefined) return Math.max(1, Math.floor(unit.maxHp * 0.03))
    return Math.max(1, Math.floor(effect.value <= 1 ? unit.maxHp * effect.value : effect.value))
  }
  return 0
}
