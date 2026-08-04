import { describe, expect, it } from 'vitest'
import { CURRENT_SIMULATION_VERSION } from '@/domains/combat/combat.version'
import { createRuntimeUnitFromConfig } from '@/domains/combat/combat.unit-factory'
import { CombatInvariantError } from '@/domains/combat/ecs/combat-invariant-error'
import { CombatWorld } from '@/domains/combat/ecs/combat-world'
import { ExternalIdAllocator } from '@/domains/combat/ecs/external-id-allocator'
import { defineQuery } from '@/domains/combat/ecs/query-spec'
import { PRNG } from '@/domains/combat/combat.utils'
import { EntitySpatialIndex } from '@/domains/combat/ecs/entity-spatial-index'

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

  it('hydrates forward relations once without overwriting canonical refs', () => {
    const target = unit('target')
    const summon = unit('summon')
    summon.summonOwnerId = 'owner'
    const world = new CombatWorld([target, summon])

    expect(world.stores.entityTargets.require(1).summonOwner).toBeUndefined()
    expect(world.snapshotEntity(1).summonOwnerId).toBe('owner')
    world.stores.entityTargets.require(1).attackTarget = 0

    world.queueUnitCreation(unit('owner'))
    world.flushStructuralCommands()

    expect(world.stores.entityTargets.require(1)).toMatchObject({
      attackTarget: 0,
      summonOwner: 2,
    })
    expect(world.getActiveSummons(2)).toEqual([1])
    world.setEntityDead(1, true)
    expect(world.getActiveSummons(2)).toEqual([])
    expect(world.snapshotEntity(1)).toMatchObject({
      attackTargetId: 'target',
      summonOwnerId: 'owner',
    })
  })

  it('keeps team queries synchronized with runtime conversion', () => {
    const attacker = unit('attacker')
    const defender = unit('defender')
    defender.team = 'defender'
    const world = new CombatWorld([attacker, defender])

    expect(world.queryTeam('attacker', ['identity', 'vitality'])).toEqual([0])
    expect(world.queryTeam('defender', ['identity', 'vitality'])).toEqual([1])

    world.setEntityTeam(1, 'attacker')

    expect(world.queryTeam('attacker', ['identity', 'vitality'])).toEqual([0, 1])
    expect(world.queryTeam('defender', ['identity', 'vitality'])).toEqual([])
  })

  it('matches brute-force collision pairs and tracks committed positions', () => {
    const units = ['a', 'b', 'c', 'd'].map((id, index) => {
      const candidate = unit(id)
      candidate.x = index * 35
      candidate.y = index % 2 === 0 ? 20 : 45
      return candidate
    })
    const world = new CombatWorld(units)
    const spatial = new EntitySpatialIndex()
    world.resources.set('entitySpatial', spatial)
    const entityIds = world.query(['identity', 'transform', 'vitality'])
    const maxDistance = 60
    const expected: [number, number][] = []
    for (let left = 0; left < entityIds.length; left++) {
      for (let right = left + 1; right < entityIds.length; right++) {
        const first = world.stores.transform.require(entityIds[left])
        const second = world.stores.transform.require(entityIds[right])
        if (Math.hypot(second.x - first.x, second.y - first.y) < maxDistance) {
          expected.push([entityIds[left], entityIds[right]])
        }
      }
    }

    const pairs = spatial.queryPairs(world, entityIds, maxDistance)
    expect(pairs).toEqual(expected)
    expect(spatial.getProfile(world)).toMatchObject({ pairQueryCount: 1, pairResultCount: pairs.length })
    world.setEntityPosition(3, 36, 44)
    expect(spatial.queryPairs(world, entityIds, maxDistance)).toContainEqual([1, 3])
  })

  it('captures component-native clones and resets transient state', () => {
    const source = createRuntimeUnitFromConfig({
      id: 'source', team: 'attacker', type: 'officer', x: 10, y: 20, currentAngle: 0,
    })!
    const world = new CombatWorld([source])
    world.stores.identity.require(0).squadId = 'squad'
    Object.assign(world.stores.vitality.require(0), {
      hp: 1,
      maxShield: 20,
      shield: 2,
      reassemblyState: { remainingTicks: 4, hpPercent: 0.5, sourceUnitId: 'source' },
      reassemblyTriggersUsed: 1,
    })
    world.stores.combat.require(0).actionCooldown = 8
    Object.assign(world.stores.targeting.require(0), {
      rampMultiplier: 2,
      chargeDistance: 100,
      aggroLockTicks: 5,
      meleeSlotIndex: 3,
    })
    world.stores.statusControl.require(0).statusEffects.push({
      type: 'burn', duration: 10, tickInterval: 10, nextTickIn: 10,
    })
    world.stores.entityTargets.require(0).attackTarget = 0

    world.queueUnitClone(0, 'clone', 30, 40)
    world.stores.support.require(0).supportAuras![0].value = 0.9
    world.flushStructuralCommands()

    const cloneId = world.getEntityId('clone')!
    expect(world.stores.identity.require(cloneId)).toMatchObject({ id: 'clone', squadId: undefined })
    expect(world.stores.transform.require(cloneId)).toMatchObject({ x: 30, y: 40, velocity: { x: 0, y: 0 } })
    expect(world.stores.vitality.require(cloneId)).toMatchObject({
      hp: source.maxHp, shield: 20, isDead: false,
      reassemblyState: undefined, reassemblyTriggersUsed: 0,
    })
    expect(world.stores.targeting.require(cloneId)).toMatchObject({
      rampMultiplier: undefined, chargeDistance: 0, aggroLockTicks: 0,
      meleeSlotIndex: undefined,
    })
    expect(world.stores.statusControl.require(cloneId).statusEffects).toEqual([])
    expect(world.stores.entityTargets.require(cloneId)).toEqual({})
    expect(world.stores.support.require(cloneId).supportAuras![0].value).toBe(0.35)
    expect(world.stores.supportAuraCapability.has(cloneId)).toBe(true)
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
    expect(CURRENT_SIMULATION_VERSION).toBe(7)
  })

  it('invalidates registered query caches on death and revival', () => {
    const world = new CombatWorld([unit('first'), unit('second')])
    const activeUnits = defineQuery(['identity', 'vitality'])

    expect(world.query(activeUnits)).toEqual([0, 1])
    expect(world.query(activeUnits)).toEqual([0, 1])
    expect(world.getQueryProfile().cacheHitCount).toBe(1)

    world.setEntityDead(0, true)
    expect(world.query(activeUnits)).toEqual([1])
    world.setEntityDead(0, false)
    expect(world.query(activeUnits)).toEqual([0, 1])
  })

  it('keeps component query order stable after hazard compaction', () => {
    const world = new CombatWorld([unit('unit')])
    for (let index = 0; index < 8; index++) {
      world.queueHazardCreation({
        id: `hazard-${index}`,
        team: 'attacker',
        type: 'mine',
        x: index,
        y: index,
        radius: 1,
        damagePerTick: 1,
        duration: 1,
      })
    }
    world.flushStructuralCommands()
    for (const entityId of world.query(['hazard'], true).slice(0, 6)) {
      world.removeHazardEntity(entityId)
    }

    expect(world.query(['hazard'], true)).toEqual([7, 8])
  })

  it('returns the nearest deterministic team-limited spatial candidates', () => {
    const attackers = Array.from({ length: 70 }, (_, index) => {
      const candidate = unit(`attacker-${index}`)
      candidate.x = index
      candidate.y = 0
      return candidate
    })
    const defender = unit('defender')
    defender.team = 'defender'
    defender.x = 0.5
    defender.y = 0
    const world = new CombatWorld([...attackers, defender])
    const spatial = new EntitySpatialIndex()
    world.resources.set('entitySpatial', spatial)

    expect(spatial.queryTeamNearest(
      world, 0, 0, 100, 'attacker', 4, 'test',
    )).toEqual([0, 1, 2, 3])
    expect(spatial.getProfile(world).rebuildCount).toBe(1)
    expect(spatial.getProfile(world).purposes.test).toMatchObject({
      queryCount: 1,
      candidateCount: 4,
    })
  })
})
