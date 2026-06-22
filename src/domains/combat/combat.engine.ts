import { UNIT_TYPES, MAX_TICKS } from './combat.config'
import type { UnitRow, Team, SimUnit, BattleActionType, BattleAction, BattleTick, BattleResult } from './combat.types'
import { targetingSystem, actionSystem, tickModifiersSystem } from './combat.systems'
import { movementSystem } from './combat.movement'
import { getDistance, FIELD_WIDTH, FIELD_HEIGHT, PRNG } from './combat.utils'

/**
 * Main simulation engine. Pure function.
 */

export function simulateBattle(attackerUnits: UnitRow[], defenderUnits: UnitRow[], providedSeed?: number): BattleResult {
  const seed = providedSeed || Date.now()
  const rng = new PRNG(seed)
  const dt = 0.1
  const units: SimUnit[] = []

  const createSquad = (u: UnitRow, t: Team) => {
    const config = UNIT_TYPES[u.unit_type as keyof typeof UNIT_TYPES]
    if (!config) return
    const squadSize = config.squadSize || 1
    const spacing = config.squadSpacing || 20
    const rowSize = Math.ceil(Math.sqrt(squadSize))

    if (u.grid_x == null) u.grid_x = String(Math.floor(rng.next() * FIELD_WIDTH))
    if (u.grid_y == null) u.grid_y = String(Math.floor(rng.next() * 320) + (t === 'attacker' ? (FIELD_HEIGHT - 320) : 0))

    const cx = Number(u.grid_x)
    const cy = Number(u.grid_y)

    const squadId = squadSize > 1 ? `${u.id}_squad` : undefined
    const formation = config.formation || 'grid'

    for (let i = 0; i < squadSize; i++) {
      let ox = 0, oy = 0
      
      if (formation === 'line') {
        ox = (i - (squadSize - 1) / 2) * spacing
        oy = 0
      } else if (formation === 'wedge') {
        // Wedge: 1 in front, 2 behind, 3 behind that
        // Let's do a simple V shape
        const isLeader = i === 0
        if (isLeader) {
          ox = 0; oy = -spacing
        } else {
          const side = i % 2 === 0 ? 1 : -1
          const rank = Math.ceil(i / 2)
          ox = side * rank * spacing
          oy = rank * spacing - spacing
        }
      } else {
        // Grid
        const row = Math.floor(i / rowSize)
        const col = i % rowSize
        ox = (col - (rowSize - 1) / 2) * spacing
        oy = (row - (Math.ceil(squadSize / rowSize) - 1) / 2) * spacing
      }

      // Flip Y based on team
      oy *= (t === 'attacker' ? 1 : -1)

      units.push({
        id: squadSize > 1 ? `${u.id}_${i}` : u.id!,
        squadId,
        team: t,
        type: u.unit_type,
        hp: config.baseStats.hp,
        maxHp: config.baseStats.hp,
        attack: config.baseStats.attack,
        defense: config.baseStats.defense,
        speed: config.baseStats.speed * 15,
        range: config.baseStats.range * 40,
        attackType: config.baseStats.attackType || 'single',
        actionCooldownMax: config.baseStats.actionCooldownMax || 10,
        actionCooldown: 0,
        isFlying: config.baseStats.isFlying || false,
        canTargetAir: config.baseStats.canTargetAir || false,
        turnSpeed: config.baseStats.turnSpeed || 0.5,
        currentAngle: t === 'attacker' ? Math.PI / 2 : -Math.PI / 2,
        aoeRadius: config.baseStats.aoeRadius ? config.baseStats.aoeRadius * 40 : undefined,
        x: cx + ox,
        y: cy + oy,
        isDead: false
      })
    }
  }

  attackerUnits.forEach(u => createSquad(u, 'attacker'))
  defenderUnits.forEach(u => createSquad(u, 'defender'))

  const initialState = JSON.parse(JSON.stringify(units))

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
    const meleeTargetCounts: Record<string, number> = {};

    for (const unit of turnOrder) {
      if (unit.isDead) continue;
      
      tickModifiersSystem(unit, dt);

      const target = targetingSystem(unit, units, meleeTargetCounts);
      if (!target) continue;

      // Register slot taken if melee unit
      if (unit.range <= 60) {
         meleeTargetCounts[target.id] = (meleeTargetCounts[target.id] || 0) + 1;
      }

      const acted = actionSystem(unit, target, units, actions, rng);
      
      if (!acted) {
        movementSystem(unit, target, units, actions, dt, rng);
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
    seed,
    initialState,
    survivors: units.filter(u => !u.isDead)
  }
}
