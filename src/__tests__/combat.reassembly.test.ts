import { describe, expect, it } from 'vitest'
import { resolveDeathInEcs } from '@/__tests__/helpers/combat-ecs-death-harness'
import type { BattleAction } from '@/domains/combat/combat.actions'
import { processReassemblies } from '@/domains/combat/combat.reassembly'
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
    isDead: false,
    turnSpeed: 1,
    currentAngle: 0,
    size: 'S',
    shield: 0,
    maxShield: 0,
    statusEffects: [],
    aggroLockTicks: 0,
    velocity: { x: 0, y: 0 },
    x: 0,
    y: 0,
    ...overrides,
  }
}

describe('delayed reassembly primitive', () => {
  it('schedules a dead unit and restores it after the declared delay', () => {
    const victim = makeUnit({ id: 'phoenix', team: 'defender', hp: 0, reassemblyConfig: { delayTicks: 2, hpPercent: 0.5 } })
    const killer = makeUnit({ id: 'killer', team: 'attacker' })
    const units = [victim, killer]
    const actions: BattleAction[] = []
    const hazards: SimHazard[] = []

    resolveDeathInEcs(victim, killer, units, actions, hazards, new PRNG(1))
    processReassemblies(units, actions)

    expect(victim.isDead).toBe(true)
    expect(victim.reassemblyState?.remainingTicks).toBe(1)

    processReassemblies(units, actions)

    expect(victim.isDead).toBe(false)
    expect(victim.hp).toBe(50)
    expect(victim.reassemblyState).toBeUndefined()
    expect(actions).toContainEqual({ unitId: 'phoenix', type: 'reassembly_start', targetId: 'phoenix', value: 2 })
    expect(actions).toContainEqual({ unitId: 'phoenix', type: 'reassembly_complete', targetId: 'phoenix', damage: 50 })
  })

  it('does not reassemble more than its configured trigger count', () => {
    const victim = makeUnit({ id: 'typhoon', team: 'defender', hp: 0, reassemblyConfig: { delayTicks: 0, hpPercent: 1, maxTriggers: 1 } })
    const killer = makeUnit({ id: 'killer', team: 'attacker' })
    const actions: BattleAction[] = []

    resolveDeathInEcs(victim, killer, [victim, killer], actions, [], new PRNG(2))
    processReassemblies([victim, killer], actions)
    victim.hp = 0
    resolveDeathInEcs(victim, killer, [victim, killer], actions, [], new PRNG(3))

    expect(actions.filter(action => action.type === 'reassembly_start')).toHaveLength(1)
  })
})
