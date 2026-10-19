// O2 A/B driver. Alternates baseline/candidate processes per (contour, preset, iteration) and
// saves every raw process report plus an aggregated summary with medians, spread, paired ratios
// and cross-variant result hash equality.
//
// The @mars2050/combat-core junction inside the Mars2050 worktree is re-pointed before each spawn,
// so each process loads exactly one core tree and reports the resolved path + entry SHA256 it used.
//
//   node packages/combat-core/certify/o2-20261018/harness/run-ab.mjs \
//     --worktree D:/Max/Mars2050-o2 \
//     --baseline D:/Max/o2/baseline-install/node_modules/@mars2050/combat-core \
//     --candidate D:/Max/Mars2050-o2/packages/combat-core \
//     --contours A,B --presets massive_clash,zerg_rush \
//     --iterations 5 --runs 7 --warmup 2 --out D:/Max/o2/evidence/ab
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 ? process.argv[index + 1] : fallback
}

const worktree = arg('worktree', 'D:/Max/Mars2050-o2').replace(/\\/g, '/')
const TSX = join(worktree, 'node_modules', 'tsx', 'dist', 'cli.mjs')
const baselineDir = arg('baseline', 'D:/Max/o2/baseline-install/node_modules/@mars2050/combat-core').replace(/\\/g, '/')
const candidateDir = arg('candidate', `${worktree}/packages/combat-core`).replace(/\\/g, '/')
const contours = arg('contours', 'A,B').split(',')
const presets = arg('presets', 'massive_clash,zerg_rush').split(',')
const iterations = Number(arg('iterations', '5'))
const runs = Number(arg('runs', '7'))
const warmup = Number(arg('warmup', '2'))
const outDir = resolve(arg('out', 'D:/Max/o2/evidence/ab'))
const cooldownMs = Number(arg('cooldown', '2500'))

const LINK = join(worktree, 'node_modules', '@mars2050', 'combat-core')
const rawDir = join(outDir, 'raw')
mkdirSync(rawDir, { recursive: true })

function pointCoreAt(target) {
  const current = existsSync(LINK) ? resolve(LINK) : ''
  if (current === resolve(target) && existsSync(LINK)) return
  if (existsSync(LINK)) rmSync(LINK, { recursive: false, force: true })
  symlinkSync(resolve(target), LINK, 'junction')
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

function cooldown() {
  const end = Date.now() + cooldownMs
  for (;;) {
    const wait = end - Date.now()
    if (wait <= 0) break
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, wait)
  }
}

function runOne(variant, contour, preset, iteration) {
  const outFile = join(rawDir, `${variant}-${contour}-${preset}-it${iteration}.json`)
  const target = variant === 'baseline' ? baselineDir : candidateDir
  pointCoreAt(target)
  const env = { ...process.env, O2_VARIANT: variant, TEMP: join(outDir, 'tmp'), TMP: join(outDir, 'tmp') }
  const script = contour === 'B'
    ? [TSX, join(worktree, 'scripts', 'o2-verify', 'measure-mars.ts')]
    : [join(worktree, 'scripts', 'o2-verify', 'measure-core.mjs')]
  const args = [...script, '--preset', preset, '--warmup', String(warmup), '--runs', String(runs), '--out', outFile]
  const result = spawnSync(process.execPath, args, {
    cwd: worktree,
    env,
    encoding: 'utf8',
    maxBuffer: 1 << 28,
  })
  if (result.status !== 0) {
    console.error(`${variant} ${contour} ${preset} it${iteration} exited ${result.status}`)
    console.error((result.stdout ?? '').slice(-3000))
    console.error((result.stderr ?? '').slice(-3000))
    process.exit(1)
  }
  const report = JSON.parse(readFileSync(outFile, 'utf8'))
  const real = (report.core.realEntry ?? report.core.resolvedEntry ?? '').replace(/\\/g, '/').toLowerCase()
  const expected = resolve(target).replace(/\\/g, '/').toLowerCase()
  if (!real.startsWith(expected)) {
    console.error(`provenance guard: ${variant} ${contour} ${preset} it${iteration} loaded ${real}, expected ${expected}`)
    process.exit(2)
  }
  return report
}

