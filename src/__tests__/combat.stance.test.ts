import { describe, expect, it } from 'vitest'
import type { BattleAction } from '@/domains/combat/combat.actions'
import { simulateBattle } from '@/domains/combat/combat.engine'
import { createPathfindingMap } from '@/domains/combat/combat.pathfinding'
import { getEffectiveActionRange } from '@/domains/combat/combat.status'
import { actionSystem } from '@/domains/combat/combat.systems'
import { movementSystem } from '@/domains/combat/combat.movement'
import type { SimHazard, SimUnit, Team, UnitRow } from '@/domains/combat/combat.types'
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

describe('combat stance transforms', () => {
  it('deploys before attacking and then applies stance range and cooldown', () => {
    const artillery = makeUnit({
      id: 'artillery',
      team: 'attacker',
      stanceConfig: { mode: 'siege', deployTicks: 1, rangeMultiplier: 2, cooldownMultiplier: 0.5, speedMultiplier: 0 },
    })
    const target = makeUnit({ id: 'target', team: 'defender', x: 170, y: 0 })
    const hazards: SimHazard[] = []
    const deployActions: BattleAction[] = []

    expect(actionSystem(artillery, target, [artillery, target], hazards, deployActions, new PRNG(1))).toBe(true)
    expect(target.hp).toBe(100)
    expect(artillery.stanceMode).toBe('deployed')
    expect(getEffectiveActionRange(artillery)).toBe(240)
    expect(deployActions).toEqual([{ unitId: 'artillery', type: 'stance_change', stanceMode: 'deployed' }])

    const attackActions: BattleAction[] = []
    expect(actionSystem(artillery, target, [artillery, target], hazards, attackActions, new PRNG(1))).toBe(true)
    expect(target.hp).toBe(90)
    expect(artillery.actionCooldown).toBe(5)
    expect(attackActions.map(action => action.type)).toEqual(['attack', 'damage'])
  })

  it('undeploys when positioning requires movement', () => {
    const artillery = makeUnit({
      id: 'artillery',
      team: 'attacker',
      stanceConfig: { mode: 'siege', deployTicks: 1, rangeMultiplier: 1.5, speedMultiplier: 0 },
      stanceMode: 'deployed',
    })
    const target = makeUnit({ id: 'target', team: 'defender', x: 400, y: 0 })
    const actions: BattleAction[] = []

    movementSystem(artillery, target, [artillery, target], actions, 0.1, new PRNG(1), createPathfindingMap([]), [])

    expect(artillery.stanceMode).toBe('mobile')
    expect(actions[0]).toMatchObject({ unitId: 'artillery', type: 'stance_change', stanceMode: 'mobile' })
    expect(actions.some(action => action.type === 'move')).toBe(true)
  })

  it('maps artillery crawler config into simulation stance state', () => {
    const attackers: UnitRow[] = [{ id: 'art', colony_id: 'a', unit_type: 'artillery_crawler', hp_current: 250, grid_x: '200', grid_y: '100', tier: 1, upgrade_path: [] }]
    const defenders: UnitRow[] = [{ id: 'wall', colony_id: 'd', unit_type: 'wall', hp_current: 500, grid_x: '200', grid_y: '570', tier: 1, upgrade_path: [] }]

    const result = simulateBattle(attackers, defenders, 7, [])
    const artillery = result.initialState.find(unit => unit.id === 'art')
    const actions = result.logs.flatMap(log => log.actions)

    expect(artillery?.stanceConfig).toMatchObject({ mode: 'siege', deployTicks: 1, rangeMultiplier: 1.2 })
    expect(actions).toContainEqual(expect.objectContaining({ unitId: 'art', type: 'stance_change', stanceMode: 'deployed' }))
    expect(actions.some(action => action.unitId === 'art' && action.type === 'attack')).toBe(true)
  })
})
