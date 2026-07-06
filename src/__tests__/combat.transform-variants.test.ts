import { describe, expect, it } from 'vitest'
import type { BattleAction } from '@/domains/combat/combat.actions'
import { processTransformModes } from '@/domains/combat/combat.transform'
import type { SimUnit, Team } from '@/domains/combat/combat.types'

function makeUnit(overrides: Partial<SimUnit> & { id: string; team: Team }): SimUnit {
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
    x: 100,
    y: 500,
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

describe('transform mode variants', () => {
  it('applies assault mode as a one-time role swap', () => {
    const unit = makeUnit({
      id: 'assault',
      team: 'attacker',
      transformMode: [{ id: 'assault-mode', mode: 'assault', trigger: 'battle_start', hpMult: 1.2, attackMult: 1.5, speedMult: 1.1, rangeMult: 0.5, aoeRadiusAdd: 30 }],
      transformState: { appliedIds: [] },
    })
    const actions: BattleAction[] = []

    processTransformModes(0, [unit], actions)
    processTransformModes(1, [unit], actions)

    expect(unit.maxHp).toBe(120)
    expect(unit.attack).toBe(15)
    expect(unit.speed).toBe(11)
    expect(unit.range).toBe(60)
    expect(unit.attackType).toBe('aoe')
    expect(actions.filter(action => action.type === 'transform_mode')).toHaveLength(1)
  })

  it('supports aerial and land mode targetability swaps', () => {
    const flyer = makeUnit({
      id: 'flyer',
      team: 'attacker',
      transformMode: [{ id: 'aerial', mode: 'aerial', trigger: 'battle_start', isFlying: true, canTargetAir: true }],
      transformState: { appliedIds: [] },
    })
    const lander = makeUnit({
      id: 'lander',
      team: 'defender',
      isFlying: true,
      canTargetAir: true,
      transformMode: [{ id: 'land', mode: 'land', trigger: 'battle_start', isFlying: false, canTargetAir: false }],
      transformState: { appliedIds: [] },
    })

    processTransformModes(0, [flyer, lander], [])

    expect(flyer.isFlying).toBe(true)
    expect(flyer.canTargetAir).toBe(true)
    expect(lander.isFlying).toBe(false)
    expect(lander.canTargetAir).toBe(false)
  })

  it('supports entrenched and jump primitives', () => {
    const entrenched = makeUnit({
      id: 'entrenched',
      team: 'attacker',
      transformMode: [{ id: 'entrench', mode: 'entrenched', trigger: 'hp_threshold', hpThreshold: 0.8, speedMult: 0, rangeMult: 1.5, cooldownMult: 0.5 }],
      transformState: { appliedIds: [] },
      hp: 70,
    })
    const jumper = makeUnit({
      id: 'jumper',
      team: 'attacker',
      y: 500,
      transformMode: [{ id: 'jump', mode: 'jump', trigger: 'battle_start', jumpDistance: 120 }],
      transformState: { appliedIds: [] },
    })

    processTransformModes(0, [entrenched, jumper], [])

    expect(entrenched.speed).toBe(0)
    expect(entrenched.range).toBe(180)
    expect(entrenched.actionCooldownMax).toBe(5)
    expect(jumper.y).toBe(380)
  })
})
