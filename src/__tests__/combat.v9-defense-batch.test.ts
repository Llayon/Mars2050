import { describe, expect, it } from 'vitest'
import { compareDamageOrder, resolveDefenseBatch, type DamageClaim, type DefenseBatchSnapshot } from '@/domains/combat/ecs/defense-batch'

const claim = (source: string, ordinal: number, rawDamage: number, target = 'unit:target'): DamageClaim => ({
  order: { originExternalId: `unit:${source}`, authoredOrdinal: ordinal, targetExternalId: target, sourceExternalId: source },
  originExternalId: `unit:${source}`, authoredOrdinal: ordinal, targetExternalId: target, sourceExternalId: source,
  rawDamage, attackerModifiers: { shieldDamageMult: 1 }, sourceAliveAtGroupStart: true,
})

function frame(overrides: Partial<{ shield: number; capacity: number; reduction: number }> = {}): DefenseBatchSnapshot {
  return {
    targetsByExternalId: new Map([
      ['unit:target', { externalId: 'unit:target', hp: 100, armor: 0, shield: overrides.shield ?? 10, shieldHitBlockCharges: 1, reactiveArmorCharges: 1, reactiveArmorBlock: 3 }],
      ['unit:ally', { externalId: 'unit:ally', hp: 100, armor: 0 }],
    ]),
    barriersByExternalId: new Map([['barrier:a', { externalId: 'barrier:a', capacity: overrides.capacity ?? 5, damageReduction: overrides.reduction ?? 0, coveredTargetExternalIds: ['unit:target'] }]]),
  }
}

describe('V9 defense batch resolver', () => {
  it('uses canonical order independent of claim input order and shares a shield budget', () => {
    const claims = [claim('b', 0, 8), claim('a', 0, 8)]
    const first = resolveDefenseBatch(frame(), claims)
    const second = resolveDefenseBatch(frame(), [...claims].reverse())
    expect(second).toEqual(first)
    expect(first.shieldByExternalId.get('unit:target')).toBe(0)
    expect(first.claims.filter(item => item.shieldHitBlock)).toHaveLength(1)
  })

  it('keeps barrier reduction active after shared capacity is exhausted', () => {
    const result = resolveDefenseBatch(frame({ capacity: 1, reduction: 0.5 }), [claim('a', 0, 10), claim('b', 1, 10)])
    expect(result.claims[1]?.barrierBlockedDamage).toBe(0)
    expect(result.claims[1]?.mitigatedDamage).toBe(5)
  })

  it('compares external ids by code unit and rejects duplicate keys', () => {
    expect(compareDamageOrder({ originExternalId: 'unit:a', authoredOrdinal: 0, targetExternalId: 'z', sourceExternalId: 'x' }, { originExternalId: 'unit:ä', authoredOrdinal: 0, targetExternalId: 'a', sourceExternalId: 'x' })).toBeLessThan(0)
    expect(() => resolveDefenseBatch(frame(), [claim('a', 0, 1), claim('a', 0, 1)])).toThrow(/Duplicate damage order key/)
  })
})
