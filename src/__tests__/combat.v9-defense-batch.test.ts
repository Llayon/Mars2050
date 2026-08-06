import { describe, expect, it } from 'vitest'
import { compareDamageOrder, resolveDefenseBatch, type DamageClaim, type DefenseBatchSnapshot } from '@/domains/combat/ecs/defense-batch'

const claim = (source: string, ordinal: number, rawDamage: number, target = 'unit:target'): DamageClaim => ({
  order: { originExternalId: `unit:${source}`, position: { programIndex: 0, groupIndex: 0, targetOrdinal: 0, effectIndex: ordinal }, authoredOrdinal: ordinal, targetExternalId: target, sourceExternalId: source },
  originExternalId: `unit:${source}`, authoredPosition: { programIndex: 0, groupIndex: 0, targetOrdinal: 0, effectIndex: ordinal }, authoredOrdinal: ordinal, targetExternalId: target, sourceExternalId: source,
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
    expect(compareDamageOrder({ originExternalId: 'unit:a', position: { programIndex: 0, groupIndex: 0, targetOrdinal: 0, effectIndex: 0 }, authoredOrdinal: 0, targetExternalId: 'z', sourceExternalId: 'x' }, { originExternalId: 'unit:ä', position: { programIndex: 0, groupIndex: 0, targetOrdinal: 0, effectIndex: 0 }, authoredOrdinal: 0, targetExternalId: 'a', sourceExternalId: 'x' })).toBeLessThan(0)
    expect(() => resolveDefenseBatch(frame(), [claim('a', 0, 1), claim('a', 0, 1)])).toThrow(/Duplicate damage order key/)
  })

  it('orders compiled effects by structural authored position before target and source ids', () => {
    const earlier = { originExternalId: 'ability:shared', position: { programIndex: 0, groupIndex: 1, targetOrdinal: 0, effectIndex: 2 }, targetExternalId: 'z', sourceExternalId: 'b' }
    const later = { originExternalId: 'ability:shared', position: { programIndex: 0, groupIndex: 1, targetOrdinal: 1, effectIndex: 0 }, targetExternalId: 'a', sourceExternalId: 'a' }
    expect(compareDamageOrder(earlier, later)).toBeLessThan(0)
    expect(compareDamageOrder({ ...earlier, position: { ...earlier.position, effectIndex: 1 } }, earlier)).toBeLessThan(0)
  })

  it('applies barriers only to allied covered targets', () => {
    const original = frame()
    const allied: DefenseBatchSnapshot = {
      targetsByExternalId: new Map([...original.targetsByExternalId].map(([id, target]) => [id, id === 'unit:target' ? { ...target, team: 'attacker' } : target])),
      barriersByExternalId: new Map([...original.barriersByExternalId].map(([id, barrier]) => [id, { ...barrier, team: 'defender' }])),
    }
    const result = resolveDefenseBatch(allied, [claim('a', 0, 10)])
    expect(result.claims[0]?.barrierDamage).toBe(0)
  })

  it('preserves V8 mitigation details in a singleton claim', () => {
    const base = frame({ shield: 5, capacity: 0 })
    const snapshot: DefenseBatchSnapshot = {
      targetsByExternalId: new Map([
      ['unit:target', {
        ...base.targetsByExternalId.get('unit:target')!, armor: 10, team: 'defender', rank: 2,
        statusEffects: [
          { type: 'armor_broken', duration: 3, value: 0.5, tickInterval: 0, nextTickIn: 0 },
          { type: 'revealed', duration: 3, value: 0, tickInterval: 0, nextTickIn: 0 },
        ],
        isBurrowed: true, burrowDamageReduction: 0.8,
        targetMark: { duration: 3, sourceUnitId: 'a', damageMultiplier: 0.5, executeThreshold: 1 },
      }],
      ['unit:ally', base.targetsByExternalId.get('unit:ally')!],
      ]),
      barriersByExternalId: base.barriersByExternalId,
    }
    const result = resolveDefenseBatch(snapshot, [{
      ...claim('a', 0, 30),
      targetExternalId: 'unit:target',
      attackerModifiers: { armorPierceRatio: 0, shieldDamageMult: 1, rank: 2, summonCounterDamageMult: 1, lifestealMult: 0, executeThreshold: 0 },
    }])
    expect(result.claims[0]?.shieldDamage).toBe(5)
    expect(result.claims[0]?.bonusDamage).toBeGreaterThan(0)
  })

  it('reports only shield overflow for shield-hit-block', () => {
    const result = resolveDefenseBatch(frame({ shield: 4, capacity: 0 }), [claim('a', 0, 12)])
    const breaking = result.claims.find(item => item.shieldHitBlock)
    expect(breaking?.shieldHitBlockedDamage).toBe(8)
  })
})
