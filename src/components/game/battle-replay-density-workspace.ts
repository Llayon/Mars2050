import { getSizeRadius } from '@/domains/combat/combat.utils'
import {
  REPLAY_CROWD_BUCKET_SIZE,
  REPLAY_CROWD_CLUSTER_THRESHOLD,
  REPLAY_CROWD_COMPACT_THRESHOLD,
  type ReplayCrowdClusterView,
  type ReplayCrowdRenderMode,
  type ReplayCrowdRenderPlan,
  type ReplayCrowdUnitInput,
  type ReplayCrowdUnitView,
} from './battle-replay-density'
import {
  clampCrowdBucket,
  CROWD_BUCKET_COLUMNS,
  CROWD_BUCKET_COUNT,
  CROWD_BUCKET_ROWS,
  CROWD_TEAM_BUCKET_COUNT,
  getCrowdBucketId,
  type ReplayCrowdBucket,
} from './battle-replay-density-grid'

export interface ReplayCrowdWorkspaceStats {
  frames: number
  createdUnitViews: number
  createdBuckets: number
  createdClusterViews: number
}

export class ReplayCrowdRenderWorkspace {
  readonly plan: ReplayCrowdRenderPlan = { units: [], clusters: [] }
  readonly stats: ReplayCrowdWorkspaceStats = {
    frames: 0,
    createdUnitViews: 0,
    createdBuckets: 0,
    createdClusterViews: 0,
  }
  private readonly unitViewPool: ReplayCrowdUnitView[] = []
  private readonly buckets: Array<ReplayCrowdBucket | undefined> =
    new Array(CROWD_BUCKET_COUNT)
  private readonly activeBuckets: ReplayCrowdBucket[] = []
  private readonly componentQueue: ReplayCrowdBucket[] = []
  private frameId = 0

  update(
    units: readonly ReplayCrowdUnitInput[],
    progress: number,
  ): ReplayCrowdRenderPlan {
    const frameId = ++this.frameId
    this.stats.frames++
    this.activeBuckets.length = 0
    this.plan.units.length = units.length
    this.plan.clusters.length = 0
    const renderProgress = clamp01(progress)

    for (let index = 0; index < units.length; index++) {
      const unit = units[index]
      const view = this.getUnitView(index, unit)
      view.x = lerp(unit.sX, unit.tX, renderProgress)
      view.y = lerp(unit.sY, unit.tY, renderProgress)
      view.radius = getSizeRadius(unit.size)
      view.mode = 'full'
      this.plan.units[index] = view
      if (unit.isDead) continue
      const bucket = this.getActiveBucket(
        unit.team,
        Math.floor(view.x / REPLAY_CROWD_BUCKET_SIZE),
        Math.floor(view.y / REPLAY_CROWD_BUCKET_SIZE),
        frameId,
      )
      bucket.views.push(view)
      bucket.sumX += view.x
      bucket.sumY += view.y
    }

    for (let index = 0; index < this.activeBuckets.length; index++) {
      const bucket = this.activeBuckets[index]
      const mode = crowdMode(bucket.views.length)
      for (let viewIndex = 0; viewIndex < bucket.views.length; viewIndex++) {
        bucket.views[viewIndex].mode = mode
      }
      if (this.neighborhoodCount(bucket, frameId) >=
          REPLAY_CROWD_CLUSTER_THRESHOLD) {
        bucket.clusterFrame = frameId
      }
    }

    this.buildClusters(frameId)
    return this.plan
  }

  private getUnitView(
    index: number,
    unit: ReplayCrowdUnitInput,
  ): ReplayCrowdUnitView {
    const cached = this.unitViewPool[index]
    if (cached?.id === unit.id) return cached
    const view: ReplayCrowdUnitView = {
      id: unit.id,
      x: 0,
      y: 0,
      radius: 0,
      mode: 'full',
    }
    this.unitViewPool[index] = view
    this.stats.createdUnitViews++
    return view
  }

