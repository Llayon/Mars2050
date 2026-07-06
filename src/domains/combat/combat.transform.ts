import type { BattleAction } from './combat.actions'
import type { SimUnit, TransformModeConfig } from './combat.sim.types'
import { FIELD_HEIGHT } from './combat.utils'

export function processTransformModes(tick: number, units: SimUnit[], actions: BattleAction[]): void {
  const ordered = units.filter(unit => !unit.isDead && unit.transformMode).sort((a, b) => a.id.localeCompare(b.id))
  for (const unit of ordered) {
    for (const mode of unit.transformMode ?? []) {
      if (hasAppliedMode(unit, mode.id)) continue
      if (mode.trigger === 'battle_start' && tick === 0) applyTransformMode(unit, mode, actions)
      if (mode.trigger === 'hp_threshold' && isHpThresholdMet(unit, mode)) applyTransformMode(unit, mode, actions)
    }
  }
}

function hasAppliedMode(unit: SimUnit, id: string): boolean {
  return unit.transformState?.appliedIds.includes(id) ?? false
}

function isHpThresholdMet(unit: SimUnit, mode: TransformModeConfig): boolean {
  const threshold = mode.hpThreshold ?? 0
  const value = threshold <= 1 ? unit.hp / unit.maxHp : unit.hp
  return value <= threshold
}

function applyTransformMode(unit: SimUnit, mode: TransformModeConfig, actions: BattleAction[]): void {
  unit.transformState ??= { appliedIds: [] }
  unit.transformState.appliedIds.push(mode.id)

  if (mode.hpMult !== undefined && mode.hpMult > 0) {
    const oldMax = unit.maxHp
    unit.maxHp = Math.max(1, Math.floor(unit.maxHp * mode.hpMult))
    unit.hp = Math.max(1, Math.floor(unit.hp * (unit.maxHp / oldMax)))
  }
  if (mode.attackMult !== undefined && mode.attackMult > 0) unit.attack = Math.max(0, Math.floor(unit.attack * mode.attackMult))
  if (mode.speedMult !== undefined && mode.speedMult >= 0) unit.speed *= mode.speedMult
  if (mode.rangeMult !== undefined && mode.rangeMult > 0) unit.range *= mode.rangeMult
  if (mode.cooldownMult !== undefined && mode.cooldownMult > 0) unit.actionCooldownMax = Math.max(1, Math.round(unit.actionCooldownMax * mode.cooldownMult))
  if (mode.aoeRadiusAdd !== undefined && mode.aoeRadiusAdd > 0) {
    unit.attackType = 'aoe'
    unit.aoeRadius = (unit.aoeRadius ?? 0) + mode.aoeRadiusAdd
  }
  if (mode.isFlying !== undefined) unit.isFlying = mode.isFlying
  if (mode.canTargetAir !== undefined) unit.canTargetAir = mode.canTargetAir
  if (mode.mode === 'jump' && mode.jumpDistance) {
    const direction = unit.team === 'attacker' ? -1 : 1
    unit.y = Math.max(0, Math.min(FIELD_HEIGHT, unit.y + direction * mode.jumpDistance))
  }

  actions.push({ unitId: unit.id, type: 'transform_mode', modeState: mode.mode, value: unit.hp })
}
