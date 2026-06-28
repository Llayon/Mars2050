import { describe, expect, it } from 'vitest'
import type { BattleAction } from '@/domains/combat/combat.actions'
import { getLinePierceTargets } from '@/domains/combat/combat.attack-geometry'
import type { SimHazard, SimUnit, Team } from '@/domains/combat/combat.types'
import { actionSystem } from '@/domains/combat/combat.systems'
import { PRNG } from '@/domains/combat/combat.utils'

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

describe('combat.attack-geometry', () => {
  it('finds deterministic secondary line-pierce targets between attacker and primary target', () => {
    const attacker = makeUnit({ id: 'attacker', team: 'attacker', type: 'railgun_walker' })
    const primary = makeUnit({ id: 'primary', team: 'defender', x: 160, y: 0 })
    const second = makeUnit({ id: 'second', team: 'defender', x: 70, y: -8 })
    const first = makeUnit({ id: 'first', team: 'defender', x: 70, y: 8 })
    const third = makeUnit({ id: 'third', team: 'defender', x: 110, y: 0 })
    const offLine = makeUnit({ id: 'off-line', team: 'defender', x: 80, y: 80 })
    const ally = makeUnit({ id: 'ally', team: 'attacker', x: 90, y: 0 })

    const targets = getLinePierceTargets(attacker, primary, [attacker, primary, second, first, third, offLine, ally])

    expect(targets.map(unit => unit.id)).toEqual(['first', 'second', 'third'])
  })

  it('applies line-pierce secondary damage through actionSystem', () => {
    const attacker = makeUnit({
      id: 'attacker',
      team: 'attacker',
      type: 'railgun_walker',
      attack: 120,
      range: 400,
      actionCooldownMax: 40,
      size: 'L',
      currentAngle: 0,
    })
    const primary = makeUnit({ id: 'primary', team: 'defender', hp: 200, maxHp: 200, x: 160, y: 0 })
    const secondary = makeUnit({ id: 'secondary', team: 'defender', x: 90, y: 10 })
    const offLine = makeUnit({ id: 'off-line', team: 'defender', x: 80, y: 80 })
    const actions: BattleAction[] = []
    const hazards: SimHazard[] = []

    const acted = actionSystem(attacker, primary, [attacker, primary, secondary, offLine], hazards, actions, new PRNG(1))

    expect(acted).toBe(true)
    expect(primary.hp).toBe(80)
    expect(secondary.hp).toBe(34)
    expect(offLine.hp).toBe(100)
    expect(actions.filter(action => action.type === 'attack').map(action => action.targetId)).toEqual(['primary', 'secondary'])
  })
})
