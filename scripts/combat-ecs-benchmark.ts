import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { performance } from 'node:perf_hooks'
import { getSimulatorPreset } from '@/app/simulator2/simulator.presets'
import { simulateBattle } from '@/domains/combat/combat.engine'
import type { SpatialQueryProfile } from '@/domains/combat/combat.spatial-profile'
import type { UnitRow } from '@/domains/combat/combat.types'

interface BenchmarkRow extends SpatialQueryProfile {
  preset: string
  mode: BenchmarkMode
  units: number
  ticks: number
  medianMs: number
}

const DEFAULT_PRESETS = ['massive_clash', 'zerg_rush']
const DEFAULT_RUNS = 5
type BenchmarkMode = 'production' | 'profile'

function cloneRows(rows: UnitRow[]): UnitRow[] {
  return rows.map(row => ({ ...row, upgrade_path: [...(row.upgrade_path ?? [])] }))
}

function runPreset(
  presetId: string,
  runs: number,
  mode: BenchmarkMode,
): BenchmarkRow {
  const preset = getSimulatorPreset(presetId)
  if (!preset) throw new Error(`Missing simulator preset: ${presetId}`)
  simulate(preset.attackers, preset.defenders, mode)
  const durations: number[] = []
  let latest = simulate(preset.attackers, preset.defenders, mode)
  for (let run = 0; run < runs; run++) {
    const startedAt = performance.now()
    latest = simulate(preset.attackers, preset.defenders, mode)
    durations.push(performance.now() - startedAt)
  }
  durations.sort((left, right) => left - right)
  const profile = latest.profile ?? emptyProfile()
  return {
    preset: presetId,
    mode,
    units: latest.initialState.length,
    ticks: latest.elapsedTicks,
    medianMs: Math.round(durations[Math.floor(durations.length / 2)] * 100) / 100,
    ...profile,
  }
}

function simulate(
  attackers: UnitRow[],
  defenders: UnitRow[],
  mode: BenchmarkMode,
) {
  return simulateBattle(
    cloneRows(attackers),
    cloneRows(defenders),
    24680,
    [],
    [],
    [],
    { profile: mode === 'profile' },
  )
}

function emptyProfile(): SpatialQueryProfile {
  return {
    queryCount: 0, candidateCount: 0, maxCandidates: 0,
    bucketCandidateCount: 0, rebuildCount: 0, incrementalUpdateCount: 0,
    componentQueryCount: 0, componentCandidateCount: 0,
    componentResultCount: 0, componentCacheHitCount: 0,
    pairQueryCount: 0, pairBucketCandidateCount: 0, pairResultCount: 0, purposes: {},
    movementBatchCount: 0, movementIntentCount: 0,
    neighborCandidatePairCount: 0, neighborEdgeCount: 0,
    collisionCandidatePairCount: 0, collisionOverlapPairCount: 0,
    dirtyCellCount: 0,
    targetingFrameBuildCount: 0, targetingFrameEntityCount: 0,
    targetingAcquisitionCount: 0, targetingBucketCandidateCount: 0,
    targetingCandidateCount: 0, targetingMaxCandidates: 0,
    targetingDirtyCandidateCount: 0, targetingLegacyFallbackCount: 0,
    targetingScratchGrowthCount: 0, targetingFrameBuildMs: 0,
    targetingQueryMs: 0, targetingSelectionMs: 0,
  }
}

function ratio(current: number, baseline: number): number {
  return Math.round((current / baseline) * 1000) / 1000
}

function main(): void {
  const args = process.argv.slice(2)
  const presetArg = args.find(arg => arg.startsWith('--preset='))?.slice('--preset='.length)
  const runsArg = args.find(arg => arg.startsWith('--runs='))?.slice('--runs='.length)
  const modeArg = args.find(arg => arg.startsWith('--mode='))?.slice('--mode='.length)
  const mode: BenchmarkMode = modeArg === 'production' ? 'production' : 'profile'
  const runs = Math.max(1, Number(runsArg ?? DEFAULT_RUNS))
  const rows = (presetArg?.split(',').filter(Boolean) ?? DEFAULT_PRESETS)
    .map(preset => runPreset(preset, runs, mode))
  const outputPath = args.find(arg => arg.startsWith('--write='))?.slice('--write='.length)
  const comparePath = args.find(arg => arg.startsWith('--compare='))?.slice('--compare='.length)
  if (outputPath) {
    writeFileSync(resolve(outputPath), `${JSON.stringify(rows, null, 2)}\n`)
  }
  if (comparePath) {
    const path = resolve(comparePath)
    if (!existsSync(path)) throw new Error(`Missing benchmark baseline: ${path}`)
    const baseline = JSON.parse(readFileSync(path, 'utf8')) as BenchmarkRow[]
    const byPreset = new Map(baseline.map(row => [row.preset, row]))
    console.table(rows.map(row => {
      const previous = byPreset.get(row.preset)
      return {
        preset: row.preset,
        medianMs: row.medianMs,
        speedRatio: previous ? ratio(row.medianMs, previous.medianMs) : null,
        componentScanRatio: previous ? ratio(row.componentCandidateCount, previous.componentCandidateCount) : null,
        spatialCandidateRatio: previous ? ratio(row.bucketCandidateCount, previous.bucketCandidateCount) : null,
      }
    }))
    return
  }
  console.table(rows)
}

main()
