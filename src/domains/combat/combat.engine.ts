import { UNIT_TYPES, GRID_WIDTH, GRID_HEIGHT, MAX_TICKS } from './combat.config'
import type { UnitRow, Team, SimUnit, BattleActionType, BattleAction, BattleTick, BattleResult } from './combat.types'
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
      if (unit.isDead) continue // Might have died earlier this tick

      let target: SimUnit | null = null
      let minDistance = Infinity

      // 1. Find Target based on attackType
      if (unit.attackType === 'heal') {
        let allies = units.filter(a => !a.isDead && a.team === unit.team && a.hp < a.maxHp && a.id !== unit.id)
        if (allies.length === 0) {
          // If no one needs healing, follow any living ally to stay in formation
          allies = units.filter(a => !a.isDead && a.team === unit.team && a.id !== unit.id)
        }
        if (allies.length > 0) {
           for (const ally of allies) {
             const dist = getDistance(unit.x, unit.y, ally.x, ally.y)
             if (dist < minDistance) { minDistance = dist; target = ally }
           }
        }
      } else {
        const enemies = units.filter(e => !e.isDead && e.team !== unit.team)
        if (enemies.length === 0) continue
        for (const enemy of enemies) {
          const dist = getDistance(unit.x, unit.y, enemy.x, enemy.y)
          if (dist < minDistance) {
            minDistance = dist
            target = enemy
          } else if (dist === minDistance && target && enemy.hp < target.hp) {
            target = enemy // Prioritize lower HP
          }
        }
      }

      if (!target) continue

      // 2. Perform Action (Attack/Heal or Move)
      const canAct = (unit.attackType !== 'heal' && minDistance <= unit.range) || 
                     (unit.attackType === 'heal' && target.hp < target.maxHp && minDistance <= unit.range)

      if (canAct) {
        if (unit.attackType === 'heal') {
           const healAmount = unit.attack
           target.hp = Math.min(target.maxHp, target.hp + healAmount)
           actions.push({
             unitId: unit.id,
             type: 'heal',
             targetId: target.id,
             damage: healAmount // Replay modal will show this as positive/green if type === 'heal'
           })
        } else {
           // Standard Attack
           let damage = Math.max(1, unit.attack - target.defense)
           target.hp -= damage
           actions.push({
             unitId: unit.id,
             type: 'attack',
             targetId: target.id,
             damage
           })

           if (target.hp <= 0) {
             target.isDead = true
             actions.push({ unitId: target.id, type: 'die' })
           }

           // AoE Damage
           if (unit.attackType === 'aoe' && unit.aoeRadius) {
             const radius = unit.aoeRadius
             const splashEnemies = units.filter(e => !e.isDead && e.team !== unit.team && e.id !== target!.id)
             for (const e of splashEnemies) {
                if (getDistance(target!.x, target!.y, e.x, e.y) <= radius) {
                   const splash = Math.max(1, Math.floor(unit.attack * 0.5) - e.defense)
                   e.hp -= splash
                   actions.push({
                     unitId: unit.id,
                     type: 'attack',
                     targetId: e.id,
                     damage: splash
                   })
                   if (e.hp <= 0) {
                     e.isDead = true
                     actions.push({ unitId: e.id, type: 'die' })
                   }
                }
             }
           }
        }
      } else if (unit.speed > 0) {
        // Accumulate movement points based on speed
        unit.moveTimer = (unit.moveTimer || 0) + unit.speed
        if (unit.moveTimer >= 10) {
          unit.moveTimer -= 10
          
          // Move towards target
          let bestX = unit.x
          let bestY = unit.y
          let bestDist = minDistance

        const moves = [
          { dx: 1, dy: 0 },
          { dx: -1, dy: 0 },
          { dx: 0, dy: 1 },
          { dx: 0, dy: -1 },
          { dx: 1, dy: 1 },
          { dx: 1, dy: -1 },
          { dx: -1, dy: 1 },
          { dx: -1, dy: -1 }
        ]

        for (const move of moves) {
          const nx = unit.x + move.dx
          const ny = unit.y + move.dy
          
          // Check bounds
          if (nx < 0 || nx >= GRID_WIDTH || ny < 0 || ny >= GRID_HEIGHT) continue
          
          // Check if tile is occupied
          const occupied = units.some(u => !u.isDead && u.x === nx && u.y === ny)
          if (occupied) continue

          const dist = getDistance(nx, ny, target.x, target.y)
          if (dist < bestDist) {
            bestDist = dist
            bestX = nx
            bestY = ny
          }
        }

        if (bestX !== unit.x || bestY !== unit.y) {
          const fromX = unit.x, fromY = unit.y
          unit.x = bestX; unit.y = bestY
          actions.push({ unitId: unit.id, type: 'move', fromX, fromY, toX: bestX, toY: bestY })
        }
        }
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
