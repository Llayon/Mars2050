import { describe, expect, it } from 'vitest'
import type { BattleAction } from '@/domains/combat/combat.actions'
import { createMeleeEngagementState } from '@/domains/combat/combat.melee-engagement'
import { applyStatus } from '@/domains/combat/combat.status'
import { actionSystem } from '@/__tests__/helpers/combat-ecs-action-harness'
import { targetingSystem } from '@/domains/combat/combat.targeting'
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

describe('combat control statuses', () => {
  it('prevents hacked units from acquiring or keeping targets', () => {
    const attacker = makeUnit({ id: 'attacker', team: 'attacker', x: 0, y: 0, attackTargetId: 'target', aggroLockTicks: 5 })
    const target = makeUnit({ id: 'target', team: 'defender', x: 40, y: 0 })
    applyStatus(attacker, { type: 'hacked', duration: 5 })

    const selected = targetingSystem(attacker, [attacker, target], createMeleeEngagementState())

    expect(selected).toBeNull()
    expect(attacker.attackTargetId).toBeUndefined()
    expect(attacker.aggroLockTicks).toBe(0)
  })

  it('redirects hacked combat units into attacking nearby allies', () => {
    const attacker = makeUnit({ id: 'attacker', team: 'attacker', x: 0, y: 0 })
    const ally = makeUnit({ id: 'ally', team: 'attacker', x: 80, y: 0 })
    const enemy = makeUnit({ id: 'enemy', team: 'defender', x: 40, y: 0 })
    const actions: BattleAction[] = []
    const hazards: SimHazard[] = []
    applyStatus(attacker, { type: 'hacked', duration: 5, controlMode: 'redirect' })

    const selected = targetingSystem(attacker, [attacker, ally, enemy], createMeleeEngagementState())
    const acted = selected ? actionSystem(attacker, selected, [attacker, ally, enemy], hazards, actions, new PRNG(1)) : false

    expect(selected?.id).toBe('ally')
    expect(acted).toBe(true)
    expect(ally.hp).toBe(90)
    expect(enemy.hp).toBe(100)
    expect(actions).toContainEqual({ unitId: 'attacker', type: 'attack', targetId: 'ally' })
    expect(actions).toContainEqual({ unitId: 'attacker', type: 'damage', targetId: 'ally', damage: 10 })
  })

  it('confuses hacked combat units into targeting the nearest reachable unit', () => {
    const attacker = makeUnit({ id: 'attacker', team: 'attacker', x: 0, y: 0 })
    const ally = makeUnit({ id: 'ally', team: 'attacker', x: 90, y: 0 })
    const enemy = makeUnit({ id: 'enemy', team: 'defender', x: 60, y: 0 })
    applyStatus(attacker, { type: 'hacked', duration: 5, controlMode: 'confuse' })

    const selected = targetingSystem(attacker, [attacker, ally, enemy], createMeleeEngagementState())

    expect(selected?.id).toBe('enemy')
    expect(attacker.attackTargetId).toBe('enemy')
    expect(attacker.aggroLockTicks).toBe(6)
  })

  it('does not let hacked support units keep using normal support behavior', () => {
    const healer = makeUnit({ id: 'healer', team: 'attacker', x: 0, y: 0, type: 'medic', attackType: 'heal' })
    const wounded = makeUnit({ id: 'wounded', team: 'attacker', x: 80, y: 0, hp: 50 })
    applyStatus(healer, { type: 'hacked', duration: 5, controlMode: 'redirect' })

    const selected = targetingSystem(healer, [healer, wounded], createMeleeEngagementState())

    expect(selected).toBeNull()
    expect(healer.attackTargetId).toBeUndefined()
  })

  it('does not allow direct friendly fire without hack control', () => {
    const attacker = makeUnit({ id: 'attacker', team: 'attacker', x: 0, y: 0 })
    const ally = makeUnit({ id: 'ally', team: 'attacker', x: 80, y: 0 })
    const actions: BattleAction[] = []
    const hazards: SimHazard[] = []

    const acted = actionSystem(attacker, ally, [attacker, ally], hazards, actions, new PRNG(1))

    expect(acted).toBe(false)
    expect(ally.hp).toBe(100)
    expect(actions).toEqual([])
  })
})
