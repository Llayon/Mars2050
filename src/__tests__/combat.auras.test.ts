import { describe, expect, it } from 'vitest'
import type { BattleAction } from '@/domains/combat/combat.actions'
import { processSupportAuras } from '@/domains/combat/combat.auras'
import { createMeleeEngagementState } from '@/domains/combat/combat.melee-engagement'
import { applyStatus, hasStatus } from '@/domains/combat/combat.status'
import { targetingSystem } from '@/domains/combat/combat.targeting'
import type { SimUnit, Team } from '@/domains/combat/combat.types'
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

describe('combat.auras', () => {
  it('grants shield up to aura cap without stacking past it', () => {
    const emitter = makeUnit({
      id: 'emitter',
      team: 'attacker',
      type: 'shield_emitter',
      supportAuras: [{ type: 'shield', radius: 160, value: 80, interval: 10, target: 'allies' }],
    })
    const ally = makeUnit({ id: 'ally', team: 'attacker', x: 60, y: 0, shield: 20 })
    const actions: BattleAction[] = []

    processSupportAuras(0, [emitter, ally], actions)
    processSupportAuras(10, [emitter, ally], actions)

    expect(ally.shield).toBe(80)
    expect(ally.maxShield).toBe(80)
    expect(actions).toEqual([{ unitId: 'emitter', type: 'shield_apply', targetId: 'ally', damage: 60 }])
  })

  it('repairs existing shields only for aura tag matches', () => {
    const engineer = makeUnit({
      id: 'engineer',
      team: 'attacker',
      type: 'engineer',
      supportAuras: [{ type: 'shield_repair', radius: 140, value: 25, interval: 10, target: 'allies', targetTags: ['mechanical'] }],
    })
    const tank = makeUnit({ id: 'tank', team: 'attacker', type: 'siege_tank', x: 60, y: 0, shield: 30, maxShield: 80 })
    const marine = makeUnit({ id: 'marine', team: 'attacker', type: 'marine', x: 70, y: 0, shield: 30, maxShield: 80 })
    const unshielded = makeUnit({ id: 'buggy', team: 'attacker', type: 'missile_buggy', x: 80, y: 0, shield: 0, maxShield: 0 })
    const actions: BattleAction[] = []

    processSupportAuras(0, [engineer, tank, marine, unshielded], actions)

    expect(tank.shield).toBe(55)
    expect(marine.shield).toBe(30)
    expect(unshielded.shield).toBe(0)
    expect(actions).toEqual([{ unitId: 'engineer', type: 'shield_apply', targetId: 'tank', damage: 25 }])
  })

  it('applies regen status through support aura', () => {
    const nanites = makeUnit({
      id: 'nanites',
      team: 'attacker',
      type: 'nanite_generator',
      supportAuras: [{ type: 'regen', radius: 160, value: 6, duration: 12, interval: 10, target: 'allies' }],
    })
    const ally = makeUnit({ id: 'ally', team: 'attacker', x: 60, y: 0, hp: 70 })
    const actions: BattleAction[] = []

    processSupportAuras(0, [nanites, ally], actions)

    expect(hasStatus(ally, 'regen')).toBe(true)
    expect(actions).toContainEqual({ unitId: 'ally', type: 'status_apply', statusType: 'regen', value: 6 })
  })

  it('applies haste status through command aura', () => {
    const officer = makeUnit({
      id: 'officer',
      team: 'attacker',
      type: 'officer',
      supportAuras: [{ type: 'haste', radius: 160, value: 0.18, duration: 8, interval: 8, target: 'allies' }],
    })
    const ally = makeUnit({ id: 'ally', team: 'attacker', x: 60, y: 0 })
    const enemy = makeUnit({ id: 'enemy', team: 'defender', x: 60, y: 0 })
    const actions: BattleAction[] = []

    processSupportAuras(0, [officer, ally, enemy], actions)

    expect(hasStatus(ally, 'haste')).toBe(true)
    expect(hasStatus(enemy, 'haste')).toBe(false)
    expect(actions).toEqual([{ unitId: 'ally', type: 'status_apply', statusType: 'haste', value: 0.18 }])
  })

  it('cleanses harmful statuses without removing beneficial statuses', () => {
    const engineer = makeUnit({
      id: 'engineer',
      team: 'attacker',
      type: 'engineer',
      supportAuras: [{ type: 'cleanse', radius: 160, value: 0, interval: 10, target: 'allies' }],
    })
    const ally = makeUnit({ id: 'ally', team: 'attacker', x: 60, y: 0 })
    const actions: BattleAction[] = []
    applyStatus(ally, { type: 'burn', duration: 20, sourceUnitId: 'flame' })
    applyStatus(ally, { type: 'regen', duration: 20, value: 4, sourceUnitId: 'nanites' })
    applyStatus(ally, { type: 'revealed', duration: 20, sourceUnitId: 'radar' })

    processSupportAuras(0, [engineer, ally], actions)

    expect(hasStatus(ally, 'burn')).toBe(false)
    expect(hasStatus(ally, 'revealed')).toBe(false)
    expect(hasStatus(ally, 'regen')).toBe(true)
    expect(actions).toEqual([
      { unitId: 'ally', type: 'status_cleanse', statusType: 'revealed' },
      { unitId: 'ally', type: 'status_cleanse', statusType: 'burn' },
    ])
  })

  it('applies status immunity through support aura', () => {
    const engineer = makeUnit({
      id: 'engineer',
      team: 'attacker',
      type: 'engineer',
      supportAuras: [{ type: 'status_immunity', radius: 160, value: 0, duration: 8, interval: 10, target: 'allies' }],
    })
    const ally = makeUnit({ id: 'ally', team: 'attacker', x: 60, y: 0 })
    const actions: BattleAction[] = []

    processSupportAuras(0, [engineer, ally], actions)
    applyStatus(ally, { type: 'emp', duration: 10, sourceUnitId: 'drone' }, actions)

    expect(hasStatus(ally, 'status_immunity')).toBe(true)
    expect(hasStatus(ally, 'emp')).toBe(false)
    expect(actions).toEqual([
      { unitId: 'ally', type: 'status_apply', statusType: 'status_immunity', value: undefined },
      { unitId: 'ally', type: 'status_immune', statusType: 'emp' },
    ])
  })

  it('lets radar reveal make stealth targets reachable', () => {
    const radar = makeUnit({
      id: 'radar',
      team: 'attacker',
      type: 'radar_zepplin',
      supportAuras: [{ type: 'reveal', radius: 300, value: 0, duration: 12, interval: 5, target: 'enemies' }],
    })
    const shooter = makeUnit({ id: 'shooter', team: 'attacker', x: 0, y: 0 })
    const stealth = makeUnit({
      id: 'stealth',
      team: 'defender',
      type: 'stealth_operative',
      x: 100,
      y: 0,
      stealthUntilAttack: true,
      hasAttacked: false,
    })
    const units = [radar, shooter, stealth]

    expect(targetingSystem(shooter, units, createMeleeEngagementState(), makeHash(units))).toBeNull()
    processSupportAuras(0, units, [])

    const target = targetingSystem(shooter, units, createMeleeEngagementState(), makeHash(units))

    expect(hasStatus(stealth, 'revealed')).toBe(true)
    expect(target?.id).toBe('stealth')
  })

  it('applies range boost through radar relay aura', () => {
    const radar = makeUnit({
      id: 'radar',
      team: 'attacker',
      type: 'radar_zepplin',
      supportAuras: [{ type: 'range_boost', radius: 260, value: 0.25, duration: 8, interval: 8, target: 'allies' }],
    })
    const ally = makeUnit({ id: 'ally', team: 'attacker', x: 80, y: 0 })
    const enemy = makeUnit({ id: 'enemy', team: 'defender', x: 80, y: 0 })
    const actions: BattleAction[] = []

    processSupportAuras(0, [radar, ally, enemy], actions)

    expect(hasStatus(ally, 'range_boost')).toBe(true)
    expect(hasStatus(enemy, 'range_boost')).toBe(false)
    expect(actions).toEqual([{ unitId: 'ally', type: 'status_apply', statusType: 'range_boost', value: 0.25 }])
  })

  it('uses passive aura units as support anchors instead of enemy attackers', () => {
    const emitter = makeUnit({
      id: 'emitter',
      team: 'attacker',
      type: 'shield_emitter',
      attack: 0,
      supportAuras: [{ type: 'shield', radius: 160, value: 80, interval: 10, target: 'allies' }],
    })
    const frontline = makeUnit({ id: 'frontline', team: 'attacker', x: 100, y: 0 })
    const enemy = makeUnit({ id: 'enemy', team: 'defender', x: 130, y: 0 })
    const units = [emitter, frontline, enemy]

    const target = targetingSystem(emitter, units, createMeleeEngagementState(), makeHash(units))

    expect(target?.id).toBe('frontline')
  })
})
