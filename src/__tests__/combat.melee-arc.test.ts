import { describe, expect, it } from 'vitest'
import { getSizeRadius } from '@/domains/combat/combat.utils'
import {
  getMeleeSectorSpan,
  getMeleeSlotCenterAngle,
  getPreferredMeleeSlot,
  MELEE_ARC_QUANTA,
} from '@/domains/combat/ecs/melee-arc'

const SIZES = ['S', 'M', 'L', 'XL'] as const

describe('melee reserved-slot arc geometry', () => {
  it('preserves sector spans for every unit and target size pair', () => {
    for (const unitSize of SIZES) {
      for (const targetSize of SIZES) {
        const unitRadius = getSizeRadius(unitSize)
        const targetRadius = getSizeRadius(targetSize)
        const raw = Math.floor((2 * Math.PI * (targetRadius + unitRadius)) / (unitRadius * 2))
        const desired = Math.max(4, Math.min(12, raw))
        const slots = Math.floor(MELEE_ARC_QUANTA / Math.ceil(MELEE_ARC_QUANTA / desired))
        const expected = Math.max(1, Math.ceil(MELEE_ARC_QUANTA / slots))
        expect(getMeleeSectorSpan(unitRadius, targetRadius)).toBe(expected)
      }
    }
  })

  it.each([
    ['zero', 0, 22],
    ['quarter turn', Math.PI / 2, 4],
    ['half turn', Math.PI, 10],
    ['negative quarter turn', -Math.PI / 2, 16],
    ['almost full turn', Math.PI * 2 - 1e-9, 21],
  ])('maps %s approach to the legacy preferred slot', (_name, angle, expected) => {
    expect(getPreferredMeleeSlot(angle, 4)).toBe(expected)
  })

  it('wraps preferred slots and preserves slot-center angle arithmetic', () => {
    expect(getPreferredMeleeSlot(0, 7)).toBe(21)
    expect(getPreferredMeleeSlot(Math.PI * 2 - 1e-9, 7)).toBe(20)
    expect(getMeleeSlotCenterAngle(0, 4)).toBeCloseTo(Math.PI / 6)
    expect(getMeleeSlotCenterAngle(23, 4)).toBeCloseTo((25 / 12) * Math.PI)
  })
})
