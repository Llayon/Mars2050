import { describe, expect, it } from 'vitest'
import { SpatialHash } from '@/domains/combat/spatial-hash'
import type { SimUnit } from '@/domains/combat/combat.types'

function makeUnit(id: string, x: number, y: number): SimUnit {
  return {
    id,
    team: 'attacker',
    type: 'marine',
    hp: 10,
    maxHp: 10,
    attack: 1,
    defense: 0,
    speed: 1,
    range: 1,
    attackType: 'single',
    actionCooldownMax: 1,
    actionCooldown: 0,
    isFlying: false,
    canTargetAir: false,
    x,
    y,
    aggroLockTicks: 0,
    velocity: { x: 0, y: 0 },
    isDead: false,
    turnSpeed: 1,
    currentAngle: 0,
    size: 'S',
    shield: 0,
    maxShield: 0,
    statusEffects: []
  }
}

describe('SpatialHash', () => {
  it('queries nearby units in insertion order', () => {
    const hash = new SpatialHash(40)
    const first = makeUnit('first', 10, 10)
    const second = makeUnit('second', 30, 10)
    const far = makeUnit('far', 200, 200)

    hash.insert(first)
    hash.insert(second)
    hash.insert(far)

    expect(hash.query(0, 0, 50).map(unit => unit.id)).toEqual(['first', 'second'])
  })

  it('clears indexed units', () => {
    const hash = new SpatialHash(40)
    hash.insert(makeUnit('first', 10, 10))

    hash.clear()

    expect(hash.query(10, 10, 50)).toEqual([])
  })

  it('updates moved units without leaving stale cell entries', () => {
    const hash = new SpatialHash(40)
    const unit = makeUnit('moving', 10, 10)

    hash.insert(unit)
    unit.x = 180
    unit.y = 10
    hash.update(unit)

    expect(hash.query(10, 10, 50).map(candidate => candidate.id)).toEqual([])
    expect(hash.query(180, 10, 50).map(candidate => candidate.id)).toEqual(['moving'])
  })

  it('keeps original insertion order after unit updates', () => {
    const hash = new SpatialHash(40)
    const first = makeUnit('first', 10, 10)
    const second = makeUnit('second', 20, 10)

    hash.insert(first)
    hash.insert(second)
    first.x = 30
    hash.update(first)

    expect(hash.query(20, 10, 50).map(unit => unit.id)).toEqual(['first', 'second'])
  })
})
