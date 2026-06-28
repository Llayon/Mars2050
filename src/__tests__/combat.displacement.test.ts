import { describe, expect, it } from 'vitest'
import type { BattleAction } from '@/domains/combat/combat.actions'
import { applyPullOnHit } from '@/domains/combat/combat.displacement'
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
    expect(actions.map(action => action.type)).toEqual(['attack', 'attack', 'move'])
    expect(actions.at(-1)).toMatchObject({ unitId: 'nearby', type: 'move', fromX: 230, toX: 198 })
  })
})
