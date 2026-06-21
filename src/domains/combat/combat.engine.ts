import { UNIT_TYPES, GRID_WIDTH, GRID_HEIGHT, MAX_TICKS } from './combat.config'
import type { UnitRow, Team, SimUnit, BattleActionType, BattleAction, BattleTick, BattleResult } from './combat.types'
import { targetingSystem, actionSystem, movementSystem, tickModifiersSystem } from './combat.systems'
import { getDistance } from './combat.utils'

/**
 * Main simulation engine. Pure function.
 */

export function simulateBattle(attackerUnits: UnitRow[], defenderUnits: UnitRow[]): BattleResult {
  const units: SimUnit[] = []

  // Initialize attacker units
  attackerUnits.forEach(u => {
    const config = UNIT_TYPES[u.unit_type as keyof typeof UNIT_TYPES]
    if (!config) return
    if (u.grid_x == null) u.grid_x = String(Math.floor(Math.random() * GRID_WIDTH))
    if (u.grid_y == null) u.grid_y = String(Math.floor(Math.random() * 8) + (GRID_HEIGHT - 8))
    
    units.push({
      id: u.id!,
      team: 'attacker',
      type: u.unit_type,
      hp: u.hp_current,
      maxHp: config.baseStats.hp,
      attack: config.baseStats.attack,
      defense: config.baseStats.defense,
      speed: config.baseStats.speed,
      range: config.baseStats.range,
      attackType: config.baseStats.attackType || 'single',
      actionCooldownMax: config.baseStats.actionCooldownMax || 10,
      actionCooldown: 0,
      aoeRadius: config.baseStats.aoeRadius,
      x: Number(u.grid_x),
      y: Number(u.grid_y),
      isDead: false
    })
  })

  // Initialize defender units
  defenderUnits.forEach(u => {
    const config = UNIT_TYPES[u.unit_type as keyof typeof UNIT_TYPES]
    if (!config) return
    if (u.grid_x == null) u.grid_x = String(Math.floor(Math.random() * GRID_WIDTH))
    if (u.grid_y == null) u.grid_y = String(Math.floor(Math.random() * 8))
    
    units.push({
      id: u.id!,
      team: 'defender',
      type: u.unit_type,
      hp: u.hp_current,
      maxHp: config.baseStats.hp,
      attack: config.baseStats.attack,
      defense: config.baseStats.defense,
      speed: config.baseStats.speed,
      range: config.baseStats.range,
      attackType: config.baseStats.attackType || 'single',
      actionCooldownMax: config.baseStats.actionCooldownMax || 10,
      actionCooldown: 0,
      aoeRadius: config.baseStats.aoeRadius,
      x: Number(u.grid_x),
      y: Number(u.grid_y),
      isDead: false
    })
  })

  const logs: BattleTick[] = []
  let tick = 0

  while (tick < MAX_TICKS) {
    const actions: BattleAction[] = []
    
    // Check win condition before tick
    const aliveAttackers = units.filter(u => !u.isDead && u.team === 'attacker')
    const aliveDefenders = units.filter(u => !u.isDead && u.team === 'defender')
    
    if (aliveAttackers.length === 0 && aliveDefenders.length === 0) break // Draw
    if (aliveAttackers.length === 0) break // Defender wins
    if (aliveDefenders.length === 0) break // Attacker wins

    // Sort units by speed descending
    const turnOrder = units.filter(u => !u.isDead).sort((a, b) => b.speed - a.speed)

    for (const unit of turnOrder) {
      if (unit.isDead) continue;
      
      tickModifiersSystem(unit);

      const target = targetingSystem(unit, units);
      if (!target) continue;

      const acted = actionSystem(unit, target, units, actions);
      
      if (!acted) {
        movementSystem(unit, target, units, actions);
      }
    }

    if (actions.length > 0) logs.push({ tick, actions })
    
    tick++
  }

  // Determine winner after simulation loop
  const finalAttackers = units.filter(u => !u.isDead && u.team === 'attacker')
  const finalDefenders = units.filter(u => !u.isDead && u.team === 'defender')

  let winner: 'attacker' | 'defender' | 'draw' = 'draw'
  if (finalAttackers.length > 0 && finalDefenders.length === 0) winner = 'attacker'
  if (finalDefenders.length > 0 && finalAttackers.length === 0) winner = 'defender'
  if (finalAttackers.length > 0 && finalDefenders.length > 0) {
    // If time ran out, defender wins by default
    winner = 'defender'
  }

  return {
    winner,
    logs,
    survivors: units.filter(u => !u.isDead)
  }
}
