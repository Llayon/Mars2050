import { describe, expect, it } from 'vitest'
import { EcsActionGroupLedger } from '../src/combat.action-intent.js'
import { createRuntime, hash, loadMre, runStages } from './o2-fixtures.js'
import type { BattleAction } from '../src/contracts/index.js'

/**
 * O2 runtime-level guards: the optimized per-tick temporaries must stay detached from live
 * component stores, must not be shared between resolution groups, and the reusable spatial
 * candidate buffer must reset its length and keep a deterministic order.
 */

describe('O2: defense-frame snapshots are detached copies', () => {
  it('never aliases the live status list and never shares one array between groups', () => {
    const { runtime } = createRuntime(loadMre('case-1'))
    const world = runtime.world
    const ledger = new EcsActionGroupLedger()
    const entityIds = world.query(['identity', 'vitality'])

    ledger.begin(world, entityIds, { tick: 0, phaseId: 'probe', groupOrdinal: 0 })
    const firstFrame = ledger.frame
    expect(firstFrame).toBeDefined()
    const firstSnapshots = [...(firstFrame?.defense.targetsByExternalId.values() ?? [])]
    expect(firstSnapshots.length).toBeGreaterThan(0)
    for (const snapshot of firstSnapshots) {
      expect(snapshot.statusEffects).toEqual([])
      expect(Array.isArray(snapshot.statusEffects)).toBe(true)
    }

    const probeSnapshot = firstSnapshots[0]
    const probeEntityId = firstFrame?.routing.entityByExternalId.get(probeSnapshot.externalId)
    expect(probeEntityId).toBeDefined()
    const liveStatuses = world.stores.statusControl.require(probeEntityId as number).statusEffects
    expect(probeSnapshot.statusEffects).not.toBe(liveStatuses)
    liveStatuses.push({ type: 'burn', duration: 5, value: 3, tickInterval: 10, nextTickIn: 5 })
    expect(probeSnapshot.statusEffects).toEqual([])
    liveStatuses.length = 0

    ledger.begin(world, entityIds, { tick: 0, phaseId: 'probe', groupOrdinal: 1 })
    const secondSnapshots = [...(ledger.frame?.defense.targetsByExternalId.values() ?? [])]
    expect(secondSnapshots.length).toBe(firstSnapshots.length)
    for (let index = 0; index < secondSnapshots.length; index += 1) {
      expect(secondSnapshots[index].statusEffects).not.toBe(firstSnapshots[index].statusEffects)
    }
  })

  it('copies a populated status list instead of reusing it', () => {
    const { runtime } = createRuntime(loadMre('case-1'))
    const world = runtime.world
    const ledger = new EcsActionGroupLedger()
    const entityIds = world.query(['identity', 'vitality'])
    const firstId = entityIds[0]
    const externalId = world.stores.identity.require(firstId).id
    const live = world.stores.statusControl.require(firstId).statusEffects
    live.push({ type: 'burn', duration: 10, value: 7, tickInterval: 10, nextTickIn: 10 })

    ledger.begin(world, entityIds, { tick: 0, phaseId: 'probe', groupOrdinal: 0 })
    const snapshot = ledger.frame?.defense.targetsByExternalId.get(externalId)
    expect(snapshot?.statusEffects).toEqual([{ type: 'burn', duration: 10, value: 7, tickInterval: 10, nextTickIn: 10 }])
    expect(snapshot?.statusEffects).not.toBe(live)
    live[0].duration = 99
    expect(snapshot?.statusEffects?.[0].duration).toBe(10)
  })
})

