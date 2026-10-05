import { describe, expect, it } from 'vitest'
import {
  serializeCombatUnitSnapshot,
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
        const corruptEvent = { type: 'spawn', sourceId: 'u1', ...patch }
        expect(() => combatEventSchema.parse(corruptEvent)).toThrow()
        expect(() => deserializeCombatEvent(corruptEvent)).toThrow()
        expect(() => deserializeCombatAction(corruptEvent)).toThrow()
        const replayWithCorruptEvent = {
          ...baseValidReplay,
          logs: [{ tick: 1, actions: [corruptEvent] }],
        }
        expect(() => decodeLegacyReplayJson(JSON.stringify(replayWithCorruptEvent))).toThrow()
      })
    })

    it('rejects disallowed non-canonical event keys on schema validation', () => {
      expect(() => combatEventSchema.parse({ type: 'spawn', sourceId: 'u1', disallowedField: 'unknown' })).toThrow(/Disallowed combat event key/)
    })
  })

  describe('BattleAction invariant requirements', () => {
    it('rejects move actions lacking both unitId and sourceId', () => {
      expect(() => deserializeCombatAction({ type: 'move', toX: 10, toY: 20 })).toThrow(/Move event requires unitId or sourceId/)
      expect(() => combatEventSchema.parse({ type: 'move', toX: 10, toY: 20 })).toThrow(/Move event requires unitId or sourceId/)
      expect(() => deserializeCombatAction({ type: 'heal', amount: 10 })).toThrow(/BattleAction requires a valid non-empty unitId or sourceId/)
    })

    it('accepts move actions with either unitId or sourceId and maps unitId', () => {
      const act1 = deserializeCombatAction({ type: 'move', unitId: 'u1', toX: 10, toY: 20 })
      expect(act1.unitId).toBe('u1')
      const act2 = deserializeCombatAction({ type: 'move', sourceId: 'u2', toX: 10, toY: 20 })
      expect(act2.unitId).toBe('u2')
    })

    it('rejects invalid spawnTeam and requires attacker | defender', () => {
      expect(() => deserializeCombatAction({ type: 'spawn', unitId: 'u1', spawnTeam: 'invalid-team' })).toThrow(/Invalid spawnTeam/)
      expect(() => combatEventSchema.parse({ type: 'spawn', unitId: 'u1', spawnTeam: 'invalid-team' })).toThrow(/Invalid spawnTeam/)
      const valid = deserializeCombatAction({ type: 'spawn', unitId: 'u1', spawnTeam: 'defender' })
      expect(valid.spawnTeam).toBe('defender')
    })

    it('rejects spawnMaxHp <= 0', () => {
      expect(() => deserializeCombatAction({ type: 'spawn', unitId: 'u1', spawnMaxHp: 0 })).toThrow(/Invalid spawnMaxHp/)
      expect(() => combatEventSchema.parse({ type: 'spawn', unitId: 'u1', spawnMaxHp: 0 })).toThrow(/Invalid spawnMaxHp/)
      expect(() => deserializeCombatAction({ type: 'spawn', unitId: 'u1', spawnMaxHp: -10 })).toThrow(/Invalid spawnMaxHp/)
      const valid = deserializeCombatAction({ type: 'spawn', unitId: 'u1', spawnMaxHp: 80 })
      expect(valid.spawnMaxHp).toBe(80)
    })
  })

  describe('Nested configuration schemas and type validation', () => {
    it('rejects corrupt supportAuras and disallows non-canonical keys like entityStore', () => {
      const corruptAura = {
        type: 'haste',
        target: 'allies',
        radius: 'bad',
        value: Infinity,
        entityStore: { ptr: 123 },
      }
      expect(() => combatSnapshotUnitSchema.parse({ ...baseUnit, supportAuras: [corruptAura] })).toThrow()
      expect(() => deserializeCombatUnitSnapshot({ ...baseUnit, supportAuras: [corruptAura] })).toThrow()

      const serialized = serializeCombatUnitSnapshot({ ...baseUnit, supportAuras: [{ type: 'haste', radius: 100, entityStore: { ptr: 123 } }] })
      expect('entityStore' in (serialized.supportAuras![0] as unknown as Record<string, unknown>)).toBe(false)
      expect(serialized.supportAuras![0]).toEqual({ type: 'haste', radius: 100 })
    })

    it('rejects corrupt abilityPrograms items like null or string', () => {
      expect(() => combatSnapshotUnitSchema.parse({ ...baseUnit, abilityPrograms: [null, 'bad'] })).toThrow()
      expect(() => deserializeCombatUnitSnapshot({ ...baseUnit, abilityPrograms: [null, 'bad'] })).toThrow()
    })

    it('rejects damaged burrowConfig (non-finite or wrong types) and disallowed keys', () => {
      expect(() => combatSnapshotUnitSchema.parse({ ...baseUnit, burrowConfig: { damageReduction: 'bad' } })).toThrow()
      expect(() => deserializeCombatUnitSnapshot({ ...baseUnit, burrowConfig: { damageReduction: 'bad' } })).toThrow()
      expect(() => combatSnapshotUnitSchema.parse({ ...baseUnit, burrowConfig: { damageReduction: Infinity } })).toThrow()
      expect(() => combatSnapshotUnitSchema.parse({ ...baseUnit, burrowConfig: { damageReduction: 0.5, entityStore: 123 } })).toThrow(/Disallowed burrowConfig key/)
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
        expect(() => combatSnapshotUnitSchema.parse(corruptUnit)).toThrow()
        expect(() => deserializeCombatUnitSnapshot(corruptUnit)).toThrow()
        const replayWithCorruptUnit = { ...baseValidReplay, initialState: [corruptUnit] }
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
