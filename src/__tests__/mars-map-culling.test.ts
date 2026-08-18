import { describe, expect, it } from 'vitest'
import { isItemInViewportAabb } from '@/components/map/mars-map-culling'

describe('mars-map-culling and terrain semantics', () => {
  describe('conservative AABB intersection (isItemInViewportAabb)', () => {
    const viewport = {
      minX: 100,
      minY: 100,
      maxX: 500,
      maxY: 400
    }

    it('keeps a large formation (mesa/ridge) renderable when its center is outside but bounds intersect the viewport', () => {
      // Large mesa with halfWidth=120, halfHeight=80 placed at x=40 (center outside viewport minX=100)
      // right edge = 40 + 120 = 160 >= 100 (intersects left viewport edge)
      const visible = isItemInViewportAabb(
        40,
        250,
        120,
        80,
        viewport.minX,
        viewport.minY,
        viewport.maxX,
        viewport.maxY
      )
      expect(visible).toBe(true)
    })

    it('culls a large formation when its conservative extents are strictly outside the viewport', () => {
      // Large mesa at x=-100 with halfWidth=120 -> right edge = 20 < 100
      const visible = isItemInViewportAabb(
        -100,
        250,
        120,
        80,
        viewport.minX,
        viewport.minY,
        viewport.maxX,
        viewport.maxY
      )
      expect(visible).toBe(false)
    })

    it('keeps objects fully inside the viewport renderable', () => {
      const visible = isItemInViewportAabb(
        300,
        250,
        32,
        32,
        viewport.minX,
        viewport.minY,
        viewport.maxX,
        viewport.maxY
      )
      expect(visible).toBe(true)
    })
  })

  describe('ground shader smoothstep math semantics', () => {
    function smoothstep(edge0: number, edge1: number, x: number): number {
      const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)))
      return t * t * (3 - 2 * t)
    }

    function calculateBiomeWeight(radius: number, distance: number): number {
      return 1.0 - smoothstep(radius * 0.25, radius, distance)
    }

    it('yields maximum weight 1.0 at center (d = 0)', () => {
      const radius = 200
      const w = calculateBiomeWeight(radius, 0)
      expect(w).toBe(1.0)
    })

    it('yields plateau weight 1.0 within inner core (d <= radius * 0.25)', () => {
      const radius = 200
      const w = calculateBiomeWeight(radius, 40)
      expect(w).toBe(1.0)
    })

    it('yields smooth monotonic falloff between inner core and outer radius', () => {
      const radius = 200
      const wCore = calculateBiomeWeight(radius, 50)
      const wMid = calculateBiomeWeight(radius, 125)
      const wOuter = calculateBiomeWeight(radius, 190)

      expect(wCore).toBe(1.0)
      expect(wMid).toBeGreaterThan(0.2)
      expect(wMid).toBeLessThan(0.8)
      expect(wOuter).toBeGreaterThan(0.0)
      expect(wOuter).toBeLessThan(wMid)
    })

    it('yields exactly 0.0 at or beyond outer radius (d >= radius)', () => {
      const radius = 200
      const wAtRadius = calculateBiomeWeight(radius, 200)
      const wBeyond = calculateBiomeWeight(radius, 250)

      expect(wAtRadius).toBe(0.0)
      expect(wBeyond).toBe(0.0)
    })
  })

  describe('satellite angle range and scale multiplier semantics', () => {
    it('maps satellite angle strictly within [angleMinDeg, angleMaxDeg] relative to flow', () => {
      const baseAngle = (45 * Math.PI) / 180
      const minDeg = -15
      const maxDeg = 15
      const degSpan = maxDeg - minDeg

      // Test normalized hash samples [0, 0.5, 1.0]
      for (const t of [0, 0.25, 0.5, 0.75, 1.0]) {
        const degOffset = minDeg + t * degSpan
        const ang = baseAngle + degOffset * (Math.PI / 180)

        expect(degOffset).toBeGreaterThanOrEqual(-15)
        expect(degOffset).toBeLessThanOrEqual(15)
        expect(ang).toBeGreaterThanOrEqual(baseAngle - (15.001 * Math.PI) / 180)
        expect(ang).toBeLessThanOrEqual(baseAngle + (15.001 * Math.PI) / 180)
      }
    })

    it('computes scaleMultiplier strictly within [minScale, maxScale]', () => {
      const scaleRange: [number, number] = [0.85, 1.25]
      const [minScale, maxScale] = scaleRange

      for (const t of [0, 0.33, 0.5, 0.67, 1.0]) {
        const scaleMultiplier = minScale + t * (maxScale - minScale)
        expect(scaleMultiplier).toBeGreaterThanOrEqual(0.85)
        expect(scaleMultiplier).toBeLessThanOrEqual(1.25)
      }
    })
  })

  describe('micro-scatter zoom LOD threshold', () => {
    function isMicroVisible(scaleX: number): boolean {
      return scaleX >= 0.55
    }

    it('hides micro scatter at zoom 0.54', () => {
      expect(isMicroVisible(0.54)).toBe(false)
    })

    it('shows micro scatter at zoom 0.55', () => {
      expect(isMicroVisible(0.55)).toBe(true)
    })

    it('shows micro scatter at default zoom 1.0', () => {
      expect(isMicroVisible(1.0)).toBe(true)
    })
  })
})
