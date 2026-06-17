import { UNIT_TYPES } from './combat.config'
import type { UnitRow } from './combat.types'

export type Team = 'attacker' | 'defender'

export interface SimUnit {
  id: string
  team: Team
  type: string
  hp: number
  maxHp: number
  attack: number
  defense: number
  speed: number
  range: number
  x: number
  y: number
  isDead: boolean
}

export type BattleActionType = 'move' | 'attack' | 'die'

export interface BattleAction {
  unitId: string
  type: BattleActionType
  targetId?: string
  damage?: number
  fromX?: number
  fromY?: number
  toX?: number
  toY?: number
}

export interface BattleTick {
  tick: number
  actions: BattleAction[]
}

export interface BattleResult {
  winner: 'attacker' | 'defender' | 'draw'
  logs: BattleTick[]
  survivors: SimUnit[]
}

export const GRID_WIDTH = 7
export const GRID_HEIGHT = 4
export const MAX_TICKS = 100

/**
 * Calculates Manhattan distance between two points.
 */
function getDistance(x1: number, y1: number, x2: number, y2: number) {
  return Math.abs(x1 - x2) + Math.abs(y1 - y2)
}

/**
 * Main simulation engine. Pure function.
 */
export function simulateBattle(attackerUnits: UnitRow[], defenderUnits: UnitRow[]): BattleResult {
  const units: SimUnit[] = []

  // Initialize attacker units
  attackerUnits.forEach(u => {
    const config = UNIT_TYPES[u.unit_type as keyof typeof UNIT_TYPES]
    if (!config) return
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
      x: u.grid_x != null ? Number(u.grid_x) : 0,
      y: u.grid_y != null ? Number(u.grid_y) : 0,
      isDead: false
    })
  })

  // Initialize defender units
  defenderUnits.forEach(u => {
    const config = UNIT_TYPES[u.unit_type as keyof typeof UNIT_TYPES]
    if (!config) return
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
      x: u.grid_x != null ? Number(u.grid_x) : 6,
      y: u.grid_y != null ? Number(u.grid_y) : 0,
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
      if (unit.isDead) continue // Might have died earlier this tick

      // Find enemies
      const enemies = units.filter(e => !e.isDead && e.team !== unit.team)
      if (enemies.length === 0) continue

      // Find nearest enemy
      let nearestEnemy: SimUnit | null = null
      let minDistance = Infinity

      for (const enemy of enemies) {
        const dist = getDistance(unit.x, unit.y, enemy.x, enemy.y)
        if (dist < minDistance) {
          minDistance = dist
          nearestEnemy = enemy
        } else if (dist === minDistance) {
          // Tie-breaker: prioritize lower HP target
          if (nearestEnemy && enemy.hp < nearestEnemy.hp) {
            nearestEnemy = enemy
          }
        }
      }

      if (!nearestEnemy) continue

      if (minDistance <= unit.range) {
        // Attack
        let damage = Math.max(1, unit.attack - nearestEnemy.defense)
        nearestEnemy.hp -= damage
        
        actions.push({
          unitId: unit.id,
          type: 'attack',
          targetId: nearestEnemy.id,
          damage
        })

        if (nearestEnemy.hp <= 0) {
          nearestEnemy.isDead = true
          actions.push({
            unitId: nearestEnemy.id,
            type: 'die'
          })
        }
      } else {
        // Move towards nearest enemy
        let bestX = unit.x
        let bestY = unit.y
        let bestDist = minDistance

        const moves = [
          { dx: 1, dy: 0 },
          { dx: -1, dy: 0 },
          { dx: 0, dy: 1 },
          { dx: 0, dy: -1 }
        ]

        for (const move of moves) {
          const nx = unit.x + move.dx
          const ny = unit.y + move.dy
          
          // Check bounds
          if (nx < 0 || nx >= GRID_WIDTH || ny < 0 || ny >= GRID_HEIGHT) continue
          
          // Check if tile is occupied
          const occupied = units.some(u => !u.isDead && u.x === nx && u.y === ny)
          if (occupied) continue

          const dist = getDistance(nx, ny, nearestEnemy.x, nearestEnemy.y)
          if (dist < bestDist) {
            bestDist = dist
            bestX = nx
            bestY = ny
          }
        }

        if (bestX !== unit.x || bestY !== unit.y) {
          const fromX = unit.x
          const fromY = unit.y
          unit.x = bestX
          unit.y = bestY
          
          actions.push({
            unitId: unit.id,
            type: 'move',
            fromX,
            fromY,
            toX: bestX,
            toY: bestY
          })
        }
      }
    }

    if (actions.length > 0) {
      logs.push({ tick, actions })
    }
    
    tick++
  }

  // Determine winner after simulation loop
  const finalAttackers = units.filter(u => !u.isDead && u.team === 'attacker')
  const finalDefenders = units.filter(u => !u.isDead && u.team === 'defender')

  let winner: 'attacker' | 'defender' | 'draw' = 'draw'
  if (finalAttackers.length > 0 && finalDefenders.length === 0) winner = 'attacker'
  if (finalDefenders.length > 0 && finalAttackers.length === 0) winner = 'defender'
  if (finalAttackers.length > 0 && finalDefenders.length > 0) {
    // If time ran out (MAX_TICKS reached), defender wins by default (successfully defended)
    winner = 'defender'
  }

  return {
    winner,
    logs,
    survivors: units.filter(u => !u.isDead)
  }
}
