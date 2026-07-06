import { describe, expect, it } from 'vitest'
import type { BattleAction } from '@/domains/combat/combat.actions'
import { processPeriodicAbilities } from '@/domains/combat/combat.periodic-abilities'
import { hasStatus } from '@/domains/combat/combat.status'
import type { SimHazard, SimUnit, Team } from '@/domains/combat/combat.types'
import { PRNG } from '@/domains/combat/combat.utils'

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

describe('periodic ability scheduler', () => {
  it('respects initial delay, interval, and charges', () => {
    const source = makeUnit({
      id: 'launcher',
      team: 'attacker',
      x: 0,
      y: 0,
      periodicAbilities: [{ id: 'volley', intervalTicks: 3, initialDelayTicks: 1, chargesRemaining: 2, charges: 2, nextTick: 1, targetPolicy: 'nearest_enemy', payload: { kind: 'damage', amount: 20 } }],
    })
    const target = makeUnit({ id: 'target', team: 'defender', x: 80, y: 0 })
    const actions: BattleAction[] = []
    const hazards: SimHazard[] = []

    for (let tick = 0; tick < 8; tick++) processPeriodicAbilities(tick, { units: [source, target], hazards, actions, rng: new PRNG(1) })

    expect(target.hp).toBe(60)
    expect(actions.filter(action => action.type === 'periodic_ability').map(action => action.statusType)).toEqual(['volley', 'volley'])
  })

  it('chooses tied targets by deterministic id order', () => {
    const source = makeUnit({
      id: 'launcher',
      team: 'attacker',
      x: 0,
      y: 0,
      periodicAbilities: [{ id: 'swarm', intervalTicks: 1, chargesRemaining: 1, charges: 1, nextTick: 0, targetPolicy: 'nearest_enemy', payload: { kind: 'damage', amount: 10 } }],
    })
    const b = makeUnit({ id: 'b', team: 'defender', x: 80, y: 0 })
    const a = makeUnit({ id: 'a', team: 'defender', x: -80, y: 0 })
    const actions: BattleAction[] = []

    processPeriodicAbilities(0, { units: [source, b, a], hazards: [], actions, rng: new PRNG(2) })

    expect(a.hp).toBe(90)
    expect(b.hp).toBe(100)
    expect(actions).toContainEqual({ unitId: 'launcher', type: 'periodic_ability', targetId: 'a', statusType: 'swarm' })
  })

  it('respects min and max target range before spending charges', () => {
    const source = makeUnit({
      id: 'bomber',
      team: 'attacker',
      x: 0,
      y: 0,
      periodicAbilities: [{ id: 'dead-zone-bomb', intervalTicks: 10, chargesRemaining: 1, charges: 1, nextTick: 0, targetPolicy: 'nearest_enemy', minRange: 50, maxRange: 120, payload: { kind: 'damage', amount: 10 } }],
    })
    const tooClose = makeUnit({ id: 'close', team: 'defender', x: 30, y: 0 })
    const tooFar = makeUnit({ id: 'far', team: 'defender', x: 180, y: 0 })
    const valid = makeUnit({ id: 'valid', team: 'defender', x: 80, y: 0 })
    const actions: BattleAction[] = []

    processPeriodicAbilities(0, { units: [source, tooClose, tooFar], hazards: [], actions, rng: new PRNG(3) })

    expect(source.periodicAbilities?.[0]).toMatchObject({ chargesRemaining: 1, nextTick: 0 })
    expect(actions).toEqual([])

    processPeriodicAbilities(0, { units: [source, tooClose, tooFar, valid], hazards: [], actions, rng: new PRNG(3) })

    expect(valid.hp).toBe(90)
    expect(tooClose.hp).toBe(100)
    expect(tooFar.hp).toBe(100)
    expect(source.periodicAbilities?.[0]).toMatchObject({ chargesRemaining: 0, nextTick: 10 })
    expect(actions).toContainEqual({ unitId: 'bomber', type: 'periodic_ability', targetId: 'valid', statusType: 'dead-zone-bomb' })
  })

  it('applies current-HP percent damage payloads to every area target', () => {
    const source = makeUnit({
      id: 'ion-bomber',
      team: 'attacker',
      x: 0,
      y: 0,
      periodicAbilities: [{ id: 'ionization', intervalTicks: 1, chargesRemaining: 1, charges: 1, nextTick: 0, targetPolicy: 'nearest_enemy', payload: { kind: 'damage', amount: 5, radius: 100, percentHp: { basis: 'current', percent: 0.25 } } }],
    })
    const primary = makeUnit({ id: 'primary', team: 'defender', x: 80, y: 0, hp: 80, maxHp: 200 })
    const secondary = makeUnit({ id: 'secondary', team: 'defender', x: 110, y: 0, hp: 40, maxHp: 200 })
    const outside = makeUnit({ id: 'outside', team: 'defender', x: 250, y: 0, hp: 80, maxHp: 200 })
    const actions: BattleAction[] = []

    processPeriodicAbilities(0, { units: [source, primary, secondary, outside], hazards: [], actions, rng: new PRNG(4) })

    expect(primary.hp).toBe(55)
    expect(secondary.hp).toBe(25)
    expect(outside.hp).toBe(80)
    expect(actions).toContainEqual({ unitId: 'ion-bomber', type: 'percent_hp_damage', targetId: 'primary', value: 20 })
    expect(actions).toContainEqual({ unitId: 'ion-bomber', type: 'percent_hp_damage', targetId: 'secondary', value: 10 })
  })

  it('supports status and hazard payloads without direct attack damage', () => {
    const source = makeUnit({
      id: 'bomber',
      team: 'attacker',
      x: 0,
      y: 0,
      periodicAbilities: [
        { id: 'emp-bomb', intervalTicks: 1, chargesRemaining: 1, charges: 1, nextTick: 0, targetPolicy: 'nearest_enemy', payload: { kind: 'status', effects: [{ type: 'emp', duration: 10 }] } },
        { id: 'sticky-fire', intervalTicks: 1, chargesRemaining: 1, charges: 1, nextTick: 0, targetPolicy: 'nearest_enemy', payload: { kind: 'hazard', hazardType: 'napalm', radius: 40, duration: 20, damagePerTick: 2 } },
      ],
    })
    const target = makeUnit({ id: 'target', team: 'defender', x: 80, y: 0 })
    const actions: BattleAction[] = []
    const hazards: SimHazard[] = []

    processPeriodicAbilities(0, { units: [source, target], hazards, actions, rng: new PRNG(3) })

    expect(target.hp).toBe(100)
    expect(hasStatus(target, 'emp')).toBe(true)
    expect(hazards[0]).toMatchObject({ type: 'napalm', radius: 40, duration: 20 })
  })

  it('supports production, maintenance, and periodic target marks', () => {
    const source = makeUnit({
      id: 'factory',
      team: 'attacker',
      x: 0,
      y: 0,
      periodicAbilities: [
        { id: 'production', intervalTicks: 2, chargesRemaining: 1, charges: 1, nextTick: 0, targetPolicy: 'self', payload: { kind: 'spawn', unitType: 'marine', count: 2, cap: 2, hpPercent: 0.5, spreadRadius: 20 } },
        { id: 'maintenance', intervalTicks: 2, chargesRemaining: 1, charges: 1, nextTick: 0, targetPolicy: 'self', payload: { kind: 'heal', amount: 25, radius: 60 } },
        { id: 'air-mark', intervalTicks: 2, chargesRemaining: 1, charges: 1, nextTick: 0, targetPolicy: 'nearest_air', canTargetAir: true, payload: { kind: 'mark', mark: { duration: 10, damageMultiplier: 0.3, focusPriority: 1000 } } },
      ],
    })
    const ally = makeUnit({ id: 'ally', team: 'attacker', x: 20, y: 0, hp: 50 })
    const air = makeUnit({ id: 'air', team: 'defender', x: 80, y: 0, isFlying: true })
    const actions: BattleAction[] = []
    const units = [source, ally, air]

    processPeriodicAbilities(0, { units, hazards: [], actions, rng: new PRNG(4) })

    expect(units.filter(unit => unit.summonOwnerId === 'factory')).toHaveLength(2)
    expect(ally.hp).toBe(75)
    expect(air.targetMark).toMatchObject({ sourceUnitId: 'factory', duration: 10, damageMultiplier: 0.3, focusPriority: 1000 })
    expect(actions.filter(action => action.type === 'spawn')).toHaveLength(2)
    expect(actions).toContainEqual({ unitId: 'factory', type: 'heal', targetId: 'ally', damage: 25 })
  })
})
