import { describe, expect, it } from 'vitest'
import type { BattleAction } from '@/domains/combat/combat.actions'
import { processSpawnAction } from '@/domains/combat/combat.systems.utils'
import type { SimUnit, Team } from '@/domains/combat/combat.types'
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
    x: 100,
    y: 100,
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

describe('spawn caps', () => {
  it('tags spawned units with their owner id', () => {
    const carrier = makeUnit({ id: 'carrier', team: 'attacker', type: 'drone_carrier', attackType: 'spawn', spawnType: 'scout_drone', spawnCap: 2 })
    const target = makeUnit({ id: 'target', team: 'defender', x: 160, y: 100 })
    const units = [carrier, target]
    const actions: BattleAction[] = []

    expect(processSpawnAction(carrier, target, units, actions, new PRNG(1))).toBe(true)

    expect(units).toHaveLength(3)
    expect(units[2]).toMatchObject({
      summonOwnerId: 'carrier',
      team: 'attacker',
      type: 'scout_drone',
      speed: 180,
      range: 120,
      markOnHit: { squadWide: true },
    })
    expect(actions[0]).toMatchObject({ unitId: 'carrier', type: 'spawn', targetId: units[2].id })
  })

  it('blocks spawning when active owner summons reach cap', () => {
    const carrier = makeUnit({ id: 'carrier', team: 'attacker', type: 'drone_carrier', attackType: 'spawn', spawnType: 'scout_drone', spawnCap: 1, actionCooldownMax: 60, actionCooldown: 60 })
    const existing = makeUnit({ id: 'summon', team: 'attacker', summonOwnerId: 'carrier' })
    const target = makeUnit({ id: 'target', team: 'defender', x: 160, y: 100 })
    const units = [carrier, existing, target]
    const actions: BattleAction[] = []

    expect(processSpawnAction(carrier, target, units, actions, new PRNG(1))).toBe(false)

    expect(units).toHaveLength(3)
    expect(carrier.actionCooldown).toBe(5)
    expect(actions).toEqual([{ unitId: 'carrier', type: 'spawn_blocked', value: 1 }])
  })

  it('ignores dead owner summons when checking cap', () => {
    const carrier = makeUnit({ id: 'carrier', team: 'attacker', type: 'drone_carrier', attackType: 'spawn', spawnType: 'scout_drone', spawnCap: 1 })
    const deadSummon = makeUnit({ id: 'dead-summon', team: 'attacker', summonOwnerId: 'carrier', isDead: true })
    const target = makeUnit({ id: 'target', team: 'defender', x: 160, y: 100 })
    const units = [carrier, deadSummon, target]

    expect(processSpawnAction(carrier, target, units, [], new PRNG(1))).toBe(true)
    expect(units).toHaveLength(4)
  })
})
