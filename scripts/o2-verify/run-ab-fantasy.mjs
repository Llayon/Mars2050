// O2 Fantasy contour (C) A/B driver: alternates baseline/candidate native bundles per
// (scenario, iteration), each variant in its own process started with the Fantasy stand's portable
// Node v26.11.1. Fantasy itself is read-only; only the O2 lab directory is written.
//
//   node scripts/o2-verify/run-ab-fantasy.mjs \
//     --scenarios a,b,c --iterations 5 --runs 5 --warmup 2 --out D:/Max/o2/evidence/fantasy/ab
import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 ? process.argv[index + 1] : fallback
}

const node26 = arg('node26', 'D:/Max/fantasy-battles/.tools/node26/node.exe')
const scenarios = arg('scenarios', '').split(',').filter(Boolean)
const iterations = Number(arg('iterations', '5'))
const runs = Number(arg('runs', '5'))
const warmup = Number(arg('warmup', '2'))
const outDir = resolve(arg('out', 'D:/Max/o2/evidence/fantasy/ab'))
const cooldownMs = Number(arg('cooldown', '1500'))
const rawDir = join(outDir, 'raw')
mkdirSync(rawDir, { recursive: true })

const BUNDLES = {
  baseline: 'D:/Max/o2/fantasy/baseline/native-compare.mjs',
  candidate: 'D:/Max/o2/fantasy/candidate/native-compare.mjs',
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

// One process per (scenario, variant, iteration): the whole measured window of a single process
// stays on one bundle, so no cross-variant JIT state can be shared.
function runOne(variant, scenario, iteration) {
  const outFile = join(rawDir, `${variant}-${scenario.replace(/[^a-z0-9]+/gi, '_')}-it${iteration}.json`)
  const result = spawnSync(node26, [join(HERE, 'measure-fantasy.mjs'),
    '--bundle', BUNDLES[variant], '--mode', 'time', '--scenarios', scenario,
    '--warmup', String(warmup), '--runs', String(runs), '--out', outFile], {
    cwd: resolve(HERE, '..', '..'),
    env: { ...process.env, TEMP: join(outDir, 'tmp'), TMP: join(outDir, 'tmp') },
    encoding: 'utf8',
    maxBuffer: 1 << 28,
  })
  if (result.status !== 0) {
    console.error(`${variant} ${scenario} it${iteration} exited ${result.status}`)
    console.error((result.stdout ?? '').slice(-2000))
    console.error((result.stderr ?? '').slice(-2000))
    process.exit(1)
  }
  const report = JSON.parse(readFileSync(outFile, 'utf8'))
  const row = report.scenarios.find(entry => entry.name === scenario)
  if (!row) {
    console.error(`scenario ${scenario} missing from ${outFile}`)
    process.exit(2)
  }
  return { ...row, bundleSha256: report.bundleSha256, node: report.node }
}

const collected = {}
for (const scenario of scenarios) {
  collected[scenario] = { baseline: [], candidate: [] }
  for (let iteration = 1; iteration <= iterations; iteration += 1) {
    const order = iteration % 2 === 1 ? ['baseline', 'candidate'] : ['candidate', 'baseline']
    for (const variant of order) {
      collected[scenario][variant].push(runOne(variant, scenario, iteration))
      cooldown()
    }
  }
}

const summary = {
  generatedAt: new Date().toISOString(),
  node: node26,
  contour: 'C (Fantasy native path)',
  bundles: BUNDLES,
  methodology: {
    iterations,
    warmupPerProcess: warmup,
    measuredRunsPerProcess: runs,
    alternation: 'baseline/candidate process order swapped every iteration; cooldown between processes',
    aggregation: 'per-process median across per-iteration process medians plus paired per-iteration ratios',
  },
  cases: {},
}

for (const [scenario, variants] of Object.entries(collected)) {
  const per = {}
  for (const variant of ['baseline', 'candidate']) {
    const processMedians = variants[variant].map(row => row.medianMs)
    const allRuns = variants[variant].flatMap(row => row.rawMs)
    const hashes = [...new Set(variants[variant].flatMap(row => row.hashes))]
    per[variant] = {
      processMediansMs: processMedians,
      medianOfMediansMs: median(processMedians),
      minMs: Math.min(...allRuns),
      maxMs: Math.max(...allRuns),
      allRawMs: allRuns,
      distinctHashes: hashes,
      resultInvariant: hashes.length === 1,
      bundle: [...new Set(variants[variant].map(row => row.bundleSha256))],
      node: [...new Set(variants[variant].map(row => row.node))],
    }
  }
  const perIterationRatios = variants.baseline.map((row, index) => row.medianMs / variants.candidate[index].medianMs)
  summary.cases[scenario] = {
    baseline: per.baseline,
    candidate: per.candidate,
    medianSpeedup: per.baseline.medianOfMediansMs / per.candidate.medianOfMediansMs,
    medianDeltaMs: per.baseline.medianOfMediansMs - per.candidate.medianOfMediansMs,
    perIterationRatios,
    medianPairedRatio: median(perIterationRatios),
    crossVariantHashEqual: JSON.stringify(per.baseline.distinctHashes) === JSON.stringify(per.candidate.distinctHashes),
  }
}

writeFileSync(join(outDir, 'ab-fantasy-summary.json'), `${JSON.stringify(summary, null, 2)}\n`, 'utf8')
for (const [scenario, value] of Object.entries(summary.cases)) {
  console.log(`${scenario.padEnd(42)} baseline=${value.baseline.medianOfMediansMs.toFixed(1)}ms ` +
    `candidate=${value.candidate.medianOfMediansMs.toFixed(1)}ms speedup=${value.medianSpeedup.toFixed(3)}x ` +
    `paired=${value.medianPairedRatio.toFixed(3)}x hashesEqual=${value.crossVariantHashEqual} ` +
    `invariant=${value.baseline.resultInvariant && value.candidate.resultInvariant}`)
}
