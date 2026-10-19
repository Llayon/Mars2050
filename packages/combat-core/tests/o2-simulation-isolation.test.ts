import { describe, expect, it } from 'vitest'
import { simulateCombat } from '../src/facade/combat-facade.js'
import { createUnit, deepFreeze, hash, json, largeBattle, runTicks, smallBattle } from './o2-fixtures.js'
import type { BattleInput } from '../src/contracts/index.js'

/**
 * O2 public-API guards: removing per-tick temporaries must not change results, must not let a
 * rejected run contaminate the next one, must not alias working memory into results, and must
 * tolerate a deeply frozen input.
 */

describe('O2: public simulation determinism and buffer isolation', () => {
  it('repeats identically for the same input and seed', () => {
    const first = simulateCombat(smallBattle())
    const second = simulateCombat(smallBattle())
    expect(hash(second)).toBe(hash(first))
  })

  it('accepts a deeply frozen input without mutating it', () => {
    const expected = hash(simulateCombat(smallBattle()))
    const frozen = deepFreeze(structuredClone(smallBattle()))
    const before = json(frozen)
    const result = simulateCombat(frozen)
    expect(json(frozen)).toBe(before)
    expect(hash(result)).toBe(expected)
  })

  it('keeps the first battle result intact after small -> large -> small', () => {
    const first = simulateCombat(smallBattle())
    const firstSnapshot = json(first)
    const reference = simulateCombat(smallBattle())
    for (let round = 0; round < 3; round += 1) simulateCombat(largeBattle(16))
    const second = simulateCombat(smallBattle())
    expect(json(first)).toBe(firstSnapshot)
    expect(hash(second)).toBe(hash(reference))
  })

  it('keeps a large battle result intact across the reverse small -> large -> large order', () => {
    simulateCombat(smallBattle())
    const large = simulateCombat(largeBattle(16))
    const largeSnapshot = json(large)
    const reference = simulateCombat(largeBattle(16))
    simulateCombat(smallBattle())
    simulateCombat(largeBattle(16))
    expect(json(large)).toBe(largeSnapshot)
    expect(hash(simulateCombat(largeBattle(16)))).toBe(hash(reference))
  })

  it('does not let a rejected run contaminate the next one', () => {
    const reference = simulateCombat(smallBattle())
    const broken = largeBattle(16)
    broken.units[0] = createUnit('a0', 'missing-definition', 'attacker', 200, 900)
    expect(() => simulateCombat(broken)).toThrow()
    expect(() => simulateCombat({ ...smallBattle(), seed: Number.NaN } as BattleInput)).toThrow()
    expect(hash(simulateCombat(smallBattle()))).toBe(hash(reference))
  })

  it('keeps two catalogs that share definition ids independent', () => {
    const weak = simulateCombat(largeBattle(4))
    const strong = simulateCombat(largeBattle(40))
    expect(hash(weak)).not.toBe(hash(strong))
    expect(hash(simulateCombat(largeBattle(4)))).toBe(hash(weak))
    expect(hash(simulateCombat(largeBattle(40)))).toBe(hash(strong))
  })

  it('returns pure data that never aliases a working buffer', () => {
    const result = simulateCombat(largeBattle(16))
    expect(JSON.parse(json(result))).toEqual(JSON.parse(json(result)))
    const snapshot = json(result)
    simulateCombat(largeBattle(16))
    expect(json(result)).toBe(snapshot)
    expect(Array.isArray(result.survivors)).toBe(true)
    expect(Array.isArray(result.logs)).toBe(true)
    if (result.survivors.length > 1) expect(result.survivors[0]).not.toBe(result.survivors[1])
    if (result.logs.length > 1) expect(result.logs[0]).not.toBe(result.logs[1])
  })

  it('produces the same result when a live runtime world is reused for probing', () => {
    const input = largeBattle(16)
    const reference = simulateCombat(input)
    runTicks(input, 3)
    expect(hash(simulateCombat(input))).toBe(hash(reference))
  })
})
