import { describe, expect, it } from 'vitest'
import type { BattleAction } from '@/domains/combat/combat.actions'
import type { SimUnit, Team } from '@/domains/combat/combat.types'
import { PRNG } from '@/domains/combat/combat.utils'
import { CombatWorld } from '@/domains/combat/ecs/combat-world'
import { resolveEcsDeath } from '@/domains/combat/ecs/systems'

function makeUnit(overrides: Partial<SimUnit> & { id: string; team: Team; type?: string }): SimUnit {
  return {
    type: 'marine',
    hp: 100,
    maxHp: 100,
    attack: 20,
    defense: 0,
    speed: 10,
    range: 240,
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

describe('combat on-kill effects', () => {
  it('resets cooldown and heals configured assassins after a confirmed kill', () => {
    const killer = makeUnit({ id: 'ghost', team: 'attacker', type: 'stealth_operative', hp: 50, actionCooldown: 18 })
    const victim = makeUnit({ id: 'victim', team: 'defender', hp: 0, x: 80 })
    const actions: BattleAction[] = []
    const world = new CombatWorld([killer, victim])
    world.resources.set('rng', new PRNG(1))

    resolveEcsDeath(world, 1, 0, actions, 'weapon')

    expect(world.stores.vitality.require(1).isDead).toBe(true)
    expect(world.stores.combat.require(0).actionCooldown).toBe(0)
    expect(world.stores.vitality.require(0).hp).toBe(75)
    expect(actions).toContainEqual({ unitId: 'ghost', type: 'on_kill', targetId: 'victim' })
    expect(actions).toContainEqual({ unitId: 'ghost', type: 'heal', targetId: 'ghost', damage: 25 })
  })

  it('does not trigger on-kill effects when the target resurrects', () => {
    const killer = makeUnit({ id: 'ghost', team: 'attacker', type: 'stealth_operative', hp: 50, actionCooldown: 18 })
    const victim = makeUnit({ id: 'victim', team: 'defender', hp: 0, maxHp: 80, resurrectOnce: true })
    const actions: BattleAction[] = []
    const world = new CombatWorld([killer, victim])
    world.resources.set('rng', new PRNG(1))

    resolveEcsDeath(world, 1, 0, actions, 'weapon')

    expect(world.stores.vitality.require(1)).toMatchObject({ isDead: false, hp: 80 })
    expect(world.stores.combat.require(0).actionCooldown).toBe(18)
    expect(actions.some(action => action.type === 'on_kill')).toBe(false)
  })

  it('does not apply on-kill actions to units without on-kill config', () => {
    const killer = makeUnit({ id: 'marine', team: 'attacker', type: 'marine', hp: 50, actionCooldown: 8 })
    const victim = makeUnit({ id: 'victim', team: 'defender', hp: 0 })
    const actions: BattleAction[] = []
    const world = new CombatWorld([killer, victim])
    world.resources.set('rng', new PRNG(1))

    resolveEcsDeath(world, 1, 0, actions, 'weapon')

    expect(world.stores.combat.require(0).actionCooldown).toBe(8)
    expect(world.stores.vitality.require(0).hp).toBe(50)
    expect(actions.some(action => action.type === 'on_kill')).toBe(false)
  })
})
