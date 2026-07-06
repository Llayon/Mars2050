import type { BattleAction } from './combat.actions'
import type { SimUnit } from './combat.sim.types'

export function processGrowthAndCharge(tick: number, units: SimUnit[], actions: BattleAction[]): void {
  const ordered = units.filter(unit => !unit.isDead).sort((a, b) => a.id.localeCompare(b.id))
  for (const unit of ordered) {
    processStatGrowth(tick, unit, actions)
    processAttackCharge(tick, unit, actions)
  }
}

export function consumeAttackCharge(unit: SimUnit, damage: number, actions: BattleAction[], tick = 0): number {
  const charge = unit.attackCharge
  if (!charge || charge.stacks <= 0) return damage

  const multiplier = 1 + charge.attackMultPerStack * charge.stacks
  const boosted = Math.max(0, Math.floor(damage * multiplier))
  actions.push({ unitId: unit.id, type: 'attack_charge_release', value: charge.stacks, damage: boosted - damage })
  charge.stacks = 0
  charge.nextTick = tick + Math.max(1, charge.intervalTicks)
  return boosted
}

function processStatGrowth(tick: number, unit: SimUnit, actions: BattleAction[]): void {
  const growth = unit.statGrowth
  if (!growth || tick < growth.nextTick || growth.stacks >= growth.maxStacks) return

  growth.stacks++
  growth.nextTick = tick + Math.max(1, growth.intervalTicks)
  const oldMaxHp = unit.maxHp

  if (growth.attackMultPerStack) unit.attack = Math.max(1, Math.floor(unit.attack * (1 + growth.attackMultPerStack)))
  if (growth.hpMultPerStack) {
    unit.maxHp = Math.max(1, Math.floor(unit.maxHp * (1 + growth.hpMultPerStack)))
    unit.hp = Math.min(unit.maxHp, unit.hp + (unit.maxHp - oldMaxHp))
  }

  actions.push({ unitId: unit.id, type: 'stat_growth', value: growth.stacks })
}

function processAttackCharge(tick: number, unit: SimUnit, actions: BattleAction[]): void {
  const charge = unit.attackCharge
  if (!charge || tick < charge.nextTick || charge.stacks >= charge.maxStacks) return

  charge.stacks++
  charge.nextTick = tick + Math.max(1, charge.intervalTicks)
  actions.push({ unitId: unit.id, type: 'attack_charge', value: charge.stacks })
}
