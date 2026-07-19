import { describe, expect, it } from 'vitest'
import { actionSystem } from '@/domains/combat/combat.systems'
import type { SimUnit } from '@/domains/combat/combat.sim.types'
import { createRuntimeUnitFromConfig } from '@/domains/combat/combat.unit-factory'
import { PRNG } from '@/domains/combat/combat.utils'
import { CombatWorld } from '@/domains/combat/ecs/combat-world'
import { EntitySpatialIndex } from '@/domains/combat/ecs/entity-spatial-index'
import { runActionSystem } from '@/domains/combat/ecs/systems'

function unit(id: string, team: 'attacker' | 'defender', x: number): SimUnit {
  return createRuntimeUnitFromConfig({
    id,
    team,
    type: 'marine',
    x,
    y: 100,
    currentAngle: team === 'attacker' ? 0 : Math.PI,
  })!
}

describe('combat ECS trigger damage', () => {
  it('attributes lethal payload damage to the trigger cause', () => {
    const attacker = unit('detonator', 'attacker', 100)
    const target = unit('target', 'defender', 220)
    attacker.attack = 5
    target.hp = target.maxHp = 30
    target.defense = 0
    attacker.triggerEffects = [{
      id: 'finisher',
      event: 'attack_count',
      count: 1,
      payload: { kind: 'damage', target: 'target', amount: 40 },
      fired: false,
      counter: 0,
      cooldownRemaining: 0,
    }]
    const legacyUnits = structuredClone([attacker, target])
    const legacyActions: Parameters<typeof actionSystem>[4] = []
    const nativeActions: Parameters<typeof runActionSystem>[3] = []
    const world = new CombatWorld([attacker, target])
    const spatial = new EntitySpatialIndex()
    spatial.rebuild(world)
    world.resources.set('entitySpatial', spatial)

    actionSystem(
      legacyUnits[0],
      legacyUnits[1],
      legacyUnits,
      [],
      legacyActions,
      new PRNG(61),
    )
    runActionSystem(world, 0, 1, nativeActions, {
      rng: new PRNG(61),
      tick: 0,
    })

    expect(nativeActions).toEqual(legacyActions)
    expect(nativeActions).toContainEqual({
      unitId: 'target',
      type: 'die',
      sourceUnitId: 'detonator',
      cause: 'trigger',
    })
    expect(world.stores.vitality.require(1).isDead).toBe(true)
  })

  it('matches one-time resurrection after lethal trigger damage', () => {
    const attacker = unit('detonator', 'attacker', 100)
    const target = unit('reviver', 'defender', 220)
    attacker.attack = 5
    target.hp = target.maxHp = 30
    target.defense = 0
    target.resurrectOnce = true
    attacker.triggerEffects = [{
      id: 'finisher',
      event: 'attack_count',
      count: 1,
      payload: { kind: 'damage', target: 'target', amount: 40 },
      fired: false,
      counter: 0,
      cooldownRemaining: 0,
    }]
    const legacyUnits = structuredClone([attacker, target])
    const legacyActions: Parameters<typeof actionSystem>[4] = []
    const nativeActions: Parameters<typeof runActionSystem>[3] = []
    const world = new CombatWorld([attacker, target])
    const spatial = new EntitySpatialIndex()
    spatial.rebuild(world)
    world.resources.set('entitySpatial', spatial)

    actionSystem(
      legacyUnits[0],
      legacyUnits[1],
      legacyUnits,
      [],
      legacyActions,
      new PRNG(67),
    )
    runActionSystem(world, 0, 1, nativeActions, {
      rng: new PRNG(67),
      tick: 0,
    })

    expect(nativeActions).toEqual(legacyActions)
    expect(world.stores.vitality.require(1)).toMatchObject({
      hp: legacyUnits[1].hp,
      isDead: false,
      resurrectOnce: false,
    })
  })

  it('matches configured reassembly before trigger death', () => {
    const attacker = unit('detonator', 'attacker', 100)
    const target = unit('reassembler', 'defender', 220)
    attacker.attack = 5
    target.hp = target.maxHp = 30
    target.defense = 0
    target.reassemblyConfig = {
      delayTicks: 3,
      hpPercent: 0.4,
      maxTriggers: 2,
    }
    attacker.triggerEffects = [{
      id: 'finisher',
      event: 'attack_count',
      count: 1,
      payload: { kind: 'damage', target: 'target', amount: 40 },
      fired: false,
      counter: 0,
      cooldownRemaining: 0,
    }]
    const legacyUnits = structuredClone([attacker, target])
    const legacyActions: Parameters<typeof actionSystem>[4] = []
    const nativeActions: Parameters<typeof runActionSystem>[3] = []
    const world = new CombatWorld([attacker, target])
    const spatial = new EntitySpatialIndex()
    spatial.rebuild(world)
    world.resources.set('entitySpatial', spatial)

    actionSystem(
      legacyUnits[0],
      legacyUnits[1],
      legacyUnits,
      [],
      legacyActions,
      new PRNG(71),
    )
    runActionSystem(world, 0, 1, nativeActions, {
      rng: new PRNG(71),
      tick: 0,
    })

    expect(nativeActions).toEqual(legacyActions)
    expect(world.stores.vitality.require(1)).toMatchObject({
      isDead: true,
      reassemblyTriggersUsed: 1,
      reassemblyState: {
        remainingTicks: 3,
        hpPercent: 0.4,
        sourceUnitId: 'reassembler',
      },
    })
  })
})
