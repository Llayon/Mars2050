import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { TERRAIN_BIOMES } from '@/components/map/mars-terrain.types'
import {
  TERRAIN_BIOME_CATALOG,
  LOCATION_FEATURE_VISUALS,
  selectWeightedAsset,
  type WeightedAssetRef
} from '@/components/map/mars-terrain-catalog'
import type { MapLocationType } from '@/domains/map/map.types'

describe('mars-terrain-catalog', () => {
  it('contains complete rules for all 7 biomes', () => {
    for (const biome of TERRAIN_BIOMES) {
      const rule = TERRAIN_BIOME_CATALOG[biome]
      expect(rule).toBeDefined()
      expect(typeof rule.baseColor).toBe('number')
      expect(rule.scatterDensity).toBeGreaterThanOrEqual(0)
      expect(rule.scatterDensity).toBeLessThanOrEqual(1)
      expect(rule.macroDensity).toBeGreaterThanOrEqual(0)
      expect(rule.macroDensity).toBeLessThanOrEqual(1)

      for (const asset of [...rule.groundDecals, ...rule.macroAssets, ...rule.scatterAssets]) {
        expect(asset.id).toBeTruthy()
        expect(asset.weight).toBeGreaterThan(0)
      }
    }
  })

  it('contains valid location feature visuals for all gameplay types', () => {
    const types: MapLocationType[] = ['plains', 'mountains', 'canyon', 'crater', 'ice_cap']
    for (const type of types) {
      const refs = LOCATION_FEATURE_VISUALS[type]
      expect(Array.isArray(refs)).toBe(true)
    }
  })

  it('verifies that every catalog asset ID exists in compiled manifest and factory config', () => {
    const factoryConfigPath = path.join(process.cwd(), 'assets', 'pipeline', 'map-asset-factory.json')
    const compiledManifestPath = path.join(process.cwd(), 'public', 'assets', 'map', 'terrain-manifest.json')

    const factoryJson = JSON.parse(fs.readFileSync(factoryConfigPath, 'utf-8'))
    const compiledJson = JSON.parse(fs.readFileSync(compiledManifestPath, 'utf-8'))

    const factoryIds = new Set<string>(factoryJson.assets.map((a: { id: string }) => a.id))
    const compiledIds = new Set<string>(Object.keys(compiledJson.assets))

    // Collect all unique referenced IDs from TERRAIN_BIOME_CATALOG and LOCATION_FEATURE_VISUALS
    const referencedIds = new Set<string>()

    for (const biome of TERRAIN_BIOMES) {
      const rule = TERRAIN_BIOME_CATALOG[biome]
      for (const ref of [...rule.groundDecals, ...rule.macroAssets, ...rule.scatterAssets]) {
        referencedIds.add(ref.id)
      }
    }

    for (const type of Object.keys(LOCATION_FEATURE_VISUALS) as MapLocationType[]) {
      for (const ref of LOCATION_FEATURE_VISUALS[type]) {
        referencedIds.add(ref.id)
      }
    }

    expect(referencedIds.size).toBeGreaterThanOrEqual(10)

    for (const assetId of referencedIds) {
      expect(factoryIds.has(assetId), `Asset [${assetId}] not found in factory config`).toBe(true)
      expect(compiledIds.has(assetId), `Asset [${assetId}] not found in compiled manifest`).toBe(true)
    }
  })

  it('selectWeightedAsset deterministically picks matching asset', () => {
    const refs: WeightedAssetRef[] = [
      { id: 'asset_a', weight: 1.0 },
      { id: 'asset_b', weight: 3.0 }
    ]

    const pick1 = selectWeightedAsset(refs, 12345)
    const pick2 = selectWeightedAsset(refs, 12345)
    expect(pick1).toBe(pick2)
    expect(['asset_a', 'asset_b']).toContain(pick1)
  })

  it('handles empty list or zero weights gracefully', () => {
    expect(selectWeightedAsset([], 123)).toBeNull()
    expect(selectWeightedAsset([{ id: 'bad', weight: 0 }], 123)).toBeNull()
    expect(selectWeightedAsset([{ id: 'bad', weight: -5 }], 123)).toBeNull()
  })

  it('never selects zero-weight items', () => {
    const refs: WeightedAssetRef[] = [
      { id: 'zero_weight', weight: 0 },
      { id: 'only_valid', weight: 2.0 }
    ]

    for (let hash = 0; hash < 50; hash++) {
      expect(selectWeightedAsset(refs, hash * 7919)).toBe('only_valid')
    }
  })
})
