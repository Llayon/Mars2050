import { describe, expect, it } from 'vitest'
import type { BattleAction } from '@/domains/combat/combat.actions'
import { UNIT_TYPES } from '@/domains/combat/combat.config'
import { createMeleeEngagementState } from '@/domains/combat/combat.melee-engagement'
import { movementSystem } from '@/domains/combat/combat.movement'
import { createPathfindingMap } from '@/domains/combat/combat.pathfinding'
import { prepareRuntimePrimitives } from '@/domains/combat/combat.runtime-primitives'
import { applyStatus } from '@/domains/combat/combat.status'
import { actionSystem } from '@/__tests__/helpers/combat-ecs-action-harness'
import { targetingSystem } from '@/domains/combat/combat.targeting'
import type { UpgradeConfig } from '@/domains/combat/combat.upgrades'
import { UPGRADES } from '@/domains/combat/combat.upgrades'
import { getRuntimePrimitiveStats } from '@/domains/combat/combat.upgrade-primitives'
import type { SimHazard, SimUnit, Team } from '@/domains/combat/combat.types'
import { PRNG } from '@/domains/combat/combat.utils'
import { SpatialHash } from '@/domains/combat/spatial-hash'

function makeUnit(overrides: Partial<SimUnit> & { id: string; team: Team }): SimUnit {
  return {
    type: 'marine',
    hp: 100,
    maxHp: 100,
    attack: 20,
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
    turnSpeed: 100,
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

function makeHash(units: SimUnit[]): SpatialHash {
  const hash = new SpatialHash(40)
  units.forEach(unit => hash.insert(unit))
  return hash
}

function withUpgrade(id: string, upgrade: UpgradeConfig, run: () => void): void {
  UPGRADES[id] = upgrade
  try {
    run()
  } finally {
    delete UPGRADES[id]
  }
}

describe('stealth while moving', () => {
  it('prevents normal targeting while active and moving', () => {
    const shooter = makeUnit({ id: 'shooter', team: 'attacker' })
    const stealth = makeUnit({ id: 'stealth', team: 'defender', x: 80, stealthWhileMoving: true, movementStealthActive: true, isMoving: true })
    const normal = makeUnit({ id: 'normal', team: 'defender', x: 120 })
    const units = [shooter, stealth, normal]

    expect(targetingSystem(shooter, units, createMeleeEngagementState(), makeHash(units))?.id).toBe('normal')
  })

  it('lets reveal counter active movement stealth', () => {
    const shooter = makeUnit({ id: 'shooter', team: 'attacker' })
    const stealth = makeUnit({ id: 'stealth', team: 'defender', x: 80, stealthWhileMoving: true, movementStealthActive: true, isMoving: true })
    const normal = makeUnit({ id: 'normal', team: 'defender', x: 120 })
    const actions: BattleAction[] = []

    applyStatus(stealth, { type: 'revealed', duration: 5 }, actions)
    const units = [shooter, stealth, normal]

    expect(stealth.movementStealthActive).toBe(false)
    expect(actions).toContainEqual({ unitId: 'stealth', type: 'stealth_change', modeState: 'movement_inactive' })
    expect(targetingSystem(shooter, units, createMeleeEngagementState(), makeHash(units))?.id).toBe('stealth')
  })

  it('emits stealth_change only when movement state changes', () => {
    const unit = makeUnit({ id: 'runner', team: 'defender', range: 20, stealthWhileMoving: true })
    const target = makeUnit({ id: 'target', team: 'attacker', x: 400 })
    const actions: BattleAction[] = []

    movementSystem(unit, target, [unit, target], actions, 0.1, new PRNG(1), createPathfindingMap([]), [])
    movementSystem(unit, target, [unit, target], actions, 0.1, new PRNG(1), createPathfindingMap([]), [])

    expect(unit.movementStealthActive).toBe(true)
    expect(actions.filter(action => action.type === 'stealth_change')).toEqual([
      { unitId: 'runner', type: 'stealth_change', modeState: 'movement_active' },
    ])
  })

  it('breaks movement stealth when the unit attacks', () => {
    const attacker = makeUnit({ id: 'ghost', team: 'attacker', stealthWhileMoving: true, movementStealthActive: true })
    const target = makeUnit({ id: 'target', team: 'defender', x: 80 })
    const actions: BattleAction[] = []
    const hazards: SimHazard[] = []

    expect(actionSystem(attacker, target, [attacker, target], hazards, actions, new PRNG(1))).toBe(true)

    expect(attacker.hasAttacked).toBe(true)
    expect(attacker.movementStealthActive).toBe(false)
    expect(actions).toContainEqual({ unitId: 'ghost', type: 'stealth_change', modeState: 'movement_inactive' })
  })

  it('maps stealthWhileMoving upgrades into runtime primitive stats', () => {
    withUpgrade('test_movement_stealth', { id: 'test_movement_stealth', name: 'Move Stealth', description: 'test', cost: 0, allowedUnits: ['marine'], modifiers: { stealthWhileMoving: true } }, () => {
      const unit = makeUnit({ id: 'upgraded', team: 'attacker' })
      const stats = getRuntimePrimitiveStats(UNIT_TYPES.marine.baseStats, ['test_movement_stealth'])

      prepareRuntimePrimitives(unit, stats)

      expect(unit.stealthWhileMoving).toBe(true)
    })
  })
})
