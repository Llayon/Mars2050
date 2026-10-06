import { describe, expect, it } from 'vitest'
import {
  serializeCombatUnitSnapshot,
  deserializeCombatUnitSnapshot,
  encodeLegacyReplayJson,
  decodeLegacyReplayJson,
} from '../src/replay/legacy-wire-codec.js'
import {
  combatSnapshotUnitSchema,
  type CombatRunResult,
} from '../src/contracts/index.js'

describe('R4a / P2: Nested configuration schemas and entityStore stripping', () => {
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
    survivors: [],
    logs: [],
    engineVersion: 9,
    engineRevision: 'combat-ecs-v9',
  }

  const baseUnit = baseValidReplay.initialState[0]

  it('purges entityStore in snake_case geometry configs inside abilityPrograms and rejects on schema', () => {
    const programWithEntityStore = {
      id: 'beam_prog',
      trigger: { kind: 'weapon_attack' },
      groups: [
        {
          selector: { kind: 'primary_target' },
          effects: [
            {
              kind: 'line_pierce',
              config: {
                width: 20,
                damageMultiplier: 1.5,
                entityStore: { ptr: 123 },
              },
            },
            {
              kind: 'cone_attack',
              config: {
                angleDeg: 60,
                damageMultiplier: 1.2,
                entityStore: { ptr: 456 },
              },
            },
          ],
        },
      ],
    }

    // Schema rejects internal field in nested geometry configs
    expect(() => combatSnapshotUnitSchema.parse({
      ...baseUnit,
      abilityPrograms: [programWithEntityStore],
    })).toThrow(/Disallowed linePierce key: entityStore/)

    // Serializer strips entityStore from nested geometry configs
    const serialized = serializeCombatUnitSnapshot({
      ...baseUnit,
      abilityPrograms: [programWithEntityStore],
    })
    type ProgramWithEffects = Array<{ groups: Array<{ effects: Array<{ config: Record<string, unknown> }> }> }>
    const eff0 = (serialized.abilityPrograms as unknown as ProgramWithEffects)[0].groups[0].effects[0]
    const eff1 = (serialized.abilityPrograms as unknown as ProgramWithEffects)[0].groups[0].effects[1]
    expect('entityStore' in eff0.config).toBe(false)
    expect('entityStore' in eff1.config).toBe(false)
    expect(eff0.config).toEqual({ width: 20, damageMultiplier: 1.5 })
    expect(eff1.config).toEqual({ angleDeg: 60, damageMultiplier: 1.2 })

    // Decoded JSON contains no entityStore leak
    const fullReplay = {
      ...baseValidReplay,
      initialState: [serialized],
    }
    const json = encodeLegacyReplayJson(fullReplay)
    expect(json).not.toContain('entityStore')
    const decoded = decodeLegacyReplayJson(json)
    const decodedEff0 = (decoded.initialState[0].abilityPrograms as unknown as ProgramWithEffects)[0].groups[0].effects[0]
    expect('entityStore' in decodedEff0.config).toBe(false)
  })

  it('purges entityStore in nested adjacencyBonus, damageModifiers, and payload', () => {
    const rawUnit = {
      ...baseUnit,
      formationModifiers: {
        spacingMultiplier: 1.2,
        adjacencyBonus: {
          radius: 50,
          maxStacks: 3,
          damageReductionPerAlly: 0.05,
          entityStore: { ptr: 777 },
        },
      },
      rankScaling: {
        hpMultPerRank: 1.1,
        damageModifiers: [
          { relation: 'superior', multiplier: 1.3, entityStore: { ptr: 888 } },
        ],
      },
      triggerEffects: [
        {
          id: 'te1',
          event: 'on_kill',
          payload: {
            kind: 'heal',
            target: 'self',
            amount: 25,
            entityStore: { ptr: 999 },
          },
        },
      ],
      periodicAbilities: [
        {
          id: 'pa1',
          intervalTicks: 30,
          payload: {
            kind: 'damage',
            amount: 40,
            entityStore: { ptr: 111 },
          },
        },
      ],
    }

    // Schema rejects disallowed keys in deep nested objects
    expect(() => combatSnapshotUnitSchema.parse({
      ...baseUnit,
      formationModifiers: rawUnit.formationModifiers,
    })).toThrow(/Disallowed key in formationModifiers\.adjacencyBonus: entityStore/)

    expect(() => combatSnapshotUnitSchema.parse({
      ...baseUnit,
      rankScaling: rawUnit.rankScaling,
    })).toThrow(/Disallowed key in rankScaling\.damageModifiers\[0\]: entityStore/)

    expect(() => combatSnapshotUnitSchema.parse({
      ...baseUnit,
      triggerEffects: rawUnit.triggerEffects,
    })).toThrow(/Disallowed trigger payload key: entityStore/)

    expect(() => combatSnapshotUnitSchema.parse({
      ...baseUnit,
      periodicAbilities: rawUnit.periodicAbilities,
    })).toThrow(/Disallowed periodic payload key: entityStore/)

    // Serializer strips entityStore recursively
    const serialized = serializeCombatUnitSnapshot(rawUnit)
    const formMod = serialized.formationModifiers as unknown as { adjacencyBonus: Record<string, unknown> }
    const rScale = serialized.rankScaling as unknown as { damageModifiers: Array<Record<string, unknown>> }
    const trigEff = serialized.triggerEffects as unknown as Array<{ payload: Record<string, unknown> }>
    const perAb = serialized.periodicAbilities as unknown as Array<{ payload: Record<string, unknown> }>
    expect('entityStore' in formMod.adjacencyBonus).toBe(false)
    expect('entityStore' in rScale.damageModifiers[0]).toBe(false)
    expect('entityStore' in trigEff[0].payload).toBe(false)
    expect('entityStore' in perAb[0].payload).toBe(false)

    const json = JSON.stringify(serialized)
    expect(json).not.toContain('entityStore')
  })

  it('strictly validates nested effect schemas and rejects corrupted types', () => {
    // apply_status duration string
    expect(() => combatSnapshotUnitSchema.parse({
      ...baseUnit,
      abilityPrograms: [{
        id: 'p1', trigger: { kind: 'weapon_attack' },
        groups: [{ selector: { kind: 'primary_target' }, effects: [{ kind: 'apply_status', status: 'stun', duration: 'bad' }] }],
      }],
    })).toThrow(/Invalid status duration/)

    // line_pierce config width string
    expect(() => combatSnapshotUnitSchema.parse({
      ...baseUnit,
      abilityPrograms: [{
        id: 'p1', trigger: { kind: 'weapon_attack' },
        groups: [{ selector: { kind: 'primary_target' }, effects: [{ kind: 'line_pierce', config: { width: 'bad', damageMultiplier: 1.5 } }] }],
      }],
    })).toThrow(/Invalid numeric value for .*width/)

    // unknown effect kind
    expect(() => combatSnapshotUnitSchema.parse({
      ...baseUnit,
      abilityPrograms: [{
        id: 'p1', trigger: { kind: 'weapon_attack' },
        groups: [{ selector: { kind: 'primary_target' }, effects: [{ kind: 'made_up' }] }],
      }],
    })).toThrow(/Invalid effect kind/)

    // unknown selector kind
    expect(() => combatSnapshotUnitSchema.parse({
      ...baseUnit,
      abilityPrograms: [{
        id: 'p1', trigger: { kind: 'weapon_attack' },
        groups: [{ selector: { kind: 'made_up' }, effects: [] }],
      }],
    })).toThrow(/Invalid selector kind: made_up/)

    // periodicAbilities intervalTicks string
    expect(() => combatSnapshotUnitSchema.parse({
      ...baseUnit,
      periodicAbilities: [{ id: 'pa1', intervalTicks: 'bad', payload: { kind: 'damage', amount: 10 } }],
    })).toThrow(/Invalid intervalTicks in periodicAbilities\[0\]/)

    // linePierce maxTargets string
    expect(() => combatSnapshotUnitSchema.parse({
      ...baseUnit,
      linePierce: { width: 10, damageMultiplier: 1.5, maxTargets: 'bad' },
    })).toThrow(/Invalid numeric value for linePierce\.maxTargets/)
  })

  it('rejects statusOnHit with non-string sourceUnitId or extra object keys', () => {
    expect(() => combatSnapshotUnitSchema.parse({
      ...baseUnit,
      statusOnHit: [
        { type: 'burn', duration: 3, sourceUnitId: { entityStore: { ptr: 123 } } },
      ],
    })).toThrow(/Invalid statusEffect sourceUnitId/)

    expect(() => combatSnapshotUnitSchema.parse({
      ...baseUnit,
      statusOnHit: [
        { type: 'burn', duration: 3, extraLeak: true },
      ],
    })).toThrow(/Disallowed statusEffect key: extraLeak/)
  })
})
