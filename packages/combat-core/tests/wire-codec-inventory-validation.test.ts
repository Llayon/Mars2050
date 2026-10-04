import { describe, expect, it } from 'vitest'
import {
  deserializeCombatUnitSnapshot,
  deserializeCombatEvent,
  deserializeCombatAction,
  decodeLegacyReplayJson,
} from '../src/replay/legacy-wire-codec.js'
import {
  combatSnapshotUnitSchema,
  combatEventSchema,
  type CombatRunResult,
} from '../src/contracts/index.js'

describe('R4a: Canonical inventory type validation and negative controls', () => {
  const baseUnit = {
    id: 'u1',
    team: 'attacker' as const,
    type: 'marine',
    x: 100,
    y: 200,
    hp: 50,
    maxHp: 50,
  }

  const baseValidReplay: CombatRunResult = {
    winner: 'attacker',
    seed: 42,
    elapsedTicks: 5,
    terminationReason: 'wiped',
    initialState: [baseUnit],
    survivors: [baseUnit],
    logs: [
      {
        tick: 1,
        actions: [{ type: 'strike', sourceId: 'u1', targetId: 'u2', amount: 10 }],
      },
    ],
    engineVersion: 9,
    engineRevision: 'combat-ecs-v9',
  }

  describe('Combat event canonical inventory type checks', () => {
    const invalidEventCases: Array<{ name: string; patch: Record<string, unknown> }> = [
      { name: 'spawnMaxHp as string ("bad")', patch: { spawnMaxHp: 'bad' } },
      { name: 'impactTick as string ("oops")', patch: { impactTick: 'oops' } },
      { name: 'isCritical as string ("false")', patch: { isCritical: 'false' } },
      { name: 'sourceTeam as object leak ({ pointer: "leak" })', patch: { sourceTeam: { pointer: 'leak' } } },
    ]

    invalidEventCases.forEach(({ name, patch }) => {
      it(`rejects corrupt event: ${name}`, () => {
        const corruptEvent = { type: 'spawn', ...patch }

        // Schema validation throws ZodError
        expect(() => combatEventSchema.parse(corruptEvent)).toThrow()

        // Deserialization throws ZodError
        expect(() => deserializeCombatEvent(corruptEvent)).toThrow()
        expect(() => deserializeCombatAction(corruptEvent)).toThrow()

        // Full replay decoder throws ZodError
        const replayWithCorruptEvent = {
          ...baseValidReplay,
          logs: [{ tick: 1, actions: [corruptEvent] }],
        }
        expect(() => decodeLegacyReplayJson(JSON.stringify(replayWithCorruptEvent))).toThrow()
      })
    })

    it('rejects disallowed non-canonical event keys on schema validation', () => {
      expect(() => combatEventSchema.parse({ type: 'spawn', disallowedField: 'unknown' })).toThrow(/Disallowed combat event key/)
    })
  })

  describe('Combat snapshot unit canonical inventory type checks', () => {
    const invalidSnapshotCases: Array<{ name: string; patch: Record<string, unknown> }> = [
      { name: 'direction as string ("bad")', patch: { direction: 'bad' } },
      { name: 'supportAuras as object ({})', patch: { supportAuras: {} } },
      { name: 'isFlying as string ("true")', patch: { isFlying: 'true' } },
      { name: 'squadId as number (123)', patch: { squadId: 123 } },
      { name: 'abilityPrograms as string ("not_an_array")', patch: { abilityPrograms: 'not_an_array' } },
      { name: 'burrowConfig as string ("not_an_object")', patch: { burrowConfig: 'not_an_object' } },
    ]

    invalidSnapshotCases.forEach(({ name, patch }) => {
      it(`rejects corrupt snapshot: ${name}`, () => {
        const corruptUnit = { ...baseUnit, ...patch }

        // Schema validation throws ZodError
        expect(() => combatSnapshotUnitSchema.parse(corruptUnit)).toThrow()

        // Deserialization throws ZodError
        expect(() => deserializeCombatUnitSnapshot(corruptUnit)).toThrow()

        // Full replay decoder throws ZodError
        const replayWithCorruptUnit = {
          ...baseValidReplay,
          initialState: [corruptUnit],
        }
        expect(() => decodeLegacyReplayJson(JSON.stringify(replayWithCorruptUnit))).toThrow()
      })
    })

    it('rejects disallowed non-canonical snapshot keys on schema validation', () => {
      expect(() => combatSnapshotUnitSchema.parse({ ...baseUnit, unmappedSecretProperty: 999 })).toThrow(/Disallowed unit snapshot key/)
    })
  })

  describe('Positive control: valid inventory fields pass and round-trip', () => {
    it('accepts valid action and snapshot inventory fields', () => {
      const validEvent = {
        type: 'spawn',
        sourceId: 'u1',
        spawnType: 'marine',
        spawnTeam: 'defender',
        spawnMaxHp: 120,
        impactTick: 15,
        isCritical: true,
      }
      expect(() => combatEventSchema.parse(validEvent)).not.toThrow()
      expect(deserializeCombatAction(validEvent).spawnMaxHp).toBe(120)

      const validUnit = {
        ...baseUnit,
        direction: 1.57,
        supportAuras: [{ type: 'haste', radius: 100 }],
        isFlying: false,
        squadId: 'sq-1',
        abilityPrograms: [],
        burrowConfig: { damageReduction: 0.5 },
      }
      expect(() => combatSnapshotUnitSchema.parse(validUnit)).not.toThrow()
      const deserialized = deserializeCombatUnitSnapshot(validUnit)
      expect(deserialized.direction).toBe(1.57)
      expect(deserialized.supportAuras).toEqual([{ type: 'haste', radius: 100 }])
    })
  })
})
