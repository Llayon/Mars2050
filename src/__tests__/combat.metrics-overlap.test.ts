import { describe, expect, it } from 'vitest'
import { collectOverlapMetrics, type OverlapMetricUnit, type OverlapMetricsDelta } from '@/domains/combat/combat.metrics-overlap'
import { getSizeRadius } from '@/domains/combat/combat.utils'

function unit(x: number, y: number, overrides: Partial<OverlapMetricUnit> = {}): OverlapMetricUnit {
  return {
    x,
    y,
    isDead: false,
    isFlying: false,
    size: 'S',
    ...overrides,
  }
}

describe('combat metrics overlap collector', () => {
  it('matches the naive pair collector for mixed unit sizes', () => {
    const units: OverlapMetricUnit[] = [
      unit(0, 0, { size: 'S' }),
      unit(8, 0, { size: 'M' }),
      unit(70, 0, { size: 'L' }),
      unit(73, 0, { size: 'XL' }),
      unit(400, 400, { size: 'XL' }),
      unit(8, 0, { isFlying: true, size: 'M' }),
      unit(9, 0, { isFlying: true, size: 'L' }),
      unit(0, 0, { isDead: true }),
    ]

    expectOverlapDelta(collectOverlapMetrics(units), collectNaiveOverlapMetrics(units))
  })

  it('counts overlapping pairs across bucket boundaries', () => {
    const metrics = collectOverlapMetrics([
      unit(85.4, 0, { size: 'XL' }),
      unit(85.6, 0, { size: 'XL' }),
    ])

    expect(metrics.overlapSamples).toBe(1)
    expect(metrics.maxOverlap).toBeCloseTo(85.3)
    expect(metrics.severeOverlapSamples).toBe(1)
  })

  it('ignores far pairs in non-neighbor buckets', () => {
    const metrics = collectOverlapMetrics([
      unit(0, 0, { size: 'XL' }),
      unit(300, 0, { size: 'XL' }),
    ])

    expect(metrics.overlapSamples).toBe(0)
    expect(metrics.totalOverlap).toBe(0)
  })

  it('does not mix flying and ground pairs', () => {
    const metrics = collectOverlapMetrics([
      unit(0, 0),
      unit(0, 0, { isFlying: true }),
    ])

    expect(metrics.overlapSamples).toBe(0)
  })

  it('counts each overlapping pair once', () => {
    const metrics = collectOverlapMetrics([
      unit(0, 0),
      unit(0, 0),
      unit(0, 0),
    ])

    expect(metrics.overlapSamples).toBe(3)
  })
})

function collectNaiveOverlapMetrics(units: OverlapMetricUnit[]): OverlapMetricsDelta {
  const delta: OverlapMetricsDelta = {
    totalOverlap: 0,
    totalOverlapRatio: 0,
    overlapSamples: 0,
    maxOverlap: 0,
    maxOverlapRatio: 0,
    severeOverlapSamples: 0,
  }
  const alive = units.filter(item => !item.isDead)

  for (let i = 0; i < alive.length; i++) {
    for (let j = i + 1; j < alive.length; j++) {
      const first = alive[i]
      const second = alive[j]
      if (first.isFlying !== second.isFlying) continue

      const minDistance = (getSizeRadius(first.size) + getSizeRadius(second.size)) * 0.95
      const overlap = Math.max(0, minDistance - Math.hypot(first.x - second.x, first.y - second.y))
      if (overlap <= 0) continue

      const overlapRatio = overlap / minDistance
      delta.totalOverlap += overlap
      delta.totalOverlapRatio += overlapRatio
      delta.overlapSamples++
      delta.maxOverlap = Math.max(delta.maxOverlap, overlap)
      delta.maxOverlapRatio = Math.max(delta.maxOverlapRatio, overlapRatio)
      if (overlapRatio >= 0.5) delta.severeOverlapSamples++
    }
  }

  return delta
}

function expectOverlapDelta(actual: OverlapMetricsDelta, expected: OverlapMetricsDelta): void {
  expect(actual.overlapSamples).toBe(expected.overlapSamples)
  expect(actual.severeOverlapSamples).toBe(expected.severeOverlapSamples)
  expect(actual.maxOverlap).toBeCloseTo(expected.maxOverlap)
  expect(actual.maxOverlapRatio).toBeCloseTo(expected.maxOverlapRatio)
  expect(actual.totalOverlap).toBeCloseTo(expected.totalOverlap)
  expect(actual.totalOverlapRatio).toBeCloseTo(expected.totalOverlapRatio)
}
