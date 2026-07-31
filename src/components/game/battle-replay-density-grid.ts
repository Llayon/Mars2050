import { FIELD_HEIGHT, FIELD_WIDTH } from '@/domains/combat/combat.utils'
import type { ReplayTeam } from './battle-replay-canvas-types'
import {
  REPLAY_CROWD_BUCKET_SIZE,
  type ReplayCrowdClusterView,
  type ReplayCrowdUnitView,
} from './battle-replay-density'

export const CROWD_BUCKET_COLUMNS =
  Math.floor(FIELD_WIDTH / REPLAY_CROWD_BUCKET_SIZE) + 1
export const CROWD_BUCKET_ROWS =
  Math.floor(FIELD_HEIGHT / REPLAY_CROWD_BUCKET_SIZE) + 1
export const CROWD_TEAM_BUCKET_COUNT =
  CROWD_BUCKET_COLUMNS * CROWD_BUCKET_ROWS
export const CROWD_BUCKET_COUNT = CROWD_TEAM_BUCKET_COUNT * 2

export interface ReplayCrowdBucket {
  key: string
  team: ReplayTeam
  bucketX: number
  bucketY: number
  views: ReplayCrowdUnitView[]
  sumX: number
  sumY: number
  activeFrame: number
  clusterFrame: number
  visitedFrame: number
  clusterView?: ReplayCrowdClusterView
}

export function getCrowdBucketId(
  team: ReplayTeam,
  x: number,
  y: number,
): number {
  return (team === 'attacker' ? 0 : CROWD_TEAM_BUCKET_COUNT) +
    x * CROWD_BUCKET_ROWS + y
}

export function clampCrowdBucket(value: number, limit: number): number {
  return Math.max(0, Math.min(limit - 1, value))
}
