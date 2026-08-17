import type { MapRenderProfile } from './mars-map-asset.types'

export interface ViewSpaceDirection {
  x: number
  y: number
  z: number
}

export interface TerrainLightingSettings {
  normalStrength: number
  aoStrength: number
  aoFloor: number
  emissiveStrength: number
  minLightFactor: number
  maxLightFactor: number
}

export type TerrainLightingMode = 'baked' | 'enhanced'
export type TerrainDebugMode = 'off' | 'normal' | 'data'

export interface TerrainCertificationOptions {
  lightingMode: TerrainLightingMode
  debugMode: TerrainDebugMode
}

export function isTerrainCertificationEnabled(): boolean {
  if (typeof window === 'undefined') return false
  return (
    process.env.NEXT_PUBLIC_TERRAIN_CERTIFICATION === '1' ||
    process.env.NEXT_PUBLIC_E2E_AUTH_BYPASS === '1' ||
    process.env.NODE_ENV !== 'production'
  )
}

export function terrainDebugModeToShaderId(mode: TerrainDebugMode): number {
  if (mode === 'normal') return 2
  if (mode === 'data') return 3
  return 0
}

export function readTerrainCertificationOptions(): TerrainCertificationOptions {
  if (!isTerrainCertificationEnabled()) {
    return { lightingMode: 'enhanced', debugMode: 'off' }
  }
  try {
    const params = new URLSearchParams(window.location.search)
    const rawLighting = params.get('terrainLighting')
    const rawDebug = params.get('terrainDebug')

    const lightingMode: TerrainLightingMode =
      rawLighting === 'baked' || rawLighting === 'enhanced' ? rawLighting : 'enhanced'
    const debugMode: TerrainDebugMode =
      rawDebug === 'normal' || rawDebug === 'data' || rawDebug === 'off' ? rawDebug : 'off'

    return { lightingMode, debugMode }
  } catch {
    return { lightingMode: 'enhanced', debugMode: 'off' }
  }
}

export const DEFAULT_TERRAIN_LIGHTING: TerrainLightingSettings = {
  normalStrength: 0.25,
  aoStrength: 0.20,
  aoFloor: 0.85,
  emissiveStrength: 0.0,
  minLightFactor: 0.80,
  maxLightFactor: 1.20
}

/**
 * Exact golden view-space Sun direction for the canonical render profile:
 * cameraPitch: 60, cameraYaw: 30, sunAzimuth: 135, sunElevation: 35.
 * Verified against Blender 5.1 camera/light world transform.
 */
export const CANONICAL_VIEW_SPACE_SUN: ViewSpaceDirection = {
  x: 0.79124016,
  y: 0.47039616,
  z: 0.39072567
}

/**
 * Calculates normalized view-space Sun direction from MapRenderProfile.
 * Mirrors the exact camera and directional Sun Euler transform from Blender Asset Factory.
 * 
 * Direction convention: Vector points FROM surface TOWARD light source.
 */
export function calculateViewSpaceSunDirection(profile: MapRenderProfile): ViewSpaceDirection {
  const deg2rad = (deg: number) => (deg * Math.PI) / 180

  const cameraPitch = profile.cameraPitch ?? 60
  const cameraYaw = profile.cameraYaw ?? 0
  const sunAzimuth = profile.sunAzimuth ?? 135
  const sunElevation = profile.sunElevation ?? 45

  // Sun world direction pointing toward the light
  const phiS = deg2rad(90 - sunElevation)
  const psiS = deg2rad(sunAzimuth)
  const xw = Math.sin(phiS) * Math.sin(psiS)
  const yw = -Math.sin(phiS) * Math.cos(psiS)
  const zw = Math.cos(phiS)

  // Camera world-to-view inverse rotation
  const phiC = deg2rad(90 - cameraPitch)
  const psiC = deg2rad(cameraYaw)

  // Rz(-psiC)
  const x1 = xw * Math.cos(psiC) + yw * Math.sin(psiC)
  const y1 = -xw * Math.sin(psiC) + yw * Math.cos(psiC)
  const z1 = zw

  // Rx(-phiC)
  const xv = x1
  const yv = y1 * Math.cos(phiC) + z1 * Math.sin(phiC)
  const zv = -y1 * Math.sin(phiC) + z1 * Math.cos(phiC)

  const len = Math.hypot(xv, yv, zv) || 1
  return {
    x: xv / len,
    y: yv / len,
    z: zv / len
  }
}

/**
 * Pure helper for zero-centered normal factor calculation.
 */
export function calculateNormalFactor(
  normal: ViewSpaceDirection,
  lightDir: ViewSpaceDirection,
  settings: TerrainLightingSettings = DEFAULT_TERRAIN_LIGHTING
): number {
  const nLen = Math.hypot(normal.x, normal.y, normal.z) || 1
  const nx = normal.x / nLen
  const ny = normal.y / nLen
  const nz = normal.z / nLen

  const lLen = Math.hypot(lightDir.x, lightDir.y, lightDir.z) || 1
  const lx = lightDir.x / lLen
  const ly = lightDir.y / lLen
  const lz = lightDir.z / lLen

  const lambert = Math.max(nx * lx + ny * ly + nz * lz, 0.0)
  const flatLambert = Math.max(0.0 * lx + 0.0 * ly + 1.0 * lz, 0.001)

  const normalDelta = lambert - flatLambert
  const rawFactor = 1.0 + normalDelta * settings.normalStrength
  return Math.min(Math.max(rawFactor, settings.minLightFactor), settings.maxLightFactor)
}