const collected = {}
for (const contour of contours) {
  for (const preset of presets) {
    const key = `${contour}|${preset}`
    collected[key] = { baseline: [], candidate: [] }
    for (let iteration = 1; iteration <= iterations; iteration += 1) {
      const order = iteration % 2 === 1 ? ['baseline', 'candidate'] : ['candidate', 'baseline']
      for (const variant of order) {
        const report = runOne(variant, contour, preset, iteration)
        collected[key][variant].push({ ...report.presets[preset], core: report.core })
        cooldown()
      }
    }
  }
}

const summary = {
  generatedAt: new Date().toISOString(),
  node: process.version,
  platform: `${process.platform}-${process.arch}`,
  worktree,
  baselineDir,
  candidateDir,
  methodology: {
    iterations,
    warmupPerProcess: warmup,
    measuredRunsPerProcess: runs,
    alternation: 'baseline/candidate process order swapped every iteration; cooldown between processes',
    aggregation:
      'per-process median, then median/min/max across per-iteration process medians plus paired per-iteration ratios; raw per-process reports kept in raw/',
  },
  cases: {},
}

for (const [key, variants] of Object.entries(collected)) {
  const [contour, preset] = key.split('|')
  const per = {}
  for (const variant of ['baseline', 'candidate']) {
    const processMedians = variants[variant].map(row => row.summary.medianMs)
    const allRuns = variants[variant].flatMap(row => row.rawMs)
    const hashes = [...new Set(variants[variant].flatMap(row => row.hashes))]
    const provenance = [...new Set(variants[variant].map(row => `${row.core.realEntry ?? row.core.resolvedEntry}|${row.core.entrySha256}|${row.core.version}`))]
    per[variant] = {
      processMediansMs: processMedians,
      medianOfMediansMs: median(processMedians),
      minOfMediansMs: Math.min(...processMedians),
      maxOfMediansMs: Math.max(...processMedians),
      minMs: Math.min(...allRuns),
      maxMs: Math.max(...allRuns),
      spreadMs: Math.max(...allRuns) - Math.min(...allRuns),
      allRawMs: allRuns,
      distinctHashes: hashes,
      resultInvariant: hashes.length === 1,
      provenance,
    }
  }
  const perIterationRatios = variants.baseline.map((row, index) => {
    const startedAt = row.summary.medianMs
    const other = variants.candidate[index].summary.medianMs
    return startedAt / other
  })
  summary.cases[key] = {
    contour,
    preset,
    baseline: per.baseline,
    candidate: per.candidate,
    medianSpeedup: per.baseline.medianOfMediansMs / per.candidate.medianOfMediansMs,
    medianDeltaMs: per.baseline.medianOfMediansMs - per.candidate.medianOfMediansMs,
    perIterationRatios,
    medianPairedRatio: median(perIterationRatios),
    crossVariantHashEqual:
      JSON.stringify(per.baseline.distinctHashes) === JSON.stringify(per.candidate.distinctHashes),
  }
}

const summaryPath = join(outDir, 'ab-summary.json')
writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8')
for (const [key, value] of Object.entries(summary.cases)) {
  console.log(
    `${key.padEnd(22)} baseline=${value.baseline.medianOfMediansMs.toFixed(1)}ms ` +
      `candidate=${value.candidate.medianOfMediansMs.toFixed(1)}ms speedup=${value.medianSpeedup.toFixed(3)}x ` +
      `paired=${value.medianPairedRatio.toFixed(3)}x hashesEqual=${value.crossVariantHashEqual} ` +
      `invariant=${value.baseline.resultInvariant && value.candidate.resultInvariant}`,
  )
}
console.log(`relative=${relative(process.cwd(), summaryPath)}`)
