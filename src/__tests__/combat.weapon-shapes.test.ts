import { describe, expect, it } from 'vitest'
import type { BattleAction } from '@/domains/combat/combat.actions'
import type { SimHazard, SimUnit, Team } from '@/domains/combat/combat.types'
import { getBeamTargets, getConeTargets } from '@/domains/combat/combat.attack-geometry'
import { actionSystem } from '@/domains/combat/combat.systems'
import { hasStatus } from '@/domains/combat/combat.status'
import { PRNG } from '@/domains/combat/combat.utils'

function makeUnit(overrides: Partial<SimUnit> & { id: string; team: Team; type?: string }): SimUnit {
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

describe('combat weapon shapes', () => {
  it('selects deterministic targets inside a configured cone', () => {
    const attacker = makeUnit({ id: 'flame', team: 'attacker', type: 'flamethrower', range: 120 })
    const primary = makeUnit({ id: 'primary', team: 'defender', x: 80, y: 0 })
    const side = makeUnit({ id: 'side', team: 'defender', x: 70, y: 24 })
    const outsideAngle = makeUnit({ id: 'wide', team: 'defender', x: 55, y: 60 })
    const behind = makeUnit({ id: 'behind', team: 'defender', x: -20, y: 0 })

    expect(getConeTargets(attacker, primary, [attacker, primary, side, outsideAngle, behind]).map(unit => unit.id)).toEqual(['side'])
  })

  it('selects deterministic targets along a configured beam', () => {
    const attacker = makeUnit({ id: 'ion', team: 'attacker', type: 'ion_crawler', range: 240 })
    const primary = makeUnit({ id: 'primary', team: 'defender', x: 100, y: 0 })
    const near = makeUnit({ id: 'near', team: 'defender', x: 130, y: 12 })
    const far = makeUnit({ id: 'far', team: 'defender', x: 180, y: -10 })
    const outsideWidth = makeUnit({ id: 'wide', team: 'defender', x: 160, y: 60 })

    expect(getBeamTargets(attacker, primary, [attacker, primary, far, outsideWidth, near]).map(unit => unit.id)).toEqual(['near', 'far'])
  })

  it('applies cone damage and statuses through the combat action system', () => {
    const attacker = makeUnit({
      id: 'flame',
      team: 'attacker',
      type: 'flamethrower',
      attack: 10,
      statusOnHit: [{ type: 'burn', duration: 30, value: 2 }],
    })
    const primary = makeUnit({ id: 'primary', team: 'defender', x: 80, y: 0 })
    const side = makeUnit({ id: 'side', team: 'defender', x: 70, y: 24 })
    const actions: BattleAction[] = []
    const hazards: SimHazard[] = []

    expect(actionSystem(attacker, primary, [attacker, primary, side], hazards, actions, new PRNG(1))).toBe(true)

    expect(primary.hp).toBe(90)
    expect(side.hp).toBe(92)
    expect(hasStatus(primary, 'burn')).toBe(true)
    expect(hasStatus(side, 'burn')).toBe(true)
    expect(actions.some(action => action.type === 'cone_attack' && action.targetId === 'primary')).toBe(true)
  })

  it('applies beam damage to secondary line targets', () => {
    const attacker = makeUnit({ id: 'ion', team: 'attacker', type: 'ion_crawler', attack: 20, range: 240 })
    const primary = makeUnit({ id: 'primary', team: 'defender', x: 100, y: 0 })
    const secondary = makeUnit({ id: 'secondary', team: 'defender', x: 160, y: 10 })
    const actions: BattleAction[] = []
    const hazards: SimHazard[] = []

    expect(actionSystem(attacker, primary, [attacker, primary, secondary], hazards, actions, new PRNG(1))).toBe(true)

    expect(primary.hp).toBe(80)
    expect(secondary.hp).toBe(87)
    expect(actions.some(action => action.type === 'beam_tick' && action.targetId === 'primary')).toBe(true)
  })
})
