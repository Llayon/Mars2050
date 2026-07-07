import type { BattleAction } from './combat.actions'
import type { SimUnit } from './combat.sim.types'

export function isEnemyVisible(target: SimUnit): boolean {
  return !isStealthUntilAttackActive(target) && !isMovementStealthActive(target)
}

export function syncMovementStealth(unit: SimUnit, shouldMove: boolean, actions: BattleAction[]): void {
  if (!unit.stealthWhileMoving) return

  const active = shouldMove && !unit.hasAttacked && !isRevealed(unit)
  if ((unit.movementStealthActive ?? false) === active) return

  unit.movementStealthActive = active
  actions.push({ unitId: unit.id, type: 'stealth_change', modeState: active ? 'movement_active' : 'movement_inactive' })
}

export function breakMovementStealthOnReveal(unit: SimUnit, actions?: BattleAction[]): void {
  breakMovementStealth(unit, actions)
}

export function breakMovementStealthOnAttack(unit: SimUnit, actions: BattleAction[]): void {
  breakMovementStealth(unit, actions)
}

function isStealthUntilAttackActive(unit: SimUnit): boolean {
  return unit.stealthUntilAttack === true && !unit.hasAttacked && !isRevealed(unit)
}

function isMovementStealthActive(unit: SimUnit): boolean {
  return unit.stealthWhileMoving === true && unit.movementStealthActive === true && !unit.hasAttacked && !isRevealed(unit)
}

function breakMovementStealth(unit: SimUnit, actions?: BattleAction[]): void {
  if (!unit.movementStealthActive) return

  unit.movementStealthActive = false
  actions?.push({ unitId: unit.id, type: 'stealth_change', modeState: 'movement_inactive' })
}

function isRevealed(unit: SimUnit): boolean {
  return unit.statusEffects.some(effect => effect.type === 'revealed' && effect.duration > 0)
}
