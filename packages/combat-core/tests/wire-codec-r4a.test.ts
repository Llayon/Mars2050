import { describe, expect, it } from 'vitest'
import {
  serializeCombatUnitSnapshot,
  deserializeCombatUnitSnapshot,
  serializeCombatEvent,
  deserializeCombatAction,
  serializeCombatTick,
  deserializeCombatTick,
  encodeLegacyReplayJson,
  decodeLegacyReplayJson,
  CANONICAL_SNAPSHOT_KEYS,
  CANONICAL_SNAPSHOT_KEY_SET,
} from '../src/replay/legacy-wire-codec.js'
import {
  combatSnapshotUnitSchema,
  combatEventSchema,
  combatRunResultSchema,
  type CombatRunResult,
} from '../src/contracts/index.js'
import { executeCombatSimulation } from '../src/combat.runner.js'

describe('R4a / ISO-10: Replay and Snapshot Wire Codec', () => {
  it('preserves all canonical snapshot keys inventory and omits undefined values', () => {
    expect(CANONICAL_SNAPSHOT_KEYS.length).toBeGreaterThanOrEqual(120)
    expect(CANONICAL_SNAPSHOT_KEY_SET.has('id')).toBe(true)
    expect(CANONICAL_SNAPSHOT_KEY_SET.has('team')).toBe(true)
    expect(CANONICAL_SNAPSHOT_KEY_SET.has('type')).toBe(true)
    expect(CANONICAL_SNAPSHOT_KEY_SET.has('hp')).toBe(true)

    const rawUnit: Record<string, unknown> = {
      id: 'u1', team: 'attacker', type: 'scout', hp: 100, maxHp: 100,
      x: 150, y: 250, speed: 3, range: 10, attack: 15, shield: undefined, // Must be omitted
    }

    const serialized = serializeCombatUnitSnapshot(rawUnit)
    expect(Object.keys(serialized)).not.toContain('shield')
    expect(serialized.id).toBe('u1')
    expect(serialized.team).toBe('attacker')
    expect(serialized.type).toBe('scout')
  })

  it('negative control: filters internal ECS sentinels and stores from JSON', () => {
    const internalUnit: Record<string, unknown> = {
      id: 'u-secret', team: 'defender', type: 'guard', hp: 80, maxHp: 80,
      x: 300, y: 400, speed: 2, range: 5, attack: 10,
      _ecsInternalSentinel: 'DO_NOT_LEAK_SECRET_STATE',
      _ecsEntityStore: { ptr: 12345 },
      _privateWorldRef: true,
    }

    // Negative control baseline: direct stringification would leak the internal sentinel
    const rawJson = JSON.stringify(internalUnit)
    expect(rawJson).toContain('_ecsInternalSentinel')
    expect(rawJson).toContain('DO_NOT_LEAK_SECRET_STATE')

    // Codec wire boundary: stripped completely
    const serialized = serializeCombatUnitSnapshot(internalUnit)
    const encodedJson = JSON.stringify(serialized)

    expect('_ecsInternalSentinel' in (serialized as Record<string, unknown>)).toBe(false)
    expect('_ecsEntityStore' in (serialized as Record<string, unknown>)).toBe(false)
    expect('_privateWorldRef' in (serialized as Record<string, unknown>)).toBe(false)
    expect(encodedJson).not.toContain('_ecsInternalSentinel')
    expect(encodedJson).not.toContain('DO_NOT_LEAK_SECRET_STATE')
    expect(encodedJson).not.toContain('_ecsEntityStore')

    // Deserialization also does not re-admit sentinels
    const deserialized = deserializeCombatUnitSnapshot(serialized)
    expect('_ecsInternalSentinel' in deserialized).toBe(false)
  })

  it('validates and round-trips unit snapshots without key reordering', () => {
    const raw: Record<string, unknown> = {
      id: 'scout_1', team: 'attacker', type: 'scout', rank: 1,
      x: 200, y: 300, hp: 50, maxHp: 50, speed: 4, range: 8, attack: 12, statusEffects: [],
    }

    const serialized = serializeCombatUnitSnapshot(raw)
    const deserialized = deserializeCombatUnitSnapshot(serialized)
    expect(deserialized.id).toBe('scout_1')
    expect(deserialized.team).toBe('attacker')
    expect(deserialized.type).toBe('scout')
    expect(Object.keys(deserialized)).toEqual(Object.keys(serialized))
  })

  it('serializes and deserializes CombatEvents and BattleActions', () => {
    const action = {
      unitId: 'u1', type: 'move' as const, fromX: 10, fromY: 20, toX: 15, toY: 25,
      motionKind: 'locomotion' as const, _actionInternalSentinel: 'strip_me',
    }

    const event = serializeCombatEvent(action)
    expect(event.type).toBe('move')
    expect(event.unitId).toBe('u1')
    expect(event.sourceId).toBe('u1')
    expect(event.x).toBe(15)
    expect(event.y).toBe(25)
    expect('_actionInternalSentinel' in event).toBe(false)

    const restoredAction = deserializeCombatAction(event)
    expect(restoredAction.unitId).toBe('u1')
    expect(restoredAction.type).toBe('move')
    expect(restoredAction.toX).toBe(15)
    expect(restoredAction.toY).toBe(25)
    expect('_actionInternalSentinel' in (restoredAction as unknown as Record<string, unknown>)).toBe(false)
  })

  it('serializes and deserializes CombatTicks', () => {
    const tick = {
      tick: 3,
      actions: [{ unitId: 'u1', type: 'damage' as const, targetId: 'u2', damage: 15 }],
    }
    const combatTick = serializeCombatTick(tick)
    expect(combatTick.tick).toBe(3)
    expect(combatTick.actions[0].type).toBe('damage')
    expect(combatTick.actions[0].amount).toBe(15)

    const restoredTick = deserializeCombatTick(combatTick)
    expect(restoredTick.tick).toBe(3)
    expect(restoredTick.actions[0].unitId).toBe('u1')
    expect(restoredTick.actions[0].damage).toBe(15)
  })

  it('validates full CombatRunResult JSON round-trip', () => {
    const mockResult: CombatRunResult = {
      winner: 'attacker', seed: 12345, elapsedTicks: 25, terminationReason: 'wiped',
      initialState: [
        serializeCombatUnitSnapshot({
          id: 'a1', team: 'attacker', type: 'scout', hp: 100, maxHp: 100,
          x: 200, y: 300, speed: 3, range: 6, attack: 10,
        }),
      ],
      survivors: [
        serializeCombatUnitSnapshot({
          id: 'a1', team: 'attacker', type: 'scout', hp: 75, maxHp: 100,
          x: 220, y: 280, speed: 3, range: 6, attack: 10,
        }),
      ],
      logs: [{
        tick: 0,
        actions: [serializeCombatEvent({ unitId: 'a1', type: 'attack', targetId: 'd1', damage: 25 })],
      }],
      engineVersion: 8,
      engineRevision: 'combat-ecs-v8-stabilized-r2',
    }

    const json = encodeLegacyReplayJson(mockResult)
    const decoded = decodeLegacyReplayJson(json)

    expect(decoded.winner).toBe('attacker')
    expect(decoded.seed).toBe(12345)
    expect(decoded.elapsedTicks).toBe(25)
    expect(decoded.initialState.length).toBe(1)
    expect(decoded.initialState[0].id).toBe('a1')
    expect(decoded.survivors.length).toBe(1)
    expect(decoded.survivors[0].hp).toBe(75)
    expect(decoded.logs.length).toBe(1)
    expect(JSON.stringify(decoded)).toBe(JSON.stringify(mockResult))
  })

  it('with profile: false, output contains no profiling payload or __marsCompat', () => {
    const result = executeCombatSimulation({
      seed: 42,
      arena: { width: 600, height: 1200, tileSize: 40, obstacles: [] },
      rules: { maxTicks: 5, timeoutPolicy: 'draw', defenseResolutionMode: 'v8_sequential', profile: false },
      definitions: {
        soldier: {
          id: 'soldier', name: 'Soldier', squadSize: 1, squadSpacing: 20, formation: 'grid',
          baseStats: {
            hp: 50, attack: 10, defense: 2, speed: 3, range: 4, attackType: 'single',
            actionCooldownMax: 10, turnSpeed: 5, size: 'M', combatTags: [],
          },
          hireCost: {},
        },
      },
      units: [
        { instanceId: 'u1', definitionId: 'soldier', team: 'attacker', placement: { x: 300, y: 800 }, rank: 1, upgradeIds: [] },
        { instanceId: 'u2', definitionId: 'soldier', team: 'defender', placement: { x: 300, y: 400 }, rank: 1, upgradeIds: [] },
      ],
      scheduledEffects: [],
    })

    // Zero profiling payloads or raw ECS state
    expect(result.profile).toBeUndefined()
    expect((result as Record<string, unknown>).__marsCompat).toBeUndefined()
    expect(result.initialState[0].id).toBe('u1')
    expect(result.initialState[1].id).toBe('u2')
    expect(result.winner).toBeDefined()
  })
})
