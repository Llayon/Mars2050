import { describe, it, expect } from 'vitest'
import path from 'path'
import { validateFactoryConfigFile, validateFactoryConfigContent } from '../../scripts/validate-map-factory'
import { findBlenderExecutable } from '../../scripts/run-map-asset-factory'

describe('map-asset-factory (Blender Factory Configuration & Pipeline)', () => {
  it('validates authoritative production factory configuration', () => {
    const configPath = path.join(process.cwd(), 'assets', 'pipeline', 'map-asset-factory.json')
    const result = validateFactoryConfigFile(configPath)

    expect(result.valid).toBe(true)
    expect(result.errors).toEqual([])
  })

  it('rejects duplicate asset IDs in factory config', () => {
    const invalidConfig = JSON.stringify({
      version: 1,
      assets: [
        {
          id: 'duplicate_id',
          layer: 'ground',
          generator: 'regolith',
          seed: 101,
          anchorPx: { x: 256, y: 256 }
        },
        {
          id: 'duplicate_id',
          layer: 'macro',
          generator: 'crater',
          seed: 102,
          anchorPx: { x: 256, y: 256 }
        }
      ]
    })

    const result = validateFactoryConfigContent(invalidConfig)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('duplicate asset id'))).toBe(true)
  })

  it('rejects legacy hex q/r coordinates in footprint', () => {
    const invalidConfig = JSON.stringify({
      version: 1,
      assets: [
        {
          id: 'hex_asset',
          layer: 'macro',
          generator: 'ridge',
          seed: 201,
          anchorPx: { x: 256, y: 256 },
          footprint: [{ q: 0, r: 0 }]
        }
      ]
    })

    const result = validateFactoryConfigContent(invalidConfig)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('forbidden legacy hex coordinates'))).toBe(true)
  })

  it('rejects invalid layers or unknown generators', () => {
    const invalidConfig = JSON.stringify({
      version: 1,
      assets: [
        {
          id: 'bad_asset',
          layer: 'invalid_layer',
          generator: 'magic_wand',
          seed: 301,
          anchorPx: { x: 256, y: 256 }
        }
      ]
    })

    const result = validateFactoryConfigContent(invalidConfig)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('invalid layer'))).toBe(true)
    expect(result.errors.some(e => e.includes('invalid generator'))).toBe(true)
  })

  it('safely probes blender executable path without throwing', () => {
    const bin = findBlenderExecutable()
    expect(bin === null || typeof bin === 'string').toBe(true)
  })

  it('correctly decodes neutral normal 128,128,255 to unit-Z vector', () => {
    const r = 128, g = 128, b = 255
    const nx = (r / 255) * 2 - 1
    const ny = (g / 255) * 2 - 1
    const nz = (b / 255) * 2 - 1
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz)

    expect(nx).toBeCloseTo(0.0039, 2)
    expect(ny).toBeCloseTo(0.0039, 2)
    expect(nz).toBeCloseTo(1.0, 4)
    expect(len).toBeCloseTo(1.0, 2)
  })
})
