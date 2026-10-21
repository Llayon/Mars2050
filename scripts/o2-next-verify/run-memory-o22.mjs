// O2.2 memory driver: baseline is the accepted o2mv.1 archive, candidate is the O2.2 workspace
// package. One --expose-gc process per (variant, preset, iteration); peak RSS/heap are sampled per
// battle, retained heap after an explicit full GC. Scratch TEMP stays outside the evidence tree.
//
//   node scripts/o2-next-verify/run-memory-o22.mjs --presets massive_clash,zerg_rush \
//     --iterations 3 --battles 5 --out D:/Max/o2/evidence-o22/memory
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 ? process.argv[index + 1] : fallback
}

const LINK = join(REPO, 'node_modules', '@mars2050', 'combat-core')
const TARGETS = {
  baseline: resolve(arg('baseline', 'D:/Max/o2/baseline-o2/node_modules/@mars2050/combat-core')),
  candidate: resolve(arg('candidate', join(REPO, 'packages', 'combat-core'))),
}
const presets = arg('presets', 'massive_clash,zerg_rush').split(',')
const iterations = Number(arg('iterations', '3'))
const battles = Number(arg('battles', '5'))
const outDir = resolve(arg('out', 'D:/Max/o2/evidence-o22/memory'))
const tmpDir = resolve(arg('tmp', 'D:/Max/o2/tmp'))
const rawDir = join(outDir, 'raw')
mkdirSync(rawDir, { recursive: true })
mkdirSync(tmpDir, { recursive: true })

function pointCoreAt(target) {
  if (existsSync(LINK)) rmSync(LINK, { recursive: false, force: true })
  symlinkSync(resolve(target), LINK, 'junction')
}

function runOne(variant, preset, iteration) {
  pointCoreAt(TARGETS[variant])
  const outFile = join(rawDir, `${variant}-A-${preset}-it${iteration}.json`)
  const result = spawnSync(process.execPath, ['--expose-gc',
    join(REPO, 'scripts', 'o2-verify', 'measure-memory.mjs'), '--preset', preset, '--battles', String(battles), '--out', outFile], {
    cwd: REPO,
    env: { ...process.env, O2_VARIANT: variant, TEMP: tmpDir, TMP: tmpDir },
    encoding: 'utf8', maxBuffer: 1 << 28,
  })
  if (result.status !== 0) {
    console.error(`${variant} ${preset} it${iteration} exited ${result.status}`)
    console.error((result.stdout ?? '').slice(-2000), (result.stderr ?? '').slice(-2000))
    process.exit(1)
  }
  const report = JSON.parse(readFileSync(outFile, 'utf8'))
  const expected = resolve(TARGETS[variant]).replace(/\\/g, '/').toLowerCase()
  if (!report.core.realEntry.toLowerCase().startsWith(expected)) {
    console.error(`provenance guard: ${variant} loaded ${report.core.realEntry}`)
    process.exit(2)
  }
  return report
}

const summary = {
  generatedAt: new Date().toISOString(), node: process.version, battlesPerProcess: battles,
  targets: { baseline: TARGETS.baseline.replace(/\\/g, '/'), candidate: TARGETS.candidate.replace(/\\/g, '/') },
  cases: {},
}
for (const preset of presets) {
  const rows = { baseline: [], candidate: [] }
  for (let iteration = 1; iteration <= iterations; iteration += 1) {
    const order = iteration % 2 === 1 ? ['baseline', 'candidate'] : ['candidate', 'baseline']
    for (const variant of order) rows[variant].push(runOne(variant, preset, iteration))
  }
  const pick = (list, key) => list.map(row => row[key])
  const per = {}
  for (const variant of ['baseline', 'candidate']) {
    per[variant] = {
      peakRssMb: pick(rows[variant], 'peakRssBytes').map(value => +(value / 1048576).toFixed(2)),
      peakHeapMb: pick(rows[variant], 'peakHeapUsedBytes').map(value => +(value / 1048576).toFixed(2)),
      retainedHeapMb: pick(rows[variant], 'retainedAfterGcBytes').map(value => +(value.heapUsed / 1048576).toFixed(2)),
      retainedRssMb: pick(rows[variant], 'retainedAfterGcBytes').map(value => +(value.rss / 1048576).toFixed(2)),
      resultInvariant: rows[variant].every(row => row.resultInvariant),
      provenance: [...new Set(rows[variant].map(row => row.core.realEntry))],
      resultHashes: [...new Set(rows[variant].flatMap(row => row.distinctResultHashes))],
    }
  }
  summary.cases[preset] = { baseline: per.baseline, candidate: per.candidate }
}
writeFileSync(join(outDir, 'ab-memory-summary.json'), `${JSON.stringify(summary, null, 2)}\n`, 'utf8')
for (const [preset, value] of Object.entries(summary.cases)) {
  console.log(`${preset}: peakRss baseline=${value.baseline.peakRssMb.join('/')} candidate=${value.candidate.peakRssMb.join('/')} | ` +
    `peakHeap baseline=${value.baseline.peakHeapMb.join('/')} candidate=${value.candidate.peakHeapMb.join('/')} | ` +
    `retained baseline=${value.baseline.retainedHeapMb.join('/')} candidate=${value.candidate.retainedHeapMb.join('/')}`)
}
