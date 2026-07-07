import { describe, expect, it } from 'vitest'
import type { BattleAction } from '@/domains/combat/combat.actions'
import { UNIT_TYPES } from '@/domains/combat/combat.config'
import { prepareRuntimePrimitives } from '@/domains/combat/combat.runtime-primitives'
import { handleDeath } from '@/domains/combat/combat.systems.utils'
import type { UpgradeConfig } from '@/domains/combat/combat.upgrades'
import { UPGRADES } from '@/domains/combat/combat.upgrades'
import { getRuntimePrimitiveStats } from '@/domains/combat/combat.upgrade-primitives'
import type { SimHazard, SimUnit, Team } from '@/domains/combat/combat.types'
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

function withUpgrade(id: string, upgrade: UpgradeConfig, run: () => void): void {
  UPGRADES[id] = upgrade
  try {
    run()
  } finally {
    delete UPGRADES[id]
  }
}

describe('death and kill effect primitives', () => {
  it('runs on-death explosion damage through the damage pipeline', () => {
    const victim = makeUnit({
      id: 'wreck',
      team: 'defender',
      hp: 0,
      triggerEffects: [{ id: 'wreckage-detonation', event: 'death', payload: { kind: 'damage', target: 'self', amount: 30, radius: 120 }, fired: false, counter: 0, cooldownRemaining: 0 }],
    })
    const killer = makeUnit({ id: 'killer', team: 'attacker', x: 40, y: 0 })
    const bystander = makeUnit({ id: 'bystander', team: 'attacker', x: 80, y: 0 })
    const actions: BattleAction[] = []
    const hazards: SimHazard[] = []

    handleDeath(victim, killer, [victim, killer, bystander], actions, hazards, new PRNG(1))

    expect(killer.hp).toBe(70)
    expect(bystander.hp).toBe(70)
    expect(actions).toContainEqual({ unitId: 'wreck', type: 'trigger_effect', targetId: 'wreck', statusType: 'wreckage-detonation' })
    expect(actions.filter(action => action.type === 'damage').map(action => action.targetId).sort()).toEqual(['bystander', 'killer'])
  })

  it('supports capped on-death spawns', () => {
    const victim = makeUnit({
      id: 'carrier-wreck',
      team: 'defender',
      hp: 0,
      triggerEffects: [{ id: 'mechanical-division', event: 'death', payload: { kind: 'spawn', target: 'self', unitType: 'alien_bug', count: 2, cap: 1, hpPercent: 0.5 }, fired: false, counter: 0, cooldownRemaining: 0 }],
    })
    const killer = makeUnit({ id: 'killer', team: 'attacker' })
    const actions: BattleAction[] = []
    const units = [victim, killer]

    handleDeath(victim, killer, units, actions, [], new PRNG(2))

    const spawned = units.filter(unit => unit.summonOwnerId === 'carrier-wreck')
    expect(spawned).toHaveLength(1)
    expect(spawned[0]).toMatchObject({ team: 'defender', type: 'alien_bug', hp: 10 })
    expect(actions).toContainEqual(expect.objectContaining({ unitId: 'carrier-wreck', type: 'spawn', spawnType: 'alien_bug' }))
  })

  it('maps legacy upgrade onDeathSpawn into a capped death trigger spawn', () => {
    withUpgrade('test_death_spawn', { id: 'test_death_spawn', name: 'Death Spawn', description: 'test', cost: 0, allowedUnits: ['marine'], modifiers: { onDeathSpawn: 'alien_bug' } }, () => {
      const victim = makeUnit({ id: 'legacy-wreck', team: 'defender', hp: 0 })
      const killer = makeUnit({ id: 'killer', team: 'attacker' })
      const stats = getRuntimePrimitiveStats(UNIT_TYPES.marine.baseStats, ['test_death_spawn'])
      prepareRuntimePrimitives(victim, stats)
      const actions: BattleAction[] = []
      const units = [victim, killer]

      handleDeath(victim, killer, units, actions, [], new PRNG(4))

      const spawned = units.filter(unit => unit.summonOwnerId === 'legacy-wreck')
      expect(victim.triggerEffects?.[0]).toMatchObject({ id: 'test_death_spawn-on-death-spawn', event: 'death' })
      expect(spawned).toHaveLength(1)
      expect(spawned[0]).toMatchObject({ team: 'defender', type: 'alien_bug' })
      expect(actions).toContainEqual(expect.objectContaining({ unitId: 'legacy-wreck', type: 'spawn', spawnType: 'alien_bug' }))
    })
  })

  it('supports on-kill recycling heals and existing on-death puddle replay actions', () => {
    const killer = makeUnit({
      id: 'recycler',
      team: 'attacker',
      hp: 40,
      triggerEffects: [{ id: 'wreckage-recycling', event: 'kill', payload: { kind: 'heal', target: 'self', victimMaxHpPercent: 0.5 }, fired: false, counter: 0, cooldownRemaining: 0 }],
    })
    const victim = makeUnit({ id: 'acidic', team: 'defender', hp: 0, maxHp: 80, onDeathPuddle: 'acid' })
    const actions: BattleAction[] = []
    const hazards: SimHazard[] = []

    handleDeath(victim, killer, [killer, victim], actions, hazards, new PRNG(3))

    expect(killer.hp).toBe(80)
    expect(hazards[0]).toMatchObject({ type: 'acid', team: 'defender' })
    expect(actions).toContainEqual({ unitId: 'acidic', type: 'hazard_spawn', hazardId: hazards[0].id, statusType: 'acid', toX: 0, toY: 0, radius: 50 })
    expect(actions).toContainEqual({ unitId: 'recycler', type: 'trigger_effect', targetId: 'recycler', statusType: 'wreckage-recycling' })
  })
})
