import { describe, expect, it } from 'vitest'
import type { BattleAction } from '@/domains/combat/combat.actions'
import { processSupportAuras } from '@/domains/combat/combat.auras'
import { createMeleeEngagementState } from '@/domains/combat/combat.melee-engagement'
import { hasStatus } from '@/domains/combat/combat.status'
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
