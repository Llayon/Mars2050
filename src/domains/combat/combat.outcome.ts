import type { SimHazard, SimUnit, Team } from './combat.sim.types'
import { canTargetUnit } from './combat.targeting-rules'

export type BattleWinner = Team | 'draw'

export function getTerminalBattleWinner(
  units: SimUnit[],
  hazards: SimHazard[],
  pendingAttackers: boolean,
  pendingDefenders: boolean,
): BattleWinner | null {
  const attackers = units.filter(unit => !unit.isDead && unit.team === 'attacker')
  const defenders = units.filter(unit => !unit.isDead && unit.team === 'defender')
  if (attackers.length === 0 && defenders.length === 0) return pendingAttackers || pendingDefenders ? null : 'draw'
  if (attackers.length === 0) return pendingAttackers ? null : 'defender'
  if (defenders.length === 0) return pendingDefenders ? null : 'attacker'
  if (pendingAttackers || pendingDefenders) return null
  if (hasActiveDamageHazard(hazards)) return null
  if (canTeamDealDamage(attackers, defenders) || canTeamDealDamage(defenders, attackers)) return null

  const attackerPower = getOffensivePower(attackers)
  const defenderPower = getOffensivePower(defenders)
  if (attackerPower === defenderPower) return 'draw'
  return attackerPower > defenderPower ? 'attacker' : 'defender'
}

export function getSurvivorWinner(units: SimUnit[]): BattleWinner {
  const hasAttackers = units.some(unit => !unit.isDead && unit.team === 'attacker')
  const hasDefenders = units.some(unit => !unit.isDead && unit.team === 'defender')
  if (hasAttackers === hasDefenders) return 'draw'
  return hasAttackers ? 'attacker' : 'defender'
}

function canTeamDealDamage(allies: SimUnit[], enemies: SimUnit[]): boolean {
  return allies.some(unit => {
    if (unit.attackType === 'spawn' || unit.spawnerConfig || unit.periodicAbilities?.length || unit.controlBeam) return true
    if (unit.attackType === 'heal') return false
    const hasDamage = unit.attack > 0 || unit.statusOnHit?.some(status => ['burn', 'acid', 'degeneration'].includes(status.type))
    return Boolean(hasDamage) && enemies.some(enemy => canTargetUnit(unit, enemy))
  })
}

function getOffensivePower(units: SimUnit[]): number {
  return units.reduce((total, unit) => {
    if (unit.attackType === 'heal') return total
    const healthRatio = unit.maxHp > 0 ? Math.max(0, unit.hp / unit.maxHp) : 0
    return total + unit.attack * healthRatio / Math.max(1, unit.actionCooldownMax)
  }, 0)
}

function hasActiveDamageHazard(hazards: SimHazard[]): boolean {
  return hazards.some(hazard => hazard.duration > 0 && hazard.damagePerTick > 0)
}
