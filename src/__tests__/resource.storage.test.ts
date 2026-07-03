import { describe, expect, it } from 'vitest'
import { calculateResourceCapacities, applyResourceDeltaWithCap } from '@/domains/resource/resource.storage'
import type { BuildingRow } from '@/domains/building/building.types'

const baseBuilding: BuildingRow = {
  id: 'storage-1',
  colony_id: 'colony-1',
  type: 'storage_depot',
  name: 'Storage',
  level: 1,
  is_active: true,
  x: 0,
  y: 0,
  staffing_mode: 'auto',
  assigned_workers: 0,
  work_priority: 'normal',
  paused: false,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
}

describe('resource storage caps', () => {
  it('adds active storage building capacity by level', () => {
    const capacities = calculateResourceCapacities([
      baseBuilding,
      { ...baseBuilding, id: 'storage-2', level: 2 },
    ])

    expect(capacities.minerals).toBe(2500)
    expect(capacities.nanomaterials).toBe(375)
  })

  it('ignores inactive storage buildings', () => {
    const capacities = calculateResourceCapacities([{ ...baseBuilding, is_active: false }])

    expect(capacities.minerals).toBe(1000)
  })

  it('caps positive and negative deltas inside storage bounds', () => {
    expect(applyResourceDeltaWithCap(990, 1000, 30)).toBe(1000)
    expect(applyResourceDeltaWithCap(10, 1000, -30)).toBe(0)
  })

  it('preserves legacy over-cap stock without allowing more growth', () => {
    expect(applyResourceDeltaWithCap(1500, 1000, 100)).toBe(1500)
    expect(applyResourceDeltaWithCap(1500, 1000, -100)).toBe(1400)
  })
})