  private getActiveBucket(
    team: ReplayCrowdUnitInput['team'],
    bucketX: number,
    bucketY: number,
    frameId: number,
  ): ReplayCrowdBucket {
    const x = clampCrowdBucket(bucketX, CROWD_BUCKET_COLUMNS)
    const y = clampCrowdBucket(bucketY, CROWD_BUCKET_ROWS)
    const id = getCrowdBucketId(team, x, y)
    let bucket = this.buckets[id]
    if (!bucket) {
      bucket = {
        key: `${team}:${x}:${y}`,
        team,
        bucketX: x,
        bucketY: y,
        views: [],
        sumX: 0,
        sumY: 0,
        activeFrame: 0,
        clusterFrame: 0,
        visitedFrame: 0,
      }
      this.buckets[id] = bucket
      this.stats.createdBuckets++
    }
    if (bucket.activeFrame !== frameId) {
      bucket.activeFrame = frameId
      bucket.views.length = 0
      bucket.sumX = 0
      bucket.sumY = 0
      this.activeBuckets.push(bucket)
    }
    return bucket
  }

  private neighborhoodCount(
    bucket: ReplayCrowdBucket,
    frameId: number,
  ): number {
    let count = 0
    for (let y = bucket.bucketY - 1; y <= bucket.bucketY + 1; y++) {
      if (y < 0 || y >= CROWD_BUCKET_ROWS) continue
      for (let x = bucket.bucketX - 1; x <= bucket.bucketX + 1; x++) {
        if (x < 0 || x >= CROWD_BUCKET_COLUMNS) continue
        const neighbor = this.buckets[getCrowdBucketId(bucket.team, x, y)]
        if (neighbor?.activeFrame === frameId) count += neighbor.views.length
      }
    }
    return count
  }

  private buildClusters(frameId: number): void {
    for (let teamIndex = 0; teamIndex < 2; teamIndex++) {
      for (let y = 0; y < CROWD_BUCKET_ROWS; y++) {
        for (let x = 0; x < CROWD_BUCKET_COLUMNS; x++) {
          const seed = this.buckets[
            teamIndex * CROWD_TEAM_BUCKET_COUNT + x * CROWD_BUCKET_ROWS + y
          ]
          if (!seed || seed.clusterFrame !== frameId ||
              seed.visitedFrame === frameId) continue
          this.buildCluster(seed, frameId)
        }
      }
    }
  }

  private buildCluster(seed: ReplayCrowdBucket, frameId: number): void {
    const queue = this.componentQueue
    queue.length = 0
    queue.push(seed)
    seed.visitedFrame = frameId
    let count = 0
    let sumX = 0
    let sumY = 0

    for (let index = 0; index < queue.length; index++) {
      const bucket = queue[index]
      count += bucket.views.length
      sumX += bucket.sumX
      sumY += bucket.sumY
      for (let y = bucket.bucketY - 1; y <= bucket.bucketY + 1; y++) {
        if (y < 0 || y >= CROWD_BUCKET_ROWS) continue
        for (let x = bucket.bucketX - 1; x <= bucket.bucketX + 1; x++) {
          if (x < 0 || x >= CROWD_BUCKET_COLUMNS) continue
          const neighbor = this.buckets[getCrowdBucketId(bucket.team, x, y)]
          if (!neighbor || neighbor.clusterFrame !== frameId ||
              neighbor.visitedFrame === frameId) continue
          neighbor.visitedFrame = frameId
          queue.push(neighbor)
        }
      }
    }

    if (count < REPLAY_CROWD_CLUSTER_THRESHOLD) return
    for (let index = 0; index < queue.length; index++) {
      const views = queue[index].views
      for (let viewIndex = 0; viewIndex < views.length; viewIndex++) {
        views[viewIndex].mode = 'cluster'
      }
    }
    const cluster = seed.clusterView ?? this.createClusterView(seed)
    cluster.x = sumX / count
    cluster.y = sumY / count
    cluster.count = count
    cluster.radius = Math.min(96, Math.max(30, Math.sqrt(count) * 8))
    this.plan.clusters.push(cluster)
  }

  private createClusterView(
    seed: ReplayCrowdBucket,
  ): ReplayCrowdClusterView {
    const cluster: ReplayCrowdClusterView = {
      key: seed.key,
      team: seed.team,
      x: 0,
      y: 0,
      count: 0,
      radius: 0,
    }
    seed.clusterView = cluster
    this.stats.createdClusterViews++
    return cluster
  }
}

function crowdMode(count: number): ReplayCrowdRenderMode {
  if (count >= REPLAY_CROWD_CLUSTER_THRESHOLD) return 'cluster'
  if (count >= REPLAY_CROWD_COMPACT_THRESHOLD) return 'compact'
  return 'full'
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function lerp(from: number, to: number, progress: number): number {
  return from + (to - from) * progress
}
