import { describe, expect, it } from 'vitest'
import { createPathfindingMap, getFlowVector } from '@/domains/combat/combat.pathfinding'

describe('combat pathfinding', () => {
  it('routes around a convex obstacle instead of pointing straight through it', () => {
    const map = createPathfindingMap([{ x: 300, y: 600, radius: 80 }])

    const angle = getFlowVector(map, 300, 760, 300, 440)

    expect(angle).not.toBeNull()
    expect(Math.abs(Math.cos(angle ?? 0))).toBeGreaterThan(0.1)
  })

  it('caches vector fields per target cell', () => {
    const map = createPathfindingMap([{ x: 300, y: 600, radius: 60 }])

    getFlowVector(map, 120, 900, 480, 300)
    getFlowVector(map, 160, 860, 480, 300)

    expect(map.vectorFields.size).toBe(1)
  })

  it('returns a deterministic fallback angle from an impassable start cell', () => {
    const map = createPathfindingMap([{ x: 300, y: 600, radius: 100 }])

    const angle = getFlowVector(map, 300, 600, 500, 800)

    expect(angle).not.toBeNull()
    expect(Number.isFinite(angle)).toBe(true)
  })
})
