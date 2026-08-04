import { describe, expect, it } from 'vitest'
import { compileAbilityDefinitions } from '@/domains/combat/combat.ability-compiler'
import { createLegacyAbilityDefinitions } from '@/domains/combat/combat.ability-legacy'
import type { UnitBaseStats } from '@/domains/combat/combat.types'

describe('declarative ability compiler', () => {
  it('compiles legacy hit effects into a stable program', () => {
    const stats: UnitBaseStats = {
      hp: 10, attack: 4, defense: 1, speed: 3, range: 2, attackType: 'single',
      statusOnHit: [{ type: 'burn', duration: 30, value: 3 }],
      knockbackOnHit: { radius: 2, strength: 1, maxTargets: 2 },
    }
    const program = compileAbilityDefinitions(createLegacyAbilityDefinitions('test', stats))
      .find(candidate => candidate.id === 'test:legacy:on_hit')!
    expect(program.id).toBe('test:legacy:on_hit')
    expect(program.trigger.kind).toBe('hit')
    expect(program.groups).toHaveLength(1)
    expect(program.groups[0].effects[0]).toMatchObject({ kind: 'apply_status', status: 'burn' })

    const geometryProgram = compileAbilityDefinitions(createLegacyAbilityDefinitions('test', stats))
      .find(candidate => candidate.id === 'test:legacy:geometry')!
    expect(geometryProgram.groups).toHaveLength(1)
    expect(geometryProgram.groups[0].selector).toMatchObject({ kind: 'primary_target' })
    expect(geometryProgram.groups[0].effects[0]).toMatchObject({ kind: 'legacy_geometry', geometry: 'displacement' })
  })

  it('sorts compiled programs deterministically by priority and id', () => {
    const definitions = [
      { id: 'z', trigger: { kind: 'hit' as const }, priority: 1, effects: [] },
      { id: 'a', trigger: { kind: 'hit' as const }, priority: 1, effects: [] },
    ]
    expect(compileAbilityDefinitions(definitions).map(program => program.id)).toEqual(['a', 'z'])
  })
})
