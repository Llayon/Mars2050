import { describe, expect, it } from 'vitest'
import { compareCombatEngines } from '@/domains/combat/combat.shadow'
import { simulateBattle } from '@/domains/combat/combat.engine'
import { cloneRuntimeUnit, createRuntimeUnitFromConfig } from '@/domains/combat/combat.unit-factory'
import { CombatWorld } from '@/domains/combat/ecs/combat-world'
import { createEcsMeleeEngagementState, reserveEcsMeleeSlot, runActionSystem, runHazardSystem, runMovementSystem, runTargetingSystem, syncEcsTargetRefs } from '@/domains/combat/ecs/systems'
import { EntitySpatialIndex } from '@/domains/combat/ecs/entity-spatial-index'
import { getSimulatorPreset } from '@/app/simulator2/simulator.presets'
import { createPathfindingMap } from '@/domains/combat/combat.pathfinding'
import { SpatialHash } from '@/domains/combat/spatial-hash'
import { PRNG } from '@/domains/combat/combat.utils'

const CORE_SHADOW_PRESETS = ['ranged_duel', 'summon_caps', 'control_status', 'qa_primitive_events'] as const

describe('combat ECS shadow engine', () => {
  it('stores mutable runtime state in component stores', () => {
    const unit = createRuntimeUnitFromConfig({ id: 'marine', team: 'attacker', type: 'marine', x: 10, y: 20, currentAngle: 0 })
    expect(unit).not.toBeNull()
    const world = new CombatWorld([unit!])
    const view = world.roster[0]

    view.hp = 17
    view.x = 44

    world.syncEntityToComponents(0)
    expect(world.stores.vitality.get(0)?.hp).toBe(17)
    expect(world.stores.transform.get(0)?.x).toBe(44)
    world.stores.vitality.require(0).hp = 23
    world.syncEntityFromComponents(0)
    expect(view.hp).toBe(23)
    expect(world.snapshotEntity(0)).toMatchObject({ id: 'marine', hp: 23, x: 44 })
    const snapshot = world.snapshotEntity(0)
    view.velocity.x = 99
    expect(snapshot.velocity.x).toBe(0)
  })

  it('queries entities in monotonic creation order and excludes dead units', () => {
    const first = createRuntimeUnitFromConfig({ id: 'first', team: 'attacker', type: 'marine', x: 0, y: 0, currentAngle: 0 })!
    const second = createRuntimeUnitFromConfig({ id: 'second', team: 'defender', type: 'marine', x: 20, y: 20, currentAngle: 0 })!
    const world = new CombatWorld([first, second])

    world.roster[0].isDead = true
    world.syncEntityToComponents(0)

    expect(world.query(['identity', 'transform', 'vitality'])).toEqual([1])
    expect(world.query(['identity', 'transform', 'vitality'], true)).toEqual([0, 1])
    expect(world.getEntityId('second')).toBe(1)
  })

  it('registers hazards as separate ECS entities and reconciles expiration', () => {
    const world = new CombatWorld()
    world.hazards.push({
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

    world.hazards.splice(0, 1)
    world.reconcileHazards()
    expect(world.stores.hazard.has(entityId!)).toBe(false)
  })

  it('processes mine damage from ECS hazard components', () => {
    const target = createRuntimeUnitFromConfig({ id: 'target', team: 'defender', type: 'marine', x: 10, y: 20, currentAngle: 0 })!
    const world = new CombatWorld([target])
    world.hazards.push({
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
    syncEcsTargetRefs(world)
    const melee = createEcsMeleeEngagementState()

    expect(runTargetingSystem(world, 0, melee)).toBe(1)
    expect(reserveEcsMeleeSlot(world, 0, 1, melee)).toBe(true)
    expect(world.stores.entityTargets.require(0)).toMatchObject({ attackTarget: 1, meleeTarget: 1 })
    expect(world.stores.targeting.require(0).attackTargetId).toBe('defender')

    world.stores.targeting.require(0).attackTargetId = undefined
    syncEcsTargetRefs(world)
    expect(world.stores.entityTargets.require(0).attackTarget).toBeUndefined()
  })

  it('writes movement results to ECS components and spatial indexes', () => {
    const attacker = createRuntimeUnitFromConfig({ id: 'attacker', team: 'attacker', type: 'marine', x: 10, y: 20, currentAngle: 0 })!
    const defender = createRuntimeUnitFromConfig({ id: 'defender', team: 'defender', type: 'marine', x: 400, y: 20, currentAngle: Math.PI })!
    const world = new CombatWorld([attacker, defender])
    const entitySpatial = new EntitySpatialIndex()
    entitySpatial.rebuild(world)
    world.resources.set('entitySpatial', entitySpatial)
    const spatialHash = new SpatialHash()
    spatialHash.insert(attacker)
    spatialHash.insert(defender)

    runMovementSystem(world, 0, 1, [], {
      dt: 0.1,
      rng: new PRNG(1),
      flowField: createPathfindingMap([]),
      obstacles: [],
      spatialHash,
    })

    const transform = world.stores.transform.require(0)
    expect(transform.x).toBeGreaterThan(10)
    expect(transform.x).toBe(attacker.x)
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
      spatialHash: new SpatialHash(),
    })

    expect(result).toEqual({ acted: true, actorSynchronized: true })
    expect(world.stores.vitality.require(1).hp).toBe(marine.maxHp)
    expect(world.stores.combat.require(0).actionCooldown).toBe(medic.actionCooldownMax)
    expect(actions).toContainEqual({ unitId: 'medic', type: 'heal', targetId: 'marine', damage: 20 })
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

  it.each(CORE_SHADOW_PRESETS)('matches legacy replay for %s', id => {
    const preset = getSimulatorPreset(id)
    expect(preset).not.toBeNull()
    const comparison = compareCombatEngines(preset!.attackers, preset!.defenders, 12345, [], [], [], { trackMetrics: true })

    expect(comparison.differences).toEqual([])
  }, 120000)

  it('reports deterministic local-query profiling', () => {
    const preset = getSimulatorPreset('ranged_duel')
    expect(preset).not.toBeNull()
    const result = simulateBattle(preset!.attackers, preset!.defenders, 12345, [], [], [], { profile: true })

    expect(result.profile?.queryCount).toBeGreaterThan(0)
    expect(result.profile?.candidateCount).toBeGreaterThanOrEqual(result.profile?.maxCandidates ?? 0)
  })
})
