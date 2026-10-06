import { afterEach, describe, expect, it, vi } from 'vitest'
import { simulateCombat, type BattleInput } from '../src/index.js'
import { deterministicCos, deterministicSin } from '../src/math/deterministic-trig.js'

// Captured IEEE-754 results, not computed with the host's native trigonometry.
const vectors = [
  [0, '0000000000000000', '3ff0000000000000'],
  [-0, '8000000000000000', '3ff0000000000000'],
  [Number.MIN_VALUE, '0000000000000001', '3ff0000000000000'],
  [1e-10, '3ddb7cdfd9d7bdbb', '3ff0000000000000'],
  [0.3, '3fd2e9cd95baba33', '3fee921dd42f09ba'],
  [Math.PI / 4, '3fe6a09e667f3bcc', '3fe6a09e667f3bcd'],
  [Math.PI / 2, '3ff0000000000000', '3c91a62633145c07'],
  [Math.PI, '3ca1a62633145c07', 'bff0000000000000'],
  [2 * Math.PI, 'bcb1a62633145c07', '3ff0000000000000'],
  [-3.0342940661740223, 'bfbb6a6f5714b9d3', 'bfefd0e3560d5e9c'],
  [1.570796326794897, '3ff0000000000000', 'bcbb9676733ae8fe'],
  [48.69468613064179, 'bff0000000000000', 'bcf08c7a80bddc93'],
  [1e6, 'bfd6664b2568d867', '3fedf9df9906d32c'],
  [1e20, 'bfe4a5e605fd6450', '3fe872720fc60d3d'],
  [1e100, 'bfd85c5e5b929359', '3fed9757496841f5'],
  [Number.MAX_VALUE, '3f7452fc98b34e97', 'bfefffe62ecfab75'],
] as const

function bits(value: number): string {
  const view = new DataView(new ArrayBuffer(8))
  view.setFloat64(0, value)
  return view.getBigUint64(0).toString(16).padStart(16, '0')
}

afterEach(() => vi.restoreAllMocks())

describe('deterministic trigonometry', () => {
  it.each(vectors)('preserves baseline bits for %s', (value, sin, cos) => {
    expect(bits(deterministicSin(value))).toBe(sin)
    expect(bits(deterministicCos(value))).toBe(cos)
    expect(Object.is(deterministicSin(-value), -deterministicSin(value))).toBe(true)
    expect(Object.is(deterministicCos(-value), deterministicCos(value))).toBe(true)
  })

  it.each([NaN, Infinity, -Infinity])('returns NaN for %s', value => {
    expect(deterministicSin(value)).toBeNaN()
    expect(deterministicCos(value)).toBeNaN()
  })

  it('does not delegate to native sin/cos, including a moving formation', () => {
    const input: BattleInput = {
      seed: 1, arena: { width: 600, height: 1200, tileSize: 40, obstacles: [] },
      rules: { maxTicks: 20, timeoutPolicy: 'draw', defenseResolutionMode: 'v9_snapshot' },
      scheduledEffects: [],
      definitions: { fighter: {
        id: 'fighter', name: 'Fighter', squadSize: 3, squadSpacing: 24, formation: 'grid',
        baseStats: {
          hp: 100, attack: 10, defense: 0, speed: 40, range: 5, attackType: 'single',
          actionCooldownMax: 10, turnSpeed: 5, size: 'M', combatTags: [],
        },
      } },
      units: [
        { instanceId: 'a', definitionId: 'fighter', team: 'attacker', rank: 1, upgradeIds: [], placement: { x: 200, y: 900 } },
        { instanceId: 'b', definitionId: 'fighter', team: 'defender', rank: 1, upgradeIds: [], placement: { x: 400, y: 300 } },
      ],
    }
    const baseline = simulateCombat(input)
    expect(baseline.logs.some(tick => tick.actions.some(action => action.type === 'move'))).toBe(true)
    const forbidden = () => { throw new Error('Native trigonometry is not deterministic across hosts') }
    const sin = vi.spyOn(Math, 'sin').mockImplementation(forbidden)
    const cos = vi.spyOn(Math, 'cos').mockImplementation(forbidden)
    for (const [value, expectedSin, expectedCos] of vectors) {
      expect(bits(deterministicSin(value))).toBe(expectedSin)
      expect(bits(deterministicCos(value))).toBe(expectedCos)
    }
    expect(simulateCombat(input)).toEqual(baseline)
    expect(sin).not.toHaveBeenCalled()
    expect(cos).not.toHaveBeenCalled()
  })
})
