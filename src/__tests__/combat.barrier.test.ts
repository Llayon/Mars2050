import { describe, expect, it } from 'vitest'
import type { BattleAction } from '@/domains/combat/combat.actions'
import { createMeleeEngagementState } from '@/domains/combat/combat.melee-engagement'
import { targetingSystem } from '@/domains/combat/combat.targeting'
import { processSpawnAction } from '@/domains/combat/combat.systems.utils'
import type { SimUnit, Team } from '@/domains/combat/combat.types'
import { PRNG } from '@/domains/combat/combat.utils'
import { SpatialHash } from '@/domains/combat/spatial-hash'

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

function makeHash(units: SimUnit[]): SpatialHash {
  const hash = new SpatialHash(40)
  units.forEach(unit => hash.insert(unit))
  return hash
}

describe('combat barriers', () => {
  it('spawns shield emitter barriers as temporary wall units', () => {
    const emitter = makeUnit({
      id: 'emitter',
      team: 'attacker',
      type: 'shield_emitter',
      attackType: 'spawn',
      spawnType: 'wall',
    })
    const target = makeUnit({ id: 'target', team: 'defender', x: 100, y: 0 })
    const units = [emitter, target]
    const actions: BattleAction[] = []

    processSpawnAction(emitter, target, units, actions, new PRNG(3))
    const barrier = units.find(unit => unit.id.startsWith('spawn_'))

    expect(barrier).toMatchObject({
      team: 'attacker',
      type: 'wall',
      hp: 180,
      maxHp: 180,
      attack: 0,
      isTemporary: true,
      temporaryDuration: 70,
      speed: 0,
    })
    expect(actions[0]).toMatchObject({ unitId: 'emitter', type: 'spawn', spawnType: 'wall', spawnMaxHp: 180 })
  })

  it('lets enemies target temporary barriers as normal units', () => {
    const enemy = makeUnit({ id: 'enemy', team: 'defender', x: 0, y: 0, range: 160 })
    const barrier = makeUnit({
      id: 'barrier',
      team: 'attacker',
      type: 'wall',
      x: 80,
      y: 0,
      hp: 180,
      maxHp: 180,
      isTemporary: true,
      temporaryDuration: 70,
      speed: 0,
      size: 'L',
    })
    const marine = makeUnit({ id: 'marine', team: 'attacker', x: 200, y: 0 })
    const units = [enemy, barrier, marine]

    const target = targetingSystem(enemy, units, createMeleeEngagementState(), makeHash(units))

    expect(target?.id).toBe('barrier')
  })
})
