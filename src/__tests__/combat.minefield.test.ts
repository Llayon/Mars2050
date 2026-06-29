import { describe, expect, it } from 'vitest'
import type { BattleAction } from '@/domains/combat/combat.actions'
import { processHazards } from '@/domains/combat/combat.hazards'
import { tryDeployMine } from '@/domains/combat/combat.minefield'
import { actionSystem } from '@/domains/combat/combat.systems'
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

describe('combat.minefield', () => {
  it('deploys a configured mine instead of dealing direct damage', () => {
    const minelayer = makeUnit({ id: 'minelayer', team: 'attacker', type: 'minelayer_rover', attack: 0 })
    const target = makeUnit({ id: 'target', team: 'defender', x: 100, y: 0 })
    const hazards: SimHazard[] = []
    const actions: BattleAction[] = []

    const deployed = tryDeployMine(minelayer, target, hazards, actions, new PRNG(1))

    expect(deployed).toBe(true)
    expect(hazards).toHaveLength(1)
    expect(hazards[0]).toMatchObject({ team: 'attacker', type: 'mine', radius: 42, damagePerTick: 65 })
    expect(actions[0]).toMatchObject({ unitId: 'minelayer', type: 'hazard_spawn', radius: 42 })
    expect(target.hp).toBe(100)
  })

  it('triggers mines once against ground enemies only', () => {
    const mine: SimHazard = {
      id: 'mine-1',
      team: 'attacker',
      type: 'mine',
      x: 0,
      y: 0,
      radius: 50,
      damagePerTick: 65,
      duration: 10,
    }
    const enemy = makeUnit({ id: 'enemy', team: 'defender', x: 20, y: 0 })
    const ally = makeUnit({ id: 'ally', team: 'attacker', x: 20, y: 0 })
    const flyer = makeUnit({ id: 'flyer', team: 'defender', x: 20, y: 0, isFlying: true })
    const hazards = [mine]
    const actions: BattleAction[] = []

    processHazards(hazards, [enemy, ally, flyer], actions)

    expect(hazards).toHaveLength(0)
    expect(enemy.hp).toBe(35)
    expect(ally.hp).toBe(100)
    expect(flyer.hp).toBe(100)
    expect(actions).toEqual([{ unitId: 'mine-1', type: 'damage', targetId: 'enemy', damage: 65 }])
  })

  it('uses actionSystem to deploy mines through normal cooldown and facing rules', () => {
    const minelayer = makeUnit({
      id: 'minelayer',
      team: 'attacker',
      type: 'minelayer_rover',
      attack: 0,
      actionCooldownMax: 20,
    })
    const target = makeUnit({ id: 'target', team: 'defender', x: 80, y: 0 })
    const hazards: SimHazard[] = []
    const actions: BattleAction[] = []

    const acted = actionSystem(minelayer, target, [minelayer, target], hazards, actions, new PRNG(2))

    expect(acted).toBe(true)
    expect(minelayer.actionCooldown).toBe(20)
    expect(hazards[0]?.type).toBe('mine')
    expect(actions[0]?.type).toBe('hazard_spawn')
    expect(target.hp).toBe(100)
  })
})
