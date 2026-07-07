import { describe, expect, it } from 'vitest'
import type { BattleAction } from '@/domains/combat/combat.actions'
import { UNIT_TYPES } from '@/domains/combat/combat.config'
import { prepareRuntimePrimitives } from '@/domains/combat/combat.runtime-primitives'
import { actionSystem } from '@/domains/combat/combat.systems'
import type { UpgradeConfig } from '@/domains/combat/combat.upgrades'
import { UPGRADES } from '@/domains/combat/combat.upgrades'
import { getRuntimePrimitiveStats } from '@/domains/combat/combat.upgrade-primitives'
import type { SimHazard, SimUnit, Team } from '@/domains/combat/combat.types'
import { PRNG } from '@/domains/combat/combat.utils'

function makeUnit(overrides: Partial<SimUnit> & { id: string; team: Team }): SimUnit {
  return {
    type: 'marine',
    rank: 1,
    hp: 100,
    maxHp: 100,
    attack: 20,
    defense: 0,
    speed: 10,
    range: 200,
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

function withUpgrade(id: string, upgrade: UpgradeConfig, run: () => void): void {
  UPGRADES[id] = upgrade
  try {
    run()
  } finally {
    delete UPGRADES[id]
  }
}

describe('weapon shape upgrade modifiers', () => {
  it('adds beam attack geometry through upgrade runtime stats', () => {
    withUpgrade('test_beam_shape', { id: 'test_beam_shape', name: 'Beam', description: 'test', cost: 0, allowedUnits: ['marine'], modifiers: { beamAttack: { width: 18, damageMultiplier: 0.5, maxTargets: 2 } } }, () => {
      const attacker = makeUnit({ id: 'beam', team: 'attacker' })
      const stats = getRuntimePrimitiveStats(UNIT_TYPES.marine.baseStats, ['test_beam_shape'])
      prepareRuntimePrimitives(attacker, stats)
      const primary = makeUnit({ id: 'primary', team: 'defender', x: 80 })
      const secondary = makeUnit({ id: 'secondary', team: 'defender', x: 130, y: 8 })
      const actions: BattleAction[] = []
      const hazards: SimHazard[] = []

      expect(actionSystem(attacker, primary, [attacker, primary, secondary], hazards, actions, new PRNG(1))).toBe(true)

      expect(primary.hp).toBe(80)
      expect(secondary.hp).toBe(90)
      expect(actions).toContainEqual({ unitId: 'beam', type: 'beam_tick', targetId: 'primary', radius: 200, value: 0.5 })
    })
  })

  it('adds side weapon geometry through upgrade runtime stats', () => {
    withUpgrade('test_side_weapon', { id: 'test_side_weapon', name: 'Side', description: 'test', cost: 0, allowedUnits: ['marine'], modifiers: { sideWeapon: { damage: 7, range: 4, maxTargets: 1 } } }, () => {
      const attacker = makeUnit({ id: 'side-gun', team: 'attacker' })
      const stats = getRuntimePrimitiveStats(UNIT_TYPES.marine.baseStats, ['test_side_weapon'])
      prepareRuntimePrimitives(attacker, stats)
      const primary = makeUnit({ id: 'primary', team: 'defender', x: 80 })
      const side = makeUnit({ id: 'side', team: 'defender', x: 120, y: 20 })
      const actions: BattleAction[] = []
      const hazards: SimHazard[] = []

      expect(actionSystem(attacker, primary, [attacker, primary, side], hazards, actions, new PRNG(1))).toBe(true)

      expect(primary.hp).toBe(80)
      expect(side.hp).toBe(93)
      expect(actions).toContainEqual({ unitId: 'side-gun', type: 'side_weapon_attack', targetId: 'side' })
    })
  })
})
