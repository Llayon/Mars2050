// O2 A/B measurement harness — Pure Core contour (A).
// Loads the public `simulateCombat` of the INSTALLED @mars2050/combat-core resolved from the
// Mars2050 worktree node_modules junction, so the driver can point the junction at the baseline
// tarball install or at the candidate package before spawning this process.
//
// Plain ESM on purpose: no transpiler in the timed loop, and `import.meta.resolve` gives the
// exact module provenance for the numbers in the report.
//
//   node packages/combat-core/certify/o2-20261018/harness/measure-core.mjs \
//     --preset massive_clash --warmup 2 --runs 7 --out raw.json
import { createHash } from 'node:crypto'
import { readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const INPUT_DIR = resolve(HERE, '..', '..', 'packages', 'combat-core', 'certify', 'o2-20261018', 'inputs')

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 ? process.argv[index + 1] : fallback
}

const presets = arg('preset', 'massive_clash').split(',')
const warmup = Number(arg('warmup', '2'))
const runs = Number(arg('runs', '7'))
const out = arg('out', undefined)
const variant = process.env.O2_VARIANT ?? 'unknown'

const sha256 = text => createHash('sha256').update(text, 'utf8').digest('hex')
const sha256File = file => createHash('sha256').update(readFileSync(file)).digest('hex')

function median(values) {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

function summarize(values) {
  const med = median(values)
  return {
    runs: values.length,
    medianMs: med,
    meanMs: values.reduce((a, b) => a + b, 0) / values.length,
    minMs: Math.min(...values),
    maxMs: Math.max(...values),
    spreadMs: Math.max(...values) - Math.min(...values),
    madMs: median(values.map(value => Math.abs(value - med))),
  }
}

const entryUrl = import.meta.resolve('@mars2050/combat-core')
const entryPath = fileURLToPath(entryUrl)
const packageJsonPath = resolve(entryPath, '..', '..', 'package.json')
const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8'))
const provenance = {
  entryUrl,
  resolvedEntry: entryPath.replace(/\\/g, '/'),
  realEntry: realpathSync(entryPath).replace(/\\/g, '/'),
  entrySha256: sha256File(entryPath),
  packageJsonPath: packageJsonPath.replace(/\\/g, '/'),
  packageJsonSha256: sha256File(packageJsonPath),
  name: pkg.name,
  version: pkg.version,
}

const { simulateCombat } = await import(entryUrl)

const report = {
  variant,
  contour: 'A',
  node: process.version,
  platform: `${process.platform}-${process.arch}`,
  warmup,
  runs,
  core: provenance,
  presets: {},
}

for (const presetId of presets) {
  const inputPath = join(INPUT_DIR, `${presetId}.battle-input.json`)
  const inputText = readFileSync(inputPath, 'utf8')
  const input = JSON.parse(inputText)

  for (let index = 0; index < warmup; index += 1) simulateCombat(input)

  const times = []
  const hashes = []
  for (let index = 0; index < runs; index += 1) {
    const startedAt = performance.now()
    const result = simulateCombat(input)
    const elapsed = performance.now() - startedAt
    times.push(elapsed)
    hashes.push(sha256(JSON.stringify(result)))
  }

  const distinctHashes = [...new Set(hashes)]
  report.presets[presetId] = {
    note: 'pure core: public simulateCombat(frozen translated BattleInput)',
    inputPath: inputPath.replace(/\\/g, '/'),
    inputSha256: sha256(inputText),
    units: input.units.length,
    summary: summarize(times),
    rawMs: times,
    hashes,
    distinctHashes,
    resultInvariant: distinctHashes.length === 1,
  }
}

const json = `${JSON.stringify(report, null, 2)}\n`
if (out) writeFileSync(out, json, 'utf8')
console.log(json)
