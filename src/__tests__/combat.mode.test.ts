import { describe, expect, it } from 'vitest'
import { actionSystem } from '@/__tests__/helpers/combat-ecs-action-harness'
import { movementSystem } from '@/domains/combat/combat.movement'
import { createPathfindingMap } from '@/domains/combat/combat.pathfinding'
import { simulateBattle } from '@/domains/combat/combat.engine'
import { getEffectiveCombatTags } from '@/domains/combat/combat.targeting-score'
import { canTargetUnit } from '@/domains/combat/combat.targeting-rules'
import type { BattleAction, SimHazard, SimUnit, Team, UnitRow } from '@/domains/combat/combat.types'
import { PRNG } from '@/domains/combat/combat.utils'

function makeUnit(overrides: Partial<SimUnit> & { id: string; team: Team }): SimUnit {
  return {
    type: 'jetpack_trooper',
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

describe('combat mobility mode transforms', () => {
  it('enters air mode while moving and lands before attacking', () => {
    const unit = makeUnit({
      id: 'jetpack',
      team: 'attacker',
      range: 40,
      modeSwitchConfig: { trigger: 'while_moving', startMode: 'ground', groundForAction: true, airSpeedMultiplier: 1.1 },
      mobilityMode: 'ground',
    })
    const farTarget = makeUnit({ id: 'far', team: 'defender', x: 400 })
    const moveActions: BattleAction[] = []

    movementSystem(unit, farTarget, [unit, farTarget], moveActions, 0.1, new PRNG(1), createPathfindingMap([]), [])

    expect(unit.mobilityMode).toBe('air')
    expect(unit.isFlying).toBe(true)
    expect(moveActions[0]).toEqual({ unitId: 'jetpack', type: 'mode_change', modeState: 'air' })
    expect(moveActions.some(action => action.type === 'move')).toBe(true)
    expect(canTargetUnit({ canTargetAir: false }, unit)).toBe(false)

    unit.range = 200
    unit.actionCooldown = 0
    const attackTarget = makeUnit({ id: 'target', team: 'defender', x: unit.x + 80 })
    const attackActions: BattleAction[] = []
    const hazards: SimHazard[] = []

    expect(actionSystem(unit, attackTarget, [unit, attackTarget], hazards, attackActions, new PRNG(1))).toBe(true)
    expect(unit.mobilityMode).toBe('ground')
    expect(unit.isFlying).toBe(false)
    expect(attackActions[0]).toEqual({ unitId: 'jetpack', type: 'mode_change', modeState: 'ground' })
    expect(attackActions.some(action => action.type === 'attack')).toBe(true)
    expect(canTargetUnit({ canTargetAir: false }, unit)).toBe(true)
  })

  it('uses aircraft targeting tags only while airborne', () => {
    const unit = makeUnit({
      id: 'jetpack',
      team: 'defender',
      modeSwitchConfig: { trigger: 'while_moving', startMode: 'ground' },
      mobilityMode: 'ground',
      isFlying: false,
    })

    expect(getEffectiveCombatTags(unit)).not.toContain('aircraft')

    unit.mobilityMode = 'air'
    unit.isFlying = true

    expect(getEffectiveCombatTags(unit)).toContain('aircraft')
  })

  it('maps jetpack trooper config into runtime mode state', () => {
    const attackers: UnitRow[] = [{ id: 'jetpack', colony_id: 'a', unit_type: 'jetpack_trooper', hp_current: 45, grid_x: '100', grid_y: '500', tier: 1, upgrade_path: [] }]
    const defenders: UnitRow[] = [{ id: 'wall', colony_id: 'd', unit_type: 'wall', hp_current: 500, grid_x: '100', grid_y: '100', tier: 1, upgrade_path: [] }]

    const result = simulateBattle(attackers, defenders, 41, [])
    const jetpack = result.initialState.find(unit => unit.id === 'jetpack_0')
    const actions = result.logs.flatMap(log => log.actions)

    expect(jetpack?.modeSwitchConfig).toMatchObject({ trigger: 'while_moving', startMode: 'ground' })
    expect(jetpack?.mobilityMode).toBe('ground')
    expect(jetpack?.isFlying).toBe(false)
    expect(actions).toContainEqual(expect.objectContaining({ unitId: 'jetpack_0', type: 'mode_change', modeState: 'air' }))
    expect(actions).toContainEqual(expect.objectContaining({ unitId: 'jetpack_0', type: 'mode_change', modeState: 'ground' }))
  })
})