describe('O2: spatial candidate buffers keep length and order', () => {
  function probe(input: ReturnType<typeof loadMre>) {
    const { runtime } = createRuntime(input)
    const world = runtime.world
    const targeting = world.resources.require('targetingRuntime')
    const defenders = world.query(['identity', 'transform', 'vitality'])
      .filter(entityId => !world.stores.vitality.require(entityId).isDead)
      .filter(entityId => world.stores.identity.require(entityId).team === 'defender')
    targeting.begin(world)
    const anchor = world.stores.transform.require(defenders[0])
    return { world, targeting, anchor, defenders }
  }

  it('returns an empty candidate list for an empty neighbourhood and leaves no tail', () => {
    const { world, targeting, anchor } = probe(loadMre('case-1'))
    const saturated = targeting.collect(world, anchor.x, anchor.y, 2000, 'defender')
    expect(saturated.length).toBeGreaterThan(0)
    const saturatedContent = [...saturated.entityIds.subarray(0, saturated.length)]

    const empty = targeting.collect(world, -50000, -50000, 5, 'defender')
    expect(empty.length).toBe(0)

    const repeated = targeting.collect(world, anchor.x, anchor.y, 2000, 'defender')
    expect([...repeated.entityIds.subarray(0, repeated.length)]).toEqual(saturatedContent)
  })

  it('keeps a stable deterministic candidate order for saturated queries', () => {
    const { world, targeting, anchor, defenders } = probe(loadMre('case-1'))
    const first = targeting.collect(world, anchor.x, anchor.y, 2000, 'defender')
    expect(first.length).toBe(defenders.length)
    const firstOrder = [...first.entityIds.subarray(0, first.length)]

    const second = targeting.collect(world, anchor.x, anchor.y, 2000, 'defender')
    expect([...second.entityIds.subarray(0, second.length)]).toEqual(firstOrder)

    const tighter = targeting.collect(world, anchor.x, anchor.y, 60, 'defender')
    expect(tighter.length).toBeLessThanOrEqual(first.length)
    const tightOrder = [...tighter.entityIds.subarray(0, tighter.length)]
    expect(tightOrder).toEqual(firstOrder.filter(entityId => tightOrder.includes(entityId)))
  })

  it('keeps the probed world identical to an undisturbed control', () => {
    const input = loadMre('case-1')
    const ticks = 5

    const control = createRuntime(input)
    const controlActions: BattleAction[] = []
    runStages(control.runtime, control.resources, control.rng, ticks, controlActions)

    const probed = createRuntime(input)
    const targeting = probed.runtime.world.resources.require('targetingRuntime')
    targeting.begin(probed.runtime.world)
    targeting.collect(probed.runtime.world, 300, 600, 2000, 'defender')
    targeting.collect(probed.runtime.world, -50000, -50000, 5, 'defender')
    targeting.end()
    const probedActions: BattleAction[] = []
    runStages(probed.runtime, probed.resources, probed.rng, ticks, probedActions)

    // Compare the probed runtime itself, not a freshly created world.
    expect(probed.runtime.snapshotUnits()).toEqual(control.runtime.snapshotUnits())
    expect(hash(probed.runtime.snapshotUnits())).toBe(hash(control.runtime.snapshotUnits()))
    expect(probedActions).toEqual(controlActions)
    expect(probed.runtime.getTerminalOutcome() ?? null).toEqual(control.runtime.getTerminalOutcome() ?? null)

    // Sensitivity: the same comparison must notice a deliberate world perturbation, so the
    // equality above is not vacuous. The perturbation lives only inside this test.
    const perturbed = createRuntime(input)
    const perturbedWorld = perturbed.runtime.world
    const victim = perturbedWorld.query(['transform'])[0]
    const victimTransform = perturbedWorld.stores.transform.require(victim)
    perturbedWorld.setEntityPosition(victim, victimTransform.x + 3, victimTransform.y + 3)
    const perturbedActions: BattleAction[] = []
    runStages(perturbed.runtime, perturbed.resources, perturbed.rng, ticks, perturbedActions)
    expect(hash(perturbed.runtime.snapshotUnits())).not.toBe(hash(control.runtime.snapshotUnits()))
    expect(perturbedActions).not.toEqual(controlActions)
  })
})
