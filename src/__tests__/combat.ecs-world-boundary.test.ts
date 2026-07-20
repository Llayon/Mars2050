import { describe, expect, it } from 'vitest'
import { CURRENT_SIMULATION_VERSION } from '@/domains/combat/combat.version'
import { createRuntimeUnitFromConfig } from '@/domains/combat/combat.unit-factory'
import { CombatInvariantError } from '@/domains/combat/ecs/combat-invariant-error'
import { CombatWorld } from '@/domains/combat/ecs/combat-world'
import { ExternalIdAllocator } from '@/domains/combat/ecs/external-id-allocator'
import { PRNG } from '@/domains/combat/combat.utils'

function unit(id: string) {
  return createRuntimeUnitFromConfig({
    id,
    team: 'attacker',
    type: 'marine',
    x: 10,
    y: 20,
    currentAngle: 0,
  })!
}

describe('combat ECS world boundary', () => {
  it('owns nested input data before and after a structural flush', () => {
    const initial = unit('initial')
    const queued = unit('queued')
    const world = new CombatWorld([initial])
    world.queueUnitCreation(queued)

    initial.velocity.x = 77
    initial.statusEffects.push({
      type: 'burn', duration: 10, tickInterval: 10, nextTickIn: 10,
    })
    queued.velocity.y = 88
    queued.statusEffects.push({
      type: 'acid', duration: 10, tickInterval: 10, nextTickIn: 10,
    })
    world.flushStructuralCommands()

    expect(world.stores.transform.require(0).velocity).toEqual({ x: 0, y: 0 })
    expect(world.stores.statusControl.require(0).statusEffects).toEqual([])
    expect(world.stores.transform.require(1).velocity).toEqual({ x: 0, y: 0 })
    expect(world.stores.statusControl.require(1).statusEffects).toEqual([])
  })

  it('rejects duplicate pending and committed external ids', () => {
    expect(() => new CombatWorld([unit('duplicate'), unit('duplicate')]))
      .toThrow(CombatInvariantError)

    const world = new CombatWorld([unit('existing')])
    expect(() => world.queueUnitCreation(unit('existing')))
      .toThrow('Duplicate external entity id: existing')
  })

  it('allocates deterministic ids without consuming combat PRNG state', () => {
    const allocator = new ExternalIdAllocator()
    const ids = new Set<string>()
    const combatRng = new PRNG(12345)
    const untouchedRng = new PRNG(12345)

    for (let index = 0; index < 100_000; index++) {
      ids.add(allocator.allocate('spawn'))
    }

    expect(ids.size).toBe(100_000)
    expect(combatRng.next()).toBe(untouchedRng.next())
  })

  it('publishes the new deterministic simulation version', () => {
    expect(CURRENT_SIMULATION_VERSION).toBe(3)
  })
})
