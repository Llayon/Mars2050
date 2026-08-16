import { describe, it, expect } from 'vitest'
import {
  calculateNormalFactor,
  calculateViewSpaceSunDirection,
  CANONICAL_VIEW_SPACE_SUN,
  DEFAULT_TERRAIN_LIGHTING,
  type ViewSpaceDirection
} from '@/components/map/mars-map-lighting'
import type { MapRenderProfile } from '@/components/map/mars-map-asset.types'

describe('mars-map-lighting', () => {
  const canonicalProfile: MapRenderProfile = {
    version: 2,
    projection: 'orthographic',
    cameraPitch: 60,
    cameraYaw: 30,
    orthoScale: 12,
    cellWorldSize: 128,
    pixelsPerWorldUnit: 2,
    sunAzimuth: 135,
    sunElevation: 35,
    atlasPageSize: 2048,
    padding: 4,
    extrude: 2,
    mipmaps: false
  }

  it('calculates canonical view-space Sun direction matching Blender golden vector', () => {
    const sunDir = calculateViewSpaceSunDirection(canonicalProfile)

    expect(sunDir.x).toBeCloseTo(CANONICAL_VIEW_SPACE_SUN.x, 5)
    expect(sunDir.y).toBeCloseTo(CANONICAL_VIEW_SPACE_SUN.y, 5)
    expect(sunDir.z).toBeCloseTo(CANONICAL_VIEW_SPACE_SUN.z, 5)

    const length = Math.hypot(sunDir.x, sunDir.y, sunDir.z)
    expect(length).toBeCloseTo(1.0, 6)
  })

  it('verifies direction convention points from surface toward light source', () => {
    const sunDir = calculateViewSpaceSunDirection(canonicalProfile)
    // Sun at azimuth 135 (top-right) and elevation 35 should have positive X, positive Y, positive Z in view space
    expect(sunDir.x).toBeGreaterThan(0)
    expect(sunDir.y).toBeGreaterThan(0)
    expect(sunDir.z).toBeGreaterThan(0)
  })

  it('ensures perfectly flat normal (0, 0, 1) produces neutral normalFactor ~ 1.0', () => {
    const flatNormal: ViewSpaceDirection = { x: 0, y: 0, z: 1 }
    const sunDir = calculateViewSpaceSunDirection(canonicalProfile)

    const factor = calculateNormalFactor(flatNormal, sunDir, DEFAULT_TERRAIN_LIGHTING)
    expect(factor).toBeCloseTo(1.0, 5)
  })

  it('enhances relief when normal points toward sun and dims when facing away', () => {
    const sunDir = calculateViewSpaceSunDirection(canonicalProfile)

    // Normal tilted towards sun
    const sunFacingNormal: ViewSpaceDirection = { x: sunDir.x, y: sunDir.y, z: sunDir.z }
    const litFactor = calculateNormalFactor(sunFacingNormal, sunDir, DEFAULT_TERRAIN_LIGHTING)
    expect(litFactor).toBeGreaterThan(1.0)
    expect(litFactor).toBeLessThanOrEqual(DEFAULT_TERRAIN_LIGHTING.maxLightFactor)

    // Normal tilted away from sun
    const shadowFacingNormal: ViewSpaceDirection = { x: -sunDir.x, y: -sunDir.y, z: 0.2 }
    const shadowFactor = calculateNormalFactor(shadowFacingNormal, sunDir, DEFAULT_TERRAIN_LIGHTING)
    expect(shadowFactor).toBeLessThan(1.0)
    expect(shadowFactor).toBeGreaterThanOrEqual(DEFAULT_TERRAIN_LIGHTING.minLightFactor)
  })

  it('clamps extreme normal factors strictly within configured min/max bounds', () => {
    const sunDir = calculateViewSpaceSunDirection(canonicalProfile)
    const settings = {
      ...DEFAULT_TERRAIN_LIGHTING,
      normalStrength: 10.0,
      minLightFactor: 0.7,
      maxLightFactor: 1.3
    }

    const maxFactor = calculateNormalFactor(sunDir, sunDir, settings)
    expect(maxFactor).toBe(1.3)

    const minFactor = calculateNormalFactor({ x: -sunDir.x, y: -sunDir.y, z: -sunDir.z }, sunDir, settings)
    expect(minFactor).toBe(0.7)
  })

  it('verifies vertex shader honors Pixi local transform matrix in MVP chain', async () => {
    const { TERRAIN_VERTEX_SHADER } = await import('@/components/map/mars-map-lighting.shader')

    expect(TERRAIN_VERTEX_SHADER).toContain('uniform mat3 uTransformMatrix;')
    expect(TERRAIN_VERTEX_SHADER).toContain('uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix')
  })

  it('verifies fragment shader honors Pixi uColor for alpha and tint modulation', async () => {
    const { TERRAIN_FRAGMENT_SHADER } = await import('@/components/map/mars-map-lighting.shader')

    expect(TERRAIN_FRAGMENT_SHADER).toContain('uniform vec4 uColor;')
    expect(TERRAIN_FRAGMENT_SHADER).toContain('finalRGB * uColor.rgb')
    expect(TERRAIN_FRAGMENT_SHADER).toContain('albedo.a * uColor.a')
  })
})
