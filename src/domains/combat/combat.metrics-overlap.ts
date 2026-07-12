import { getSizeRadius } from './combat.utils'

export interface OverlapMetricUnit {
  x: number
  y: number
  isDead: boolean
  isFlying: boolean
  size: 'S' | 'M' | 'L' | 'XL'
}

export interface OverlapMetricsDelta {
  totalOverlap: number
  totalOverlapRatio: number
  overlapSamples: number
  maxOverlap: number
  maxOverlapRatio: number
  severeOverlapSamples: number
}

interface IndexedOverlapUnit extends OverlapMetricUnit {
  index: number
}

const MAX_OVERLAP_DISTANCE = (getSizeRadius('XL') + getSizeRadius('XL')) * 0.95
const NEIGHBOR_OFFSETS = [-1, 0, 1] as const

export function collectOverlapMetrics(units: OverlapMetricUnit[]): OverlapMetricsDelta {
  const buckets = new Map<string, IndexedOverlapUnit[]>()
  for (let index = 0; index < units.length; index++) {
    const unit = units[index]
    if (unit.isDead) continue
    const bucket = buckets.get(getBucketKey(unit.x, unit.y))
    const indexedUnit = { ...unit, index }
    if (bucket) bucket.push(indexedUnit)
    else buckets.set(getBucketKey(unit.x, unit.y), [indexedUnit])
  }

  const delta: OverlapMetricsDelta = {
    totalOverlap: 0,
    totalOverlapRatio: 0,
    overlapSamples: 0,
    maxOverlap: 0,
    maxOverlapRatio: 0,
    severeOverlapSamples: 0,
  }

  for (const firstBucket of buckets.values()) {
    for (const first of firstBucket) {
      for (const second of getNearbyUnits(first, buckets)) {
        if (second.index <= first.index || first.isFlying !== second.isFlying) continue

        const minDistance = (getSizeRadius(first.size) + getSizeRadius(second.size)) * 0.95
        const distance = Math.hypot(first.x - second.x, first.y - second.y)
        const overlap = Math.max(0, minDistance - distance)
        if (overlap <= 0) continue

        const overlapRatio = minDistance > 0 ? overlap / minDistance : 0
        delta.totalOverlap += overlap
        delta.totalOverlapRatio += overlapRatio
        delta.overlapSamples++
        delta.maxOverlap = Math.max(delta.maxOverlap, overlap)
        delta.maxOverlapRatio = Math.max(delta.maxOverlapRatio, overlapRatio)
        if (overlapRatio >= 0.5) delta.severeOverlapSamples++
      }
    }
  }

  return delta
}

function getNearbyUnits(unit: IndexedOverlapUnit, buckets: Map<string, IndexedOverlapUnit[]>): IndexedOverlapUnit[] {
  const cellX = getCellCoordinate(unit.x)
  const cellY = getCellCoordinate(unit.y)
  const units: IndexedOverlapUnit[] = []
  for (const offsetY of NEIGHBOR_OFFSETS) {
    for (const offsetX of NEIGHBOR_OFFSETS) {
      const bucket = buckets.get(`${cellX + offsetX}:${cellY + offsetY}`)
      if (bucket) units.push(...bucket)
    }
  }
  return units
}

function getBucketKey(x: number, y: number): string {
  return `${getCellCoordinate(x)}:${getCellCoordinate(y)}`
}

function getCellCoordinate(value: number): number {
  return Math.floor(value / MAX_OVERLAP_DISTANCE)
}
