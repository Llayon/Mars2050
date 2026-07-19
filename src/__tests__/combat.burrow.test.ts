import { describe, expect, it } from 'vitest'
import { applyCombatDamage } from '@/domains/combat/combat.damage'
import { processBurrowRegeneration } from '@/domains/combat/combat.burrow'
import { simulateBattle } from '@/domains/combat/combat.engine'
import { movementSystem } from '@/domains/combat/combat.movement'
import { createPathfindingMap } from '@/domains/combat/combat.pathfinding'
import { actionSystem } from '@/__tests__/helpers/combat-ecs-action-harness'
import { applyStatus } from '@/domains/combat/combat.status'
import type { BattleAction, SimHazard, SimUnit, Team, UnitRow } from '@/domains/combat/combat.types'
import { PRNG } from '@/domains/combat/combat.utils'

function makeUnit(overrides: Partial<SimUnit> & { id: string; team: Team }): SimUnit {
  return {
    type: 'marine',
    hp: 100,
    maxHp: 100,
    attack: 10,
    defense: 0,
    speed: 100,
    range: 120,
    attackType: 'single',
    actionCooldownMax: 10,
    actionCooldown: 0,
    isFlying: false,
    canTargetAir: false,
    x: 0,
    y: 0,
    isDead: false,
    turnSpeed: 10,
    currentAngle: 0,
    size: 'S',
    shield: 0,
    maxShield: 0,
    statusEffects: [],
    aggroLockTicks: 0,
    velocity: { x: 0, y: 0 },
    ...overrides,
  }
}

describe('combat burrow movement state', () => {
  it('enters burrow while moving and exits before attacking', () => {
    const unit = makeUnit({ id: 'burrower', team: 'attacker', burrowConfig: { damageReduction: 0.45 }, range: 40 })
    const farTarget = makeUnit({ id: 'far', team: 'defender', x: 400 })
    const moveActions: BattleAction[] = []

    movementSystem(unit, farTarget, [unit, farTarget], moveActions, 0.1, new PRNG(1), createPathfindingMap([]), [])

    expect(unit.isBurrowed).toBe(true)
    expect(moveActions[0]).toEqual({ unitId: 'burrower', type: 'burrow_change', value: 1 })
    expect(moveActions.some(action => action.type === 'move')).toBe(true)

    unit.range = 200
    unit.actionCooldown = 0
    const attackTarget = makeUnit({ id: 'target', team: 'defender', x: unit.x + 80 })
    const attackActions: BattleAction[] = []
    const hazards: SimHazard[] = []

    expect(actionSystem(unit, attackTarget, [unit, attackTarget], hazards, attackActions, new PRNG(1))).toBe(true)
    expect(unit.isBurrowed).toBe(false)
    expect(attackActions[0]).toEqual({ unitId: 'burrower', type: 'burrow_change', value: 0 })
    expect(attackActions.some(action => action.type === 'attack')).toBe(true)
  })

  it('reduces incoming damage only while burrowed', () => {
    const attacker = makeUnit({ id: 'attacker', team: 'attacker', attack: 100 })
    const target = makeUnit({ id: 'target', team: 'defender', isBurrowed: true, burrowConfig: { damageReduction: 0.45 } })

    const result = applyCombatDamage(attacker, target, attacker.attack)

    expect(result.damage).toBe(55)
    expect(target.hp).toBe(45)
  })

  it('regenerates underground and prepares one-shot emerge strike', () => {
    const unit = makeUnit({ id: 'worm', team: 'attacker', hp: 50, isBurrowed: true, burrowConfig: { damageReduction: 0.45, regenPercentPerTick: 0.1, emergeAttackMult: 1.3, emergeAoeRadiusAdd: 20 } })
    const target = makeUnit({ id: 'target', team: 'defender', x: 60, hp: 100 })
    const actions: BattleAction[] = []

    processBurrowRegeneration([unit], actions)
    expect(unit.hp).toBe(60)

    expect(actionSystem(unit, target, [unit, target], [], actions, new PRNG(2))).toBe(true)

    expect(unit.emergeStrikePending).toBeUndefined()
    expect(target.hp).toBe(87)
    expect(actions).toContainEqual({ unitId: 'worm', type: 'burrow_regen', targetId: 'worm', damage: 10 })
    expect(actions).toContainEqual({ unitId: 'worm', type: 'emerge_strike', value: 1.3 })
  })

  it('reveal forces burrowed units to surface and removes burrow mitigation', () => {
    const attacker = makeUnit({ id: 'attacker', team: 'attacker', attack: 100 })
    const target = makeUnit({ id: 'target', team: 'defender', isBurrowed: true, burrowConfig: { damageReduction: 0.45 } })
    const actions: BattleAction[] = []

    applyStatus(target, { type: 'revealed', duration: 5 }, actions)
    const result = applyCombatDamage(attacker, target, attacker.attack)

    expect(target.isBurrowed).toBe(false)
    expect(result.damage).toBe(100)
    expect(actions).toEqual([
      { unitId: 'target', type: 'status_apply', statusType: 'revealed', value: undefined },
      { unitId: 'target', type: 'burrow_change', value: 0 },
    ])
  })

  it('does not enter burrow while reveal is active', () => {
    const unit = makeUnit({ id: 'burrower', team: 'attacker', burrowConfig: { damageReduction: 0.45 }, range: 40 })
    const farTarget = makeUnit({ id: 'far', team: 'defender', x: 400 })
    const actions: BattleAction[] = []
    applyStatus(unit, { type: 'revealed', duration: 5 })

    movementSystem(unit, farTarget, [unit, farTarget], actions, 0.1, new PRNG(1), createPathfindingMap([]), [])

    expect(unit.isBurrowed).not.toBe(true)
    expect(actions.some(action => action.type === 'burrow_change')).toBe(false)
    expect(actions.some(action => action.type === 'move')).toBe(true)
  })

  it('maps subterranean blitz into runtime burrow config', () => {
    const attackers: UnitRow[] = [{ id: 'shock', colony_id: 'a', unit_type: 'shock_trooper', hp_current: 45, grid_x: '100', grid_y: '500', tier: 1, upgrade_path: ['subterranean_blitz'] }]
    const defenders: UnitRow[] = [{ id: 'wall', colony_id: 'd', unit_type: 'wall', hp_current: 500, grid_x: '100', grid_y: '100', tier: 1, upgrade_path: [] }]

    const result = simulateBattle(attackers, defenders, 37, [])
    const shock = result.initialState.find(unit => unit.id === 'shock_0')
    const actions = result.logs.flatMap(log => log.actions)

    expect(shock?.burrowConfig).toEqual({ damageReduction: 0.45 })
    expect(shock?.speed).toBe(180)
    expect(actions).toContainEqual(expect.objectContaining({ unitId: 'shock_0', type: 'burrow_change', value: 1 }))
  })
})
