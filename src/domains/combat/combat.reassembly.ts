import type { BattleAction } from './combat.actions'
import type { DelayedReassemblyConfig, SimUnit } from './combat.sim.types'

export function startReassembly(
  unit: SimUnit,
  config: DelayedReassemblyConfig,
  sourceUnitId: string,
  actions: BattleAction[]
): boolean {
  if (unit.reassemblyState) return false
  if ((unit.reassemblyTriggersUsed ?? 0) >= Math.max(1, config.maxTriggers ?? 1)) return false

  unit.reassemblyTriggersUsed = (unit.reassemblyTriggersUsed ?? 0) + 1
  unit.reassemblyState = {
    remainingTicks: Math.max(0, Math.floor(config.delayTicks)),
    hpPercent: Math.max(0.01, Math.min(1, config.hpPercent ?? 1)),
    sourceUnitId,
  }
  actions.push({ unitId: unit.id, type: 'reassembly_start', targetId: unit.id, value: unit.reassemblyState.remainingTicks })
  return true
}

export function processReassemblies(units: SimUnit[], actions: BattleAction[]): void {
  const waiting = units
    .filter(unit => unit.reassemblyState)
    .sort((a, b) => a.id.localeCompare(b.id))

  for (const unit of waiting) {
    const state = unit.reassemblyState
    if (!state) continue
    state.remainingTicks--
    if (state.remainingTicks > 0) continue

    const hp = Math.max(1, Math.floor(unit.maxHp * state.hpPercent))
    unit.hp = hp
    unit.isDead = false
    unit.actionCooldown = 0
    unit.statusEffects = []
    unit.targetMark = undefined
    unit.controlProgress = undefined
    unit.reassemblyState = undefined
    actions.push({ unitId: unit.id, type: 'reassembly_complete', targetId: unit.id, damage: hp })
  }
}

export function hasPendingReassembly(unit: SimUnit): boolean {
  return unit.reassemblyState !== undefined
}
