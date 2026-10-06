import { describe, expect, it } from 'vitest'
import {
  deserializeCombatUnitSnapshot,
} from '../src/replay/legacy-wire-codec.js'
import {
  combatSnapshotUnitSchema,
  type CombatSnapshotUnit,
} from '../src/contracts/index.js'

describe('R4a: Hardened DTO rejection for malformed nested properties', () => {
  const baseUnit: CombatSnapshotUnit = {
    id: 'u1',
    team: 'attacker',
    type: 'fighter',
    x: 100,
    y: 200,
    hp: 100,
    maxHp: 100,
  }

  it('rejects triggerEffects with extra disallowed keys on schema and deserializer', () => {
    const triggerExtraKey = {
      ...baseUnit,
      triggerEffects: [{
        id: 't1',
        event: 'death',
        payload: { kind: 'heal', target: 'self', amount: 1 },
        entityStore: { ptr: 123 },
      }],
    }
    expect(() => combatSnapshotUnitSchema.parse(triggerExtraKey)).toThrow(/Disallowed triggerEffect key: entityStore/)
    expect(() => deserializeCombatUnitSnapshot(triggerExtraKey)).toThrow()
  })

  it('rejects mark_target with non-boolean sharedDamage on schema and deserializer', () => {
    const markBadBoolean = {
      ...baseUnit,
      abilityPrograms: [{
        id: 'p1',
        trigger: { kind: 'hit' },
        groups: [{
          selector: { kind: 'primary_target' },
          effects: [{ kind: 'mark_target', duration: 10, sharedDamage: 'bad' }],
        }],
      }],
    }
    expect(() => combatSnapshotUnitSchema.parse(markBadBoolean)).toThrow(/Invalid boolean/)
    expect(() => deserializeCombatUnitSnapshot(markBadBoolean)).toThrow()
  })

  it('rejects mark_target with non-string retargetPolicy on schema and deserializer', () => {
    const markBadPolicy = {
      ...baseUnit,
      abilityPrograms: [{
        id: 'p1',
        trigger: { kind: 'hit' },
        groups: [{
          selector: { kind: 'primary_target' },
          effects: [{ kind: 'mark_target', duration: 10, retargetPolicy: { entityStore: 123 } }],
        }],
      }],
    }
    expect(() => combatSnapshotUnitSchema.parse(markBadPolicy)).toThrow(/Invalid retargetPolicy/)
    expect(() => deserializeCombatUnitSnapshot(markBadPolicy)).toThrow()
  })

  it('rejects periodic hazard with non-array statusEffects on schema and deserializer', () => {
    const hazardBadStatuses = {
      ...baseUnit,
      periodicAbilities: [{
        id: 'pa1',
        intervalTicks: 10,
        payload: { kind: 'hazard', hazardType: 'fire', radius: 20, duration: 10, statusEffects: 'bad' },
      }],
    }
    expect(() => combatSnapshotUnitSchema.parse(hazardBadStatuses)).toThrow(/Invalid statusEffects/)
    expect(() => deserializeCombatUnitSnapshot(hazardBadStatuses)).toThrow()
  })
})
