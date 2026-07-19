import { describe, expect, it } from 'vitest'
import { processPreActionPrimitives } from '@/domains/combat/combat.tick-primitives'

describe('combat tick primitives', () => {
  it('runs pre-action runtime phases in deterministic order', () => {
    const phases: string[] = []

    processPreActionPrimitives({
      runGlobals: () => phases.push('globals'),
      runSupportAuras: () => phases.push('support-auras'),
      runGrowthAndCharge: () => phases.push('growth-and-charge'),
      runBurrowRegeneration: () => phases.push('burrow-regeneration'),
      runTransformModes: () => phases.push('transform-modes'),
      runFieldEffects: () => phases.push('field-effects'),
      runFormationBonuses: () => phases.push('formation-bonuses'),
      runControlBeams: () => phases.push('control-beams'),
      runPeriodicAbilities: () => phases.push('periodic-abilities'),
    })

    expect(phases).toEqual([
      'globals',
      'support-auras',
      'growth-and-charge',
      'burrow-regeneration',
      'transform-modes',
      'field-effects',
      'formation-bonuses',
      'control-beams',
      'periodic-abilities',
    ])
  })
})
