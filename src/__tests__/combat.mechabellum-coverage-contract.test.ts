import { describe, expect, it } from 'vitest'
import { MECHABELLUM_TECH_COVERAGE, MECHABELLUM_TECH_NAMES } from '@/domains/combat/combat.primitive-coverage'

describe('Mechabellum detailed primitive coverage contract', () => {
  it('tracks every technology name from the detailed analysis fixture', () => {
    expect(Object.keys(MECHABELLUM_TECH_COVERAGE).sort()).toEqual([...MECHABELLUM_TECH_NAMES].sort())
  })

  it('keeps every tracked technology explicitly classified', () => {
    const allowed = new Set(['implemented', 'implemented-by-existing-primitive', 'primitive-covered', 'deferred'])
    for (const [name, status] of Object.entries(MECHABELLUM_TECH_COVERAGE)) {
      expect(allowed.has(status), name).toBe(true)
    }
  })

  it('does not leave detailed-analysis technologies deferred after this primitive slice', () => {
    const deferred = Object.entries(MECHABELLUM_TECH_COVERAGE).filter(([, status]) => status === 'deferred')
    expect(deferred).toEqual([])
  })
})
