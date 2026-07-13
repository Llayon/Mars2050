import { getSizeRadius } from '@/domains/combat/combat.utils'
import type { ReplayTeam, UnitSize } from './battle-replay-canvas-types'

export const REPLAY_CROWD_BUCKET_SIZE = 48
export const REPLAY_CROWD_COMPACT_THRESHOLD = 7
export const REPLAY_CROWD_CLUSTER_THRESHOLD = 16

export type ReplayCrowdRenderMode = 'full' | 'compact' | 'cluster'

export interface ReplayCrowdUnitInput {
  id: string
  team: ReplayTeam
  size: UnitSize
  sX: number
  sY: number
  tX: number
  tY: number
  isDead: boolean
}

export interface ReplayCrowdUnitView {
  id: string
  x: number
  y: number
  radius: number
  mode: ReplayCrowdRenderMode
}

export interface ReplayCrowdClusterView {
  key: string
  team: ReplayTeam
  x: number
  y: number
  count: number
  radius: number
}

export interface ReplayCrowdRenderPlan {
  units: ReplayCrowdUnitView[]
  clusters: ReplayCrowdClusterView[]
}

interface CrowdBucket {
  key: string
  team: ReplayTeam
  bucketX: number
  bucketY: number
  units: ReplayCrowdUnitView[]
  sumX: number
  sumY: number
}

export function buildReplayCrowdRenderPlan(units: ReplayCrowdUnitInput[], progress: number): ReplayCrowdRenderPlan {
  const buckets = new Map<string, CrowdBucket>()
  const renderProgress = clamp01(progress)

  const unitViews = units.map(unit => {
    const x = lerp(unit.sX, unit.tX, renderProgress)
    const y = lerp(unit.sY, unit.tY, renderProgress)
    const view: ReplayCrowdUnitView = {
      id: unit.id,
      x,
      y,
      radius: getSizeRadius(unit.size),
      mode: 'full',
    }

    if (unit.isDead) return view

    const bucketX = Math.floor(x / REPLAY_CROWD_BUCKET_SIZE)
    const bucketY = Math.floor(y / REPLAY_CROWD_BUCKET_SIZE)
    const key = `${unit.team}:${bucketX}:${bucketY}`
    let bucket = buckets.get(key)
    if (!bucket) {
      bucket = { key, team: unit.team, bucketX, bucketY, units: [], sumX: 0, sumY: 0 }
      buckets.set(key, bucket)
    }
    bucket.units.push(view)
    bucket.sumX += x
    bucket.sumY += y
    return view
  })

  for (const bucket of buckets.values()) {
    const mode = crowdMode(bucket.units.length)
    bucket.units.forEach(unit => { unit.mode = mode })
  }

  const clusterBuckets = new Set<string>()
  for (const bucket of buckets.values()) {
    if (neighborhoodCount(buckets, bucket) >= REPLAY_CROWD_CLUSTER_THRESHOLD) {
      clusterBuckets.add(bucket.key)
    }
  }

  const clusters = buildClusterViews(buckets, clusterBuckets)
  clusters.sort((left, right) => compareBucketKeys(left.key, right.key))
  return { units: unitViews, clusters }
}

function crowdMode(count: number): ReplayCrowdRenderMode {
  if (count >= REPLAY_CROWD_CLUSTER_THRESHOLD) return 'cluster'
  if (count >= REPLAY_CROWD_COMPACT_THRESHOLD) return 'compact'
  return 'full'
}

function buildClusterViews(buckets: Map<string, CrowdBucket>, clusterBuckets: Set<string>): ReplayCrowdClusterView[] {
  const clusters: ReplayCrowdClusterView[] = []
  const visited = new Set<string>()
  const sortedKeys = [...clusterBuckets].sort(compareBucketKeys)

  for (const key of sortedKeys) {
    const seed = buckets.get(key)
    if (!seed || visited.has(seed.key)) continue

    const queue: CrowdBucket[] = [seed]
    visited.add(seed.key)
    let count = 0
    let sumX = 0
    let sumY = 0

    for (let index = 0; index < queue.length; index++) {
      const bucket = queue[index]
      bucket.units.forEach(unit => { unit.mode = 'cluster' })
      count += bucket.units.length
      sumX += bucket.sumX
      sumY += bucket.sumY

      for (const neighbor of neighborKeys(bucket.team, bucket.bucketX, bucket.bucketY)) {
        if (!clusterBuckets.has(neighbor) || visited.has(neighbor)) continue
        const nextBucket = buckets.get(neighbor)
        if (!nextBucket) continue
        visited.add(neighbor)
        queue.push(nextBucket)
      }
    }

    clusters.push({
      key: seed.key,
      team: seed.team,
      x: sumX / count,
      y: sumY / count,
      count,
      radius: Math.min(96, Math.max(30, Math.sqrt(count) * 8)),
    })
  }

  return clusters
}

function neighborhoodCount(buckets: Map<string, CrowdBucket>, bucket: CrowdBucket): number {
  let count = 0
  for (const key of neighborKeys(bucket.team, bucket.bucketX, bucket.bucketY)) {
    count += buckets.get(key)?.units.length ?? 0
  }
  return count
}

function neighborKeys(team: ReplayTeam, bucketX: number, bucketY: number): string[] {
  const keys: string[] = []
  for (let y = bucketY - 1; y <= bucketY + 1; y++) {
    for (let x = bucketX - 1; x <= bucketX + 1; x++) {
      keys.push(`${team}:${x}:${y}`)
    }
  }
  return keys
}

function compareBucketKeys(left: string, right: string): number {
  const leftBucket = parseBucketKey(left)
  const rightBucket = parseBucketKey(right)
  if (leftBucket.team !== rightBucket.team) return leftBucket.team === 'attacker' ? -1 : 1
  if (leftBucket.bucketY !== rightBucket.bucketY) return leftBucket.bucketY - rightBucket.bucketY
  return leftBucket.bucketX - rightBucket.bucketX
}

function parseBucketKey(key: string): { team: ReplayTeam; bucketX: number; bucketY: number } {
  const [team, bucketX, bucketY] = key.split(':')
  return { team: team === 'attacker' ? 'attacker' : 'defender', bucketX: Number(bucketX), bucketY: Number(bucketY) }
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function lerp(from: number, to: number, progress: number): number {
  return from + (to - from) * progress
}
