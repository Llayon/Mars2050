import { describe, expect, it } from 'vitest'
import {
  serializeCombatEvent,
  serializeCombatUnitSnapshot,
  encodeLegacyReplayJson,
  decodeLegacyReplayJson,
} from '../src/replay/legacy-wire-codec.js'
import {
  combatSnapshotUnitSchema,
  combatEventSchema,
  type CombatRunResult,
} from '../src/contracts/index.js'
import { executeCombatSimulation } from '../src/combat.runner.js'

describe('R4a / ISO-10: Review remediation verification for wire codec', () => {
  const baseValidReplay: CombatRunResult = {
    winner: 'attacker',
    seed: 42,
    elapsedTicks: 10,
    terminationReason: 'wiped',
    initialState: [
      {
        id: 'u1',
        team: 'attacker',
        type: 'scout',
        x: 100,
        y: 200,
        hp: 50,
        maxHp: 50,
      },
    ],
    survivors: [
      {
        id: 'u1',
        team: 'attacker',
        type: 'scout',
        x: 120,
        y: 210,
        hp: 40,
        maxHp: 50,
      },
    ],
    logs: [
      {
        tick: 1,
        actions: [
          {
            type: 'damage',
            sourceId: 'u1',
            targetId: 'u2',
            x: 12,
            y: 34,
            amount: 7,
            details: { damageType: 'kinetic', payload: 123 },
          },
        ],
      },
    ],
    engineVersion: 9,
    engineRevision: 'combat-ecs-v9',
  }

  it('[P2-1] JSON round-trip preserves all allowed event fields including sourceId, x, y, amount, details', () => {
    const rawAction = {
      type: 'strike',
      sourceId: 'u1',
      targetId: 'u2',
      x: 12,
      y: 34,
      amount: 7,
      details: { impactType: 'heavy', label: null, subDetail: { radius: 15 } },
    }
    const replay: CombatRunResult = {
      ...baseValidReplay,
      logs: [{ tick: 0, actions: [serializeCombatEvent(rawAction)] }],
    }

    const encoded = encodeLegacyReplayJson(replay)
    const decoded = decodeLegacyReplayJson(encoded)

    expect(decoded.logs[0].actions.length).toBe(1)
    const event = decoded.logs[0].actions[0]
    expect(event.type).toBe('strike')
    expect(event.sourceId).toBe('u1')
    expect(event.targetId).toBe('u2')
    expect(event.x).toBe(12)
    expect(event.y).toBe(34)
    expect(event.amount).toBe(7)
    expect(event.details).toEqual({ impactType: 'heavy', label: null, subDetail: { radius: 15 } })
  })

  it('[P2-2] event details are deeply detached and private sentinels are stripped and rejected', () => {
    const rawDetails = {
      damageType: 'explosive',
      _privateWorldRef: { ecsPtr: 0xdeadbeef },
      nested: { count: 3, _hiddenFlag: true },
    }
    const event = serializeCombatEvent({
      type: 'impact',
      unitId: 'u1',
      details: rawDetails,
    })

    // Reference detachment
    expect(event.details).not.toBe(rawDetails)
    expect(event.details?.nested).not.toBe(rawDetails.nested)

    // Private sentinels stripped
    expect('_privateWorldRef' in (event.details as unknown as Record<string, unknown>)).toBe(false)
    expect('_hiddenFlag' in ((event.details as unknown as Record<string, unknown>).nested as Record<string, unknown>)).toBe(false)
    expect(event.details).toEqual({ damageType: 'explosive', nested: { count: 3 } })

    // Schema rejects objects and arrays with keys starting with _ or non-finite numbers
    expect(() => combatEventSchema.parse({ type: 'test', details: { _bad: 123 } })).toThrow()
    expect(() => combatEventSchema.parse({ type: 'test', details: { valid: { _badNested: true } } })).toThrow()
    expect(() => combatEventSchema.parse({ type: 'test', details: { amount: Infinity } })).toThrow()
    expect(() => combatEventSchema.parse({ type: 'test', details: { hits: [{ _privateWorldRef: 'leak', amount: Infinity }] } })).toThrow(/Disallowed private key in details: _privateWorldRef/)
    expect(() => combatEventSchema.parse({ type: 'test', details: { hits: [{ amount: Infinity }] } })).toThrow(/Invalid number in details/)
  })

  it('[P2-3] corrupt JSON throws ZodError without silent fallback or coercion', () => {
    // initialState: "corrupt" -> throws
    expect(() => decodeLegacyReplayJson(JSON.stringify({ ...baseValidReplay, initialState: 'corrupt' }))).toThrow()

    // logs: "corrupt" -> throws
    expect(() => decodeLegacyReplayJson(JSON.stringify({ ...baseValidReplay, logs: 'corrupt' }))).toThrow()

    // seed: null -> throws (not coerced to 0)
    expect(() => decodeLegacyReplayJson(JSON.stringify({ ...baseValidReplay, seed: null }))).toThrow()

    // velocity: { x: null, y: "12" } -> throws (not coerced to 0 and 12)
    expect(() => decodeLegacyReplayJson(JSON.stringify({ ...baseValidReplay, initialState: [{ ...baseValidReplay.initialState[0], velocity: { x: null, y: '12' } }] }))).toThrow()

    // statusEffects: { foo: 'bar' } -> throws (not silently converted to undefined)
    expect(() => decodeLegacyReplayJson(JSON.stringify({ ...baseValidReplay, initialState: [{ ...baseValidReplay.initialState[0], statusEffects: { foo: 'bar' } }] }))).toThrow()

    // missing engineRevision -> throws (not coerced to "undefined")
    const { engineRevision: _, ...withoutRevision } = baseValidReplay
    expect(() => decodeLegacyReplayJson(JSON.stringify(withoutRevision))).toThrow()

    // missing terminationReason -> throws
    const { terminationReason: __, ...withoutReason } = baseValidReplay
    expect(() => decodeLegacyReplayJson(JSON.stringify(withoutReason))).toThrow()
  })

  it('[P2-4] snapshot nested contract strictly validates statusEffects canonical keys and finite numbers', () => {
    const validUnit = { ...baseValidReplay.initialState[0] }

    // statusEffects[0].entityStore disallowed by schema
    expect(() => combatSnapshotUnitSchema.parse({
      ...validUnit,
      statusEffects: [{ type: 'emp', duration: 10, entityStore: { ptr: 1 } }],
    })).toThrow(/Disallowed statusEffect key: entityStore/)

    // statusEffects[0].value: Infinity disallowed by schema
    expect(() => combatSnapshotUnitSchema.parse({
      ...validUnit,
      statusEffects: [{ type: 'emp', duration: 10, value: Infinity }],
    })).toThrow(/Invalid statusEffect value/)

    // actionCooldownMax: Infinity disallowed by schema
    expect(() => combatSnapshotUnitSchema.parse({
      ...validUnit,
      actionCooldownMax: Infinity,
    })).toThrow(/Invalid numeric value for actionCooldownMax/)

    // serializeCombatUnitSnapshot strips entityStore from internal simulation unit
    const serialized = serializeCombatUnitSnapshot({
      ...validUnit,
      statusEffects: [{ type: 'emp', duration: 10, value: 5, entityStore: { secret: 42 } }],
    })
    expect('entityStore' in (serialized.statusEffects![0] as unknown as Record<string, unknown>)).toBe(false)
    expect(serialized.statusEffects![0]).toEqual({ type: 'emp', duration: 10, value: 5 })
  })

  it('[P2-5] aligns loadout validator and replay schema by accepting finite negative defense', () => {
    const unitWithNegativeDefense = {
      ...baseValidReplay.initialState[0],
      defense: -3,
    }
    // Schema must parse cleanly
    const parsed = combatSnapshotUnitSchema.parse(unitWithNegativeDefense)
    expect(parsed.defense).toBe(-3)

    // Simulation with unit resulting in negative defense (base 2 + defenseAdd -5 = -3) produces valid output without ZodError
    const simResult = executeCombatSimulation({
      seed: 99,
      arena: { width: 600, height: 1200, tileSize: 40, obstacles: [] },
      rules: { maxTicks: 5, timeoutPolicy: 'draw', defenseResolutionMode: 'v8_sequential' },
      catalog: {
        upgrades: {
          cursed_armor: {
            id: 'cursed_armor',
            name: 'Cursed Armor',
            modifiers: {
              defenseAdd: -5,
            },
          },
        },
      },
      definitions: {
        fragile: {
          id: 'fragile',
          name: 'Fragile',
          squadSize: 1,
          squadSpacing: 20,
          formation: 'grid',
          baseStats: {
            hp: 40,
            attack: 10,
            defense: 2, // Valid non-negative base defense
            speed: 2,
            range: 4,
            attackType: 'single',
            actionCooldownMax: 10,
            turnSpeed: 5,
            size: 'M',
            combatTags: [],
          },
          hireCost: {},
        },
      },
      units: [
        { instanceId: 'u1', definitionId: 'fragile', team: 'attacker', placement: { x: 300, y: 700 }, rank: 1, upgradeIds: ['cursed_armor'] },
        { instanceId: 'u2', definitionId: 'fragile', team: 'defender', placement: { x: 300, y: 500 }, rank: 1, upgradeIds: [] },
      ],
      scheduledEffects: [],
    })

    expect(simResult.initialState[0].defense).toBe(-3)
    expect(simResult.winner).toBeDefined()
  })
})
