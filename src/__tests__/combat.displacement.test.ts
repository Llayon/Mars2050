import { describe, expect, it } from 'vitest'
import type { BattleAction } from '@/domains/combat/combat.actions'
import { applyKnockbackOnHit, applyPullOnHit } from '@/domains/combat/combat.displacement'
import type { SimHazard, SimUnit, Team } from '@/domains/combat/combat.types'
import { actionSystem } from '@/__tests__/helpers/combat-ecs-action-harness'
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

describe('combat.displacement', () => {
  it('pulls ground enemies toward the hit center without affecting allies or flyers', () => {
    const source = makeUnit({
      id: 'gravity',
      team: 'attacker',
      type: 'gravity_manipulator',
      pullOnHit: { radius: 120, strength: 32 },
    })
    const center = makeUnit({ id: 'center', team: 'defender', x: 100, y: 100 })
    const enemy = makeUnit({ id: 'enemy', team: 'defender', x: 180, y: 100 })
    const ally = makeUnit({ id: 'ally', team: 'attacker', x: 180, y: 100 })
    const flyer = makeUnit({ id: 'flyer', team: 'defender', x: 180, y: 100, isFlying: true })
    const actions: BattleAction[] = []

    applyPullOnHit(source, center, [source, center, enemy, ally, flyer], actions)

    expect(enemy.x).toBe(148)
    expect(ally.x).toBe(180)
    expect(flyer.x).toBe(180)
    expect(actions).toEqual([{ unitId: 'enemy', type: 'move', fromX: 180, fromY: 100, toX: 148, toY: 100, facingAngle: 0 }])
  })

  it('knocks ground enemies away from the source without affecting allies or flyers', () => {
    const source = makeUnit({
      id: 'sonic',
      team: 'attacker',
      type: 'sonic_devastator',
      x: 100,
      y: 100,
      knockbackOnHit: { radius: 120, strength: 32, maxTargets: 2 },
    })
    const center = makeUnit({ id: 'center', team: 'defender', x: 160, y: 100 })
    const enemy = makeUnit({ id: 'enemy', team: 'defender', x: 180, y: 100 })
    const extra = makeUnit({ id: 'extra', team: 'defender', x: 200, y: 100 })
    const ally = makeUnit({ id: 'ally', team: 'attacker', x: 180, y: 100 })
    const flyer = makeUnit({ id: 'flyer', team: 'defender', x: 180, y: 100, isFlying: true })
    const actions: BattleAction[] = []

    applyKnockbackOnHit(source, center, [source, center, enemy, extra, ally, flyer], actions)

    expect(center.x).toBe(192)
    expect(enemy.x).toBe(212)
    expect(extra.x).toBe(200)
    expect(ally.x).toBe(180)
    expect(flyer.x).toBe(180)
    expect(actions).toEqual([
      { unitId: 'center', type: 'knockback', fromX: 160, fromY: 100, toX: 192, toY: 100, facingAngle: 0 },
      { unitId: 'enemy', type: 'knockback', fromX: 180, fromY: 100, toX: 212, toY: 100, facingAngle: 0 },
    ])
  })

  it('applies gravity pull through actionSystem after the attack resolves', () => {
    const gravity = makeUnit({
      id: 'gravity',
      team: 'attacker',
      type: 'gravity_manipulator',
      attack: 10,
      range: 300,
      attackType: 'aoe',
      aoeRadius: 120,
      pullOnHit: { radius: 120, strength: 32, maxTargets: 8 },
      x: 0,
      y: 100,
      currentAngle: 0,
      size: 'L',
    })
    const target = makeUnit({ id: 'target', team: 'defender', x: 160, y: 100 })
    const nearby = makeUnit({ id: 'nearby', team: 'defender', x: 230, y: 100 })
    const hazards: SimHazard[] = []
    const actions: BattleAction[] = []

    const acted = actionSystem(gravity, target, [gravity, target, nearby], hazards, actions, new PRNG(1))

    expect(acted).toBe(true)
    expect(nearby.x).toBe(198)
    expect(actions.map(action => action.type)).toEqual(['attack', 'damage', 'attack', 'damage', 'move'])
    expect(actions.at(-1)).toMatchObject({ unitId: 'nearby', type: 'move', fromX: 230, toX: 198 })
  })

  it('applies sonic knockback through actionSystem after the attack resolves', () => {
    const sonic = makeUnit({
      id: 'sonic',
      team: 'attacker',
      type: 'sonic_devastator',
      attack: 10,
      range: 300,
      knockbackOnHit: { radius: 120, strength: 32, maxTargets: 8 },
      x: 0,
      y: 100,
      currentAngle: 0,
      size: 'XL',
    })
    const target = makeUnit({ id: 'target', team: 'defender', x: 160, y: 100 })
    const nearby = makeUnit({ id: 'nearby', team: 'defender', x: 190, y: 100 })
    const hazards: SimHazard[] = []
    const actions: BattleAction[] = []

    const acted = actionSystem(sonic, target, [sonic, target, nearby], hazards, actions, new PRNG(1))

    expect(acted).toBe(true)
    expect(target.x).toBe(192)
    expect(nearby.x).toBe(222)
    expect(actions.map(action => action.type)).toEqual(['attack', 'damage', 'cone_attack', 'damage', 'knockback', 'knockback'])
    expect(actions.at(-2)).toMatchObject({ unitId: 'target', type: 'knockback', fromX: 160, toX: 192 })
    expect(actions.at(-1)).toMatchObject({ unitId: 'nearby', type: 'knockback', fromX: 190, toX: 222 })
  })
})
