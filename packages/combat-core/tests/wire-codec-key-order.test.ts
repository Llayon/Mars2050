import { describe, expect, it } from 'vitest'
import { combatSnapshotUnitSchema } from '../src/contracts/index.js'
import { deserializeCombatUnitSnapshot, serializeCombatUnitSnapshot } from '../src/replay/legacy-wire-codec.js'

const base = { id: 'u1', team: 'attacker', type: 'fighter', x: 100, y: 200, hp: 100, maxHp: 100 }

const program = {
  id: 'fighter:on_hit', trigger: { kind: 'hit' }, priority: 0,
  groups: [{ selector: { kind: 'primary_target' }, effects: [{ kind: 'apply_status', status: 'burn', duration: 10, value: 2 }] }],
}

const configurations = {
  abilityPrograms: [program],
  periodicAbilities: [{
    id: 'mark', initialDelayTicks: 0, intervalTicks: 10, targetPolicy: 'nearest_enemy',
    payload: { kind: 'mark', mark: { duration: 10, damageMultiplier: 1.2 }, radius: 20 },
  }],
  triggerEffects: [{
    id: 'rebuild', cooldownTicks: 10, event: 'death',
    payload: { target: 'self', kind: 'delayed_reassembly', hpPercent: 0.5, delayTicks: 5 },
  }],
  formationModifiers: { adjacencyBonus: { maxStacks: 3, radius: 50 }, spacingMultiplier: 1.2 },
  rankScaling: { damageModifiers: [{ multiplier: 1.2, relation: 'higher_rank' }], hpMultPerRank: 0.1 },
  fieldEffect: [{
    id: 'field', kind: 'hazard_field', statusEffects: [{ duration: 10, type: 'burn' }], radius: 30, intervalTicks: 10,
  }],
}

describe('legacy wire key-order preservation', () => {
  it.each(Object.entries(configurations))('preserves %s bytes through serialization and JSON decode', (key, value) => {
    const raw = { ...base, [key]: value }
    expect(combatSnapshotUnitSchema.safeParse(raw).success).toBe(true)
    const expected = JSON.stringify(raw)
    const serialized = serializeCombatUnitSnapshot(raw)
    expect(JSON.stringify(serialized)).toBe(expected)
    const parsed = JSON.parse(expected)
    expect(JSON.stringify(deserializeCombatUnitSnapshot(parsed))).toBe(expected)
  })

  it('keeps allowed key order without restoring internal fields or shared references', () => {
    const polluted = structuredClone(program)
    const raw = {
      ...base,
      abilityPrograms: [{
        ...polluted, entityStore: { ptr: 123 },
        groups: polluted.groups.map(group => ({ ...group, _privateWorldRef: { ptr: 456 } })),
      }],
    }
    const serialized = serializeCombatUnitSnapshot(raw)
    const expected = JSON.stringify({ ...base, abilityPrograms: [program] })
    expect(JSON.stringify(serialized)).toBe(expected)
    expect(combatSnapshotUnitSchema.safeParse(serialized).success).toBe(true)
    raw.abilityPrograms[0].groups[0].effects[0].value = 999
    expect(JSON.stringify(serialized)).toBe(expected)
  })
})
