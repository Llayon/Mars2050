import { describe, expect, it } from 'vitest'
import type { BattleAction } from '@/domains/combat/combat.actions'
import { processControlBeams } from '@/domains/combat/combat.control'
import { cleanseStatuses } from '@/domains/combat/combat.status'
import type { SimUnit, Team } from '@/domains/combat/combat.types'

function makeUnit(overrides: Partial<SimUnit> & { id: string; team: Team; x: number; y: number }): SimUnit {
  return {
    type: 'marine',
    hp: 100,
    maxHp: 100,
    attack: 10,
    defense: 0,
    speed: 10,
    range: 120,
    attackType: 'single',
    actionCooldownMax: 10,
    actionCooldown: 0,
    isFlying: false,
    canTargetAir: false,
    isDead: false,
    turnSpeed: 1,
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

describe('control conversion primitive', () => {
  it('lets zero-attack control units convert enemies and heal converted units to max HP', () => {
    const hacker = makeUnit({
      id: 'hacker',
      team: 'attacker',
      x: 0,
      y: 0,
      attack: 0,
      controlBeam: { range: 160, progressPerTick: 15, conversionThreshold: 30, healConvertedToMax: true },
    })
    const target = makeUnit({ id: 'target', team: 'defender', x: 80, y: 0, hp: 40 })
    const actions: BattleAction[] = []

    processControlBeams([hacker, target], actions)
    processControlBeams([hacker, target], actions)

    expect(target.team).toBe('attacker')
    expect(target.hp).toBe(100)
    expect(target.controlProgress).toBeUndefined()
    expect(actions.map(action => action.type)).toEqual(['control_link', 'control_progress', 'control_progress', 'control_convert', 'heal'])
  })

  it('breaks conversion progress through declared cleanse counters', () => {
    const hacker = makeUnit({
      id: 'hacker',
      team: 'attacker',
      x: 0,
      y: 0,
      attack: 0,
      controlBeam: { range: 160, progressPerTick: 10, conversionThreshold: 30, breakOnCleanse: true },
    })
    const target = makeUnit({ id: 'target', team: 'defender', x: 80, y: 0 })
    const actions: BattleAction[] = []

    processControlBeams([hacker, target], actions)
    cleanseStatuses(target, undefined, actions)

    expect(target.team).toBe('defender')
    expect(target.controlProgress).toBeUndefined()
    expect(actions).toContainEqual({ unitId: 'hacker', type: 'control_break', targetId: 'target', value: 10 })
  })

  it('applies multi-control progress multipliers per target deterministically', () => {
    const hacker = makeUnit({
      id: 'hacker',
      team: 'attacker',
      x: 0,
      y: 0,
      attack: 0,
      controlBeam: { range: 160, progressPerTick: 10, conversionThreshold: 30, maxTargets: 2, multiTargetProgressMultiplier: 0.5 },
    })
    const a = makeUnit({ id: 'a', team: 'defender', x: 80, y: 0 })
    const b = makeUnit({ id: 'b', team: 'defender', x: 100, y: 0 })
    const actions: BattleAction[] = []

    processControlBeams([hacker, b, a], actions)

    expect(a.controlProgress?.progress).toBe(5)
    expect(b.controlProgress?.progress).toBe(5)
    expect(actions.filter(action => action.type === 'control_link').map(action => action.targetId)).toEqual(['a', 'b'])
  })
})
