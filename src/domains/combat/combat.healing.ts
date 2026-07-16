import type { BattleAction } from './combat.actions'
import type { SimUnit } from './combat.sim.types'

export interface HealingOptions {
  statusType?: string
  emitStatusTick?: boolean
}

export function applyHealing(
  sourceId: string,
  target: SimUnit,
  requestedAmount: number,
  actions?: BattleAction[],
  options: HealingOptions = {},
): number {
  if (target.isDead || requestedAmount <= 0) return 0
  const before = Math.max(0, Math.min(target.maxHp, target.hp))
  target.hp = Math.min(target.maxHp, before + Math.max(0, Math.floor(requestedAmount)))
  const actualHeal = target.hp - before
  if (actualHeal <= 0) return 0

  const action: BattleAction = { unitId: sourceId, type: 'heal', targetId: target.id, damage: actualHeal }
  if (options.statusType) action.statusType = options.statusType
  actions?.push(action)
  if (options.emitStatusTick) {
    actions?.push({ unitId: sourceId, type: 'status_tick', targetId: target.id, statusType: options.statusType, value: actualHeal })
  }
  return actualHeal
}
