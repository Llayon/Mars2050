// O2 Fantasy contour (C): runs the real Fantasy native path (the app's own adapter bundled with a
// chosen core) over the frozen 159-scenario native corpus.
//
//   node --experimental-vm-modules scripts/o2-verify/measure-fantasy.mjs \
//     --bundle D:/Max/o2/fantasy/baseline/native-compare.mjs --mode hash --out D:/Max/o2/evidence/fantasy-baseline.json
//
// Modes:
//   hash  one pass over the whole corpus, per-scenario digest + total ms (correctness comparison)
//   time  warmup + measured runs for --scenarios only, recording per-run ms and hashes
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 ? process.argv[index + 1] : fallback
}

const FANTASY = arg('fantasy', 'D:/Max/fantasy-battles')
const FIXTURES = join(FANTASY, 'apps', 'fantasy', 'tests', 'fixtures', 'native-sdk')
const bundlePath = arg('bundle', '')
const mode = arg('mode', 'hash')
const scenarioFilter = arg('scenarios', '').split(',').filter(Boolean)
const warmup = Number(arg('warmup', '1'))
const runs = Number(arg('runs', '5'))
const out = arg('out', '')

const sha256 = text => createHash('sha256').update(text, 'utf8').digest('hex')
const sha256File = file => createHash('sha256').update(readFileSync(file)).digest('hex')
const digest = value => sha256(JSON.stringify(value))

function median(values) {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

const manifest = JSON.parse(readFileSync(join(FIXTURES, 'manifest.json'), 'utf8'))
const corpusHashes = {}
for (const file of manifest.files) {
  if (!file.file) continue
  corpusHashes[file.file] = { expected: file.sha256, actual: sha256File(join(FIXTURES, file.file)) }
}
const corpusFilesIntact = Object.values(corpusHashes).every(row => row.expected === row.actual)

const corpus = [
  ...JSON.parse(gunzipSync(readFileSync(join(FIXTURES, 'corpus.json.gz')))).scenarios,
  ...JSON.parse(gunzipSync(readFileSync(join(FIXTURES, 'extra-corpus.json.gz')))).scenarios,
]

const api = await import(pathToFileURL(bundlePath).href)
const report = {
  mode,
  bundle: bundlePath.replace(/\\/g, '/'),
  bundleSha256: sha256File(bundlePath),
  node: process.version,
  platform: `${process.platform}-${process.arch}`,
  sdk52Sha256: api.SDK52_RUNTIME?.sdk ?? null,
  nativeRuntime: api.NATIVE_RUNTIME ?? null,
  corpus: { files: corpusHashes, intact: corpusFilesIntact, scenarios: corpus.length },
  scenarios: [],
  digests: {},
}

if (mode === 'hash') {
  const startedAt = performance.now()
  let index = 0
  for (const sample of corpus) {
    const envelope = { format: api.SDK52_RUNTIME.inputFormat, sdk: api.SDK52_RUNTIME.sdk, input: sample.input }
    const translated = await api.translateNativeInput(envelope)
    const result = api.nativeSimulate(translated.input)
    const resultDigest = digest(result)
    report.digests[sample.name] = resultDigest
    report.scenarios.push({ name: sample.name, inputSha256: digest(sample.input), digest: resultDigest, ticks: result.elapsedTicks })
    index += 1
    if (index % 40 === 0) console.log(`fantasy corpus ${index}/${corpus.length}`)
  }
  report.totalMs = performance.now() - startedAt
} else {
  for (const sample of corpus) {
    if (scenarioFilter.length > 0 && !scenarioFilter.includes(sample.name)) continue
    const envelope = { format: api.SDK52_RUNTIME.inputFormat, sdk: api.SDK52_RUNTIME.sdk, input: sample.input }
    const translated = await api.translateNativeInput(envelope)
    const run = () => api.nativeSimulate(translated.input)
    for (let index = 0; index < warmup; index += 1) run()
    const times = []
    const hashes = []
    for (let index = 0; index < runs; index += 1) {
      const startedAt = performance.now()
      const result = run()
      times.push(performance.now() - startedAt)
      hashes.push(digest(result))
    }
    report.scenarios.push({
      name: sample.name,
      inputSha256: digest(sample.input),
      rawMs: times,
      hashes,
      distinctHashes: [...new Set(hashes)],
      medianMs: median(times),
    })
    report.digests[sample.name] = hashes[0]
  }
}

const payload = `${JSON.stringify(report, null, 2)}\n`
if (out) writeFileSync(out, payload, 'utf8')
console.log(JSON.stringify({
  mode: report.mode,
  node: report.node,
  scenarios: report.scenarios.length,
  corpusIntact: report.corpus.intact,
  totalMs: report.totalMs ?? null,
  bundleSha256: report.bundleSha256,
  out,
}))
