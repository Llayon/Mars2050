import { describe, expect, it } from 'vitest'
import { simulateBattle } from '@/domains/combat/combat.engine'
import { cloneRuntimeUnit, createRuntimeUnitFromConfig } from '@/domains/combat/combat.unit-factory'
import { CombatWorld } from '@/domains/combat/ecs/combat-world'
import { createEcsMeleeEngagementState, reserveEcsMeleeSlot, runActionSystem, runHazardSystem, runMovementSystem, runTargetingSystem } from '@/domains/combat/ecs/systems'
import { EntitySpatialIndex } from '@/domains/combat/ecs/entity-spatial-index'
import { getSimulatorPreset } from '@/app/simulator2/simulator.presets'
import { createPathfindingMap } from '@/domains/combat/combat.pathfinding'
import { PRNG } from '@/domains/combat/combat.utils'

describe('combat ECS runtime', () => {
  it('keeps component state canonical and serializes immutable snapshots', () => {
    const unit = createRuntimeUnitFromConfig({ id: 'marine', team: 'attacker', type: 'marine', x: 10, y: 20, currentAngle: 0 })
    expect(unit).not.toBeNull()
    const world = new CombatWorld([unit!])
    world.stores.vitality.require(0).hp = 17
    world.stores.transform.require(0).x = 44
    expect(world.snapshotEntity(0)).toMatchObject({ id: 'marine', hp: 17, x: 44 })
    const snapshot = world.snapshotEntity(0)
    world.stores.transform.require(0).velocity.x = 99
    expect(snapshot.velocity.x).toBe(0)
  })

  it('queries entities in monotonic creation order and excludes dead units', () => {
    const first = createRuntimeUnitFromConfig({ id: 'first', team: 'attacker', type: 'marine', x: 0, y: 0, currentAngle: 0 })!
    const second = createRuntimeUnitFromConfig({ id: 'second', team: 'defender', type: 'marine', x: 20, y: 20, currentAngle: 0 })!
    const world = new CombatWorld([first, second])

    world.stores.vitality.require(0).isDead = true

    expect(world.query(['identity', 'transform', 'vitality'])).toEqual([1])
    expect(world.query(['identity', 'transform', 'vitality'], true)).toEqual([0, 1])
    expect(world.getEntityId('second')).toBe(1)
  })

  it('discovers units created across internal structural flushes by watermark', () => {
    const initial = createRuntimeUnitFromConfig({ id: 'initial', team: 'attacker', type: 'marine', x: 0, y: 0, currentAngle: 0 })!
    const created = createRuntimeUnitFromConfig({ id: 'created', team: 'attacker', type: 'marine', x: 20, y: 20, currentAngle: 0 })!
    const world = new CombatWorld([initial])
    const watermark = world.captureEntityWatermark()

    world.queueHazardCreation({
      id: 'hazard', team: 'attacker', type: 'mine', x: 10, y: 10,
      radius: 10, damagePerTick: 1, duration: 5,
    })
    world.flushStructuralCommands()
    world.queueUnitCreation(created)
    world.flushStructuralCommands()

    expect(world.getUnitsCreatedSince(watermark)).toEqual([2])
  })

  it('registers hazards as separate ECS entities and reconciles expiration', () => {
    const world = new CombatWorld()
    world.queueHazardCreation({
      id: 'mine-1', team: 'attacker', type: 'mine', x: 10, y: 20,
      radius: 30, damagePerTick: 12, duration: 5,
    })

    expect(world.getEntityId('mine-1')).toBeUndefined()
    world.flushStructuralCommands()
    const entityId = world.getEntityId('mine-1')
    expect(entityId).toBe(0)
    expect(world.stores.entityMeta.get(entityId!)).toEqual({ kind: 'hazard', externalId: 'mine-1' })
    expect(world.getHazard(entityId!)).toMatchObject({ type: 'mine', duration: 5 })
    expect(world.snapshot()).toEqual([])

    world.removeHazardEntity(entityId!)
    expect(world.stores.hazard.has(entityId!)).toBe(false)
  })

  it('processes mine damage from ECS hazard components', () => {
    const target = createRuntimeUnitFromConfig({ id: 'target', team: 'defender', type: 'marine', x: 10, y: 20, currentAngle: 0 })!
    const world = new CombatWorld([target])
    world.queueHazardCreation({
      id: 'mine-1', team: 'attacker', type: 'mine', x: 10, y: 20,
      radius: 30, damagePerTick: 12, duration: 5,
    })
    world.flushStructuralCommands()
    const spatial = new EntitySpatialIndex()
    spatial.rebuild(world)
    world.resources.set('entitySpatial', spatial)
    const actions: Parameters<typeof runHazardSystem>[1] = []

    runHazardSystem(world, actions, () => undefined)

    expect(world.stores.vitality.require(0).hp).toBe(target.hp - 12)
    expect(actions).toContainEqual(expect.objectContaining({ unitId: 'mine-1', type: 'damage', targetId: 'target', damage: 12 }))
    expect(world.query(['hazard'], true)).toEqual([])
  })

  it('stores targeting and melee references as EntityId values', () => {
    const attacker = createRuntimeUnitFromConfig({ id: 'attacker', team: 'attacker', type: 'marine', x: 10, y: 20, currentAngle: 0 })!
    const defender = createRuntimeUnitFromConfig({ id: 'defender', team: 'defender', type: 'marine', x: 40, y: 20, currentAngle: Math.PI })!
    attacker.range = 40
    const world = new CombatWorld([attacker, defender])
    const spatial = new EntitySpatialIndex()
    spatial.rebuild(world)
    world.resources.set('entitySpatial', spatial)
    const melee = createEcsMeleeEngagementState()

    expect(runTargetingSystem(world, 0, melee)).toBe(1)
    expect(reserveEcsMeleeSlot(world, 0, 1, melee)).toBe(true)
    expect(world.stores.entityTargets.require(0)).toMatchObject({ attackTarget: 1, meleeTarget: 1 })
    expect(world.snapshotEntity(0)).toMatchObject({
      attackTargetId: 'defender',
      meleeSlotTargetId: 'defender',
    })

    world.stores.entityTargets.require(0).attackTarget = undefined
    expect(world.snapshotEntity(0).attackTargetId).toBeUndefined()
  })

  it('writes movement results to ECS components and spatial indexes', () => {
    const attacker = createRuntimeUnitFromConfig({ id: 'attacker', team: 'attacker', type: 'marine', x: 10, y: 20, currentAngle: 0 })!
    const defender = createRuntimeUnitFromConfig({ id: 'defender', team: 'defender', type: 'marine', x: 400, y: 20, currentAngle: Math.PI })!
    const world = new CombatWorld([attacker, defender])
    const entitySpatial = new EntitySpatialIndex()
    entitySpatial.rebuild(world)
    world.resources.set('entitySpatial', entitySpatial)
    runMovementSystem(world, 0, 1, [], {
      dt: 0.1,
      rng: new PRNG(1),
      flowField: createPathfindingMap([]),
      obstacles: [],
    })

    const transform = world.stores.transform.require(0)
    expect(transform.x).toBeGreaterThan(10)
    expect(entitySpatial.query(world, transform.x, transform.y, 1)).toContain(0)
  })

  it('applies actual healing through ECS action components', () => {
    const medic = createRuntimeUnitFromConfig({ id: 'medic', team: 'attacker', type: 'medic', x: 10, y: 20, currentAngle: 0 })!
    const marine = createRuntimeUnitFromConfig({ id: 'marine', team: 'attacker', type: 'marine', x: 100, y: 20, currentAngle: 0 })!
    marine.hp = marine.maxHp - 20
    const world = new CombatWorld([medic, marine])
    const actions: Parameters<typeof runActionSystem>[3] = []

    const result = runActionSystem(world, 0, 1, actions, {
      rng: new PRNG(1),
      tick: 0,
    })

    expect(result).toEqual({ acted: true, actorSynchronized: true })
    expect(world.stores.vitality.require(1).hp).toBe(marine.maxHp)
    expect(world.stores.combat.require(0).actionCooldown).toBe(medic.actionCooldownMax)
    expect(actions).toContainEqual({ unitId: 'medic', type: 'heal', targetId: 'marine', damage: 20 })
  })

  it('resolves simple single damage and death through ECS components', () => {
    const attacker = createRuntimeUnitFromConfig({ id: 'attacker', team: 'attacker', type: 'marine', x: 10, y: 20, currentAngle: 0 })!
    const defender = createRuntimeUnitFromConfig({ id: 'defender', team: 'defender', type: 'marine', x: 100, y: 20, currentAngle: Math.PI })!
    defender.hp = 1
    const world = new CombatWorld([attacker, defender])
    const actions: Parameters<typeof runActionSystem>[3] = []

    const result = runActionSystem(world, 0, 1, actions, {
      rng: new PRNG(1),
      tick: 0,
    })

    expect(result).toEqual({ acted: true, actorSynchronized: true })
    expect(world.stores.vitality.require(1).isDead).toBe(true)
    expect(actions.map(action => action.type)).toEqual(['attack', 'unit_blocked_damage', 'damage', 'die'])
    expect(actions.at(-1)).toMatchObject({ unitId: 'defender', sourceUnitId: 'attacker', cause: 'weapon' })
  })

  it('orders ECS status, mark, flat block, and shield defenses', () => {
    const attacker = createRuntimeUnitFromConfig({ id: 'attacker', team: 'attacker', type: 'marine', x: 10, y: 20, currentAngle: 0 })!
    const defender = createRuntimeUnitFromConfig({ id: 'defender', team: 'defender', type: 'marine', x: 100, y: 20, currentAngle: Math.PI })!
    attacker.attack = 100
    attacker.statusEffects.push({ type: 'attack_boost', duration: 10, value: 0.5, tickInterval: 0, nextTickIn: 0 })
    defender.defense = 20
    defender.shield = 50
    defender.maxShield = 50
    defender.shieldHitBlockCharges = 1
    defender.flatDamageBlock = { amount: 10 }
    defender.targetMark = { sourceUnitId: attacker.id, duration: 10, damageMultiplier: 0.5, sharedDamage: true }
    defender.statusEffects.push(
      { type: 'armor_broken', duration: 10, value: 1, tickInterval: 0, nextTickIn: 0 },
      { type: 'vulnerable', duration: 10, value: 0.25, tickInterval: 0, nextTickIn: 0 },
      { type: 'damage_reduction', duration: 10, value: 0.2, tickInterval: 0, nextTickIn: 0 },
    )
    const world = new CombatWorld([attacker, defender])
    const actions: Parameters<typeof runActionSystem>[3] = []

    const result = runActionSystem(world, 0, 1, actions, {
      rng: new PRNG(1),
      tick: 0,
    })

    expect(result).toEqual({ acted: true, actorSynchronized: true })
    expect(world.stores.vitality.require(1)).toMatchObject({ hp: defender.maxHp, shield: 0 })
    expect(world.stores.defense.require(1).shieldHitBlockCharges).toBe(0)
    expect(actions.slice(1)).toEqual([
      { unitId: 'defender', type: 'unit_blocked_damage', targetId: 'attacker', damage: 163 },
      { unitId: 'defender', type: 'shield_hit_block', targetId: 'attacker', damage: 163 },
      { unitId: 'attacker', type: 'shield_damage', targetId: 'defender', damage: 50, isShieldHit: true },
      { unitId: 'attacker', type: 'shield_break', targetId: 'defender' },
    ])
  })

  it('clones nested loadout state and resets transient statuses', () => {
    const unit = createRuntimeUnitFromConfig({ id: 'source', team: 'attacker', type: 'officer', x: 10, y: 20, currentAngle: 0 })!
    unit.statusEffects.push({ type: 'burn', duration: 30, tickInterval: 10, nextTickIn: 10 })
    const clone = cloneRuntimeUnit(unit, 'clone', 30, 40)

    clone.supportAuras![0].value = 0.5
    expect(clone.statusEffects).toEqual([])
    expect(unit.statusEffects[0].duration).toBe(30)
    expect(unit.supportAuras![0].value).toBe(0.35)
  })

  it('reports deterministic local-query profiling', () => {
    const preset = getSimulatorPreset('ranged_duel')
    expect(preset).not.toBeNull()
    const result = simulateBattle(preset!.attackers, preset!.defenders, 12345, [], [], [], { profile: true })

    expect(result.profile?.queryCount).toBeGreaterThan(0)
    expect(result.profile?.candidateCount).toBeGreaterThanOrEqual(result.profile?.maxCandidates ?? 0)
    expect(result.profile?.componentQueryCount).toBeGreaterThan(0)
    expect(result.profile?.componentCandidateCount).toBeGreaterThan(0)
    expect(result.profile?.componentResultCount).toBeGreaterThan(0)
    expect(result.profile?.componentCacheHitCount).toBeGreaterThan(0)
    expect(result.profile?.rebuildCount).toBeGreaterThan(0)
  }, 30000)
})
