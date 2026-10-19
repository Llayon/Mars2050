// O2 memory harness — Pure Core contour (A). One process per (variant, preset):
// reports peak RSS/heap during the battle loop and post-GC retained heap, plus a post-battle
// snapshot (which is deliberately NOT reported as the per-battle peak).
//   node --expose-gc scripts/o2-verify/measure-memory.mjs --preset zerg_rush --battles 5 --out mem.json
import { readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const INPUT_DIR = resolve(HERE, '..', '..', 'packages', 'combat-core', 'certify', 'o2-20261018', 'inputs')

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 ? process.argv[index + 1] : fallback
}

const presetId = arg('preset', 'zerg_rush')
const battles = Number(arg('battles', '5'))
const out = arg('out', '')
const variant = process.env.O2_VARIANT ?? 'unknown'
const canGc = typeof global.gc === 'function'

const entryPath = fileURLToPath(import.meta.resolve('@mars2050/combat-core'))
const { simulateCombat } = await import(import.meta.resolve('@mars2050/combat-core'))
const input = JSON.parse(readFileSync(join(INPUT_DIR, `${presetId}.battle-input.json`), 'utf8'))

const sample = () => {
  const usage = process.memoryUsage()
  return { rss: usage.rss, heapUsed: usage.heapUsed, heapTotal: usage.heapTotal, external: usage.external }
}

if (canGc) global.gc()
const before = sample()
simulateCombat(input)

let peakRss = 0
let peakHeap = 0
const samples = []
const hashes = new Set()
for (let index = 0; index < battles; index += 1) {
  const result = simulateCombat(input)
  hashes.add(createHash('sha256').update(JSON.stringify(result)).digest('hex'))
  const snapshot = sample()
  samples.push(snapshot)
  peakRss = Math.max(peakRss, snapshot.rss)
  peakHeap = Math.max(peakHeap, snapshot.heapUsed)
}

// A post-battle snapshot after an explicit GC: retained heap, not a per-battle peak.
if (canGc) global.gc()
const retained = sample()

const report = {
  variant,
  contour: 'A',
  preset: presetId,
  node: process.version,
  platform: `${process.platform}-${process.arch}`,
  battles,
  gcAvailable: canGc,
  core: {
    entryPath: entryPath.replace(/\\/g, '/'),
    realEntry: realpathSync(entryPath).replace(/\\/g, '/'),
    entrySha256: createHash('sha256').update(readFileSync(entryPath)).digest('hex'),
  },
  beforeBytes: before,
  peakRssBytes: peakRss,
  peakHeapUsedBytes: peakHeap,
  peakRssDeltaBytes: peakRss - before.rss,
  peakHeapDeltaBytes: peakHeap - before.heapUsed,
  retainedAfterGcBytes: retained,
  retainedHeapDeltaBytes: retained.heapUsed - before.heapUsed,
  samples,
  distinctResultHashes: [...hashes],
  resultInvariant: hashes.size === 1,
}

const payload = `${JSON.stringify(report, null, 2)}\n`
if (out) writeFileSync(out, payload, 'utf8')
console.log(JSON.stringify({
  variant, preset: presetId,
  peakRssMb: +(peakRss / 1048576).toFixed(2),
  peakHeapMb: +(peakHeap / 1048576).toFixed(2),
  retainedAfterGcMb: +(retained.heapUsed / 1048576).toFixed(2),
  retainedRssMb: +(retained.rss / 1048576).toFixed(2),
  resultInvariant: hashes.size === 1,
}))
