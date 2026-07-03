import { BUILDING_TYPES } from '@/domains/building/building.config'
import type { BuildingRow } from '@/domains/building/building.types'
import { isResourceTypeKey, RESOURCE_TYPES, type ResourceTypeKey } from './resource.types'

export type ResourceCapacityMap = Record<ResourceTypeKey, number>

export const BASE_RESOURCE_CAPACITY: ResourceCapacityMap = {
  oxygen: 1000,
  water: 1000,
  energy: 1000,
  minerals: 1000,
  food: 1000,
  research_points: 500,
  consumer_goods: 300,
  rare_metals: 300,
  databanks: 300,
  nanomaterials: 150,
}

function emptyCapacityMap(): ResourceCapacityMap {
  return RESOURCE_TYPES.reduce<ResourceCapacityMap>((acc, type) => {
    acc[type] = BASE_RESOURCE_CAPACITY[type]
    return acc
  }, {} as ResourceCapacityMap)
}

export function getBaseResourceCapacity(type: string): number {
  return isResourceTypeKey(type) ? BASE_RESOURCE_CAPACITY[type] : 0
}

export function calculateResourceCapacities(
  buildings: Pick<BuildingRow, 'type' | 'level' | 'is_active'>[],
): ResourceCapacityMap {
  const capacities = emptyCapacityMap()

  for (const building of buildings) {
    if (!building.is_active) continue
    const storage = BUILDING_TYPES[building.type]?.storage
    if (!storage) continue

    const level = Math.max(1, building.level || 1)
    for (const [type, amount] of Object.entries(storage)) {
      if (isResourceTypeKey(type)) capacities[type] += (amount || 0) * level
    }
  }

  return capacities
}

export function capResourceAmount(amount: number, capacity: number): number {
  return Math.max(0, Math.min(amount, capacity))
}

export function applyResourceDeltaWithCap(amount: number, capacity: number, delta: number): number {
  return capResourceAmount(amount + delta, Math.max(amount, capacity))
}
