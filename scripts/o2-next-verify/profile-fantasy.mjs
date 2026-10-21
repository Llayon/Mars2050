// O2.2 Fantasy contour (C) profiler. Region-scoped sampling: the inspector starts only around
// `nativeSimulate`, so module loading, esbuild-free bundle evaluation and the corpus read stay out.
//
//   node scripts/o2-next-verify/profile-fantasy.mjs --bundle <native-compare.mjs> \
//     --scenario recruit/dawn-oathkeeper/defender --mode cpu --warmup 1 --runs 3 --out <profile>
import { Session } from 'node:inspector/promises'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 ? process.argv[index + 1] : fallback
}

const FANTASY = arg('fantasy', 'D:/Max/fantasy-battles')
const FIXTURES = join(FANTASY, 'apps', 'fantasy', 'tests', 'fixtures', 'native-sdk')
const bundlePath = resolve(arg('bundle', ''))
const scenario = arg('scenario', '')
const mode = arg('mode', 'cpu')
const warmup = Number(arg('warmup', '1'))
const runs = Number(arg('runs', '3'))
const out = arg('out', '')

const sha256File = file => createHash('sha256').update(readFileSync(file)).digest('hex')
const corpus = [
  ...JSON.parse(gunzipSync(readFileSync(join(FIXTURES, 'corpus.json.gz')))).scenarios,
  ...JSON.parse(gunzipSync(readFileSync(join(FIXTURES, 'extra-corpus.json.gz')))).scenarios,
]
const sample = corpus.find(entry => entry.name === scenario)
if (!sample) throw new Error(`scenario not in corpus: ${scenario}`)

const api = await import(pathToFileURL(bundlePath).href)
const envelope = { format: api.SDK52_RUNTIME.inputFormat, sdk: api.SDK52_RUNTIME.sdk, input: sample.input }
const translated = await api.translateNativeInput(envelope)
const run = () => api.nativeSimulate(translated.input)
for (let index = 0; index < warmup; index += 1) run()

const session = new Session()
session.connect()
let profile
if (mode === 'heap') {
  await session.post('HeapProfiler.enable')
  await session.post('HeapProfiler.startSampling', {
    samplingInterval: 4096,
    includeObjectsCollectedByMajorGC: true,
    includeObjectsCollectedByMinorGC: true,
  })
  for (let index = 0; index < runs; index += 1) run()
  profile = (await session.post('HeapProfiler.stopSampling')).profile
} else {
  await session.post('Profiler.enable')
  await session.post('Profiler.setSamplingInterval', { interval: 100 })
  await session.post('Profiler.start')
  for (let index = 0; index < runs; index += 1) run()
  profile = (await session.post('Profiler.stop')).profile
}
session.disconnect()

if (out) writeFileSync(out, `${JSON.stringify(profile)}\n`, 'utf8')
console.log(JSON.stringify({
  contour: 'C', mode, scenario, warmup, runs,
  node: process.version,
  bundle: bundlePath.replace(/\\/g, '/'),
  bundleSha256: sha256File(bundlePath),
  out,
}, null, 2))
