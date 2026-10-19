// O2 A/B measurement harness — Mars Compat contour (B).
// Runs the Mars adapter end-to-end (translation + public core + compat mapping) through tsx, so
// the @mars2050/combat-core junction selects the variant exactly like measure-core.mjs does.
// Run from the Mars2050 worktree root:
//   O2_VARIANT=baseline npx tsx packages/combat-core/certify/o2-20261018/harness/measure-mars.ts \
//     --preset massive_clash --warmup 2 --runs 7 --out raw.json
import { createHash } from 'node:crypto'
import { readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { simulateBattle } from '@/domains/combat/combat.engine'
import { getSimulatorPreset } from '@/app/simulator2/simulator.presets'
import { translateMarsBattleInput } from '@/domains/combat/combat.input-translator'

const requireHere = createRequire(`${process.cwd().replace(/\\/g, '/')}/package.json`)
const SEED = 24680

function arg(name: string, fallback: string): string {
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 ? process.argv[index + 1] : fallback
}

const presets = arg('preset', 'massive_clash').split(',')
const warmup = Number(arg('warmup', '2'))
const runs = Number(arg('runs', '7'))
const out = arg('out', '')
const variant = process.env.O2_VARIANT ?? 'unknown'

const sha256 = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex')
const sha256File = (file: string) => createHash('sha256').update(readFileSync(file)).digest('hex')

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

function summarize(values: number[]) {
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

const resolvedEntry = requireHere.resolve('@mars2050/combat-core')
const packageJsonPath = resolve(resolvedEntry, '..', '..', 'package.json')
const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8'))
const provenance = {
  resolvedEntry: resolvedEntry.replace(/\\/g, '/'),
  realEntry: realpathSync(resolvedEntry).replace(/\\/g, '/'),
  entrySha256: sha256File(resolvedEntry),
  packageJsonSha256: sha256File(packageJsonPath),
  name: pkg.name,
  version: pkg.version,
}

const report: Record<string, unknown> = {
  variant,
  contour: 'B',
  node: process.version,
  platform: `${process.platform}-${process.arch}`,
  seed: SEED,
  warmup,
  runs,
  core: provenance,
  presets: {},
}

const presetRows: Record<string, unknown> = {}
for (const presetId of presets) {
  const preset = getSimulatorPreset(presetId)
  if (!preset) throw new Error(`Missing simulator preset: ${presetId}`)
  const input = translateMarsBattleInput(preset.attackers, preset.defenders, SEED, [], [], [], { profile: false })
  const inputSha256 = sha256(JSON.stringify(input))
  const run = () => simulateBattle(preset.attackers, preset.defenders, SEED, [], [], [], { profile: false })

  for (let index = 0; index < warmup; index += 1) run()

  const times: number[] = []
  const hashes: string[] = []
  for (let index = 0; index < runs; index += 1) {
    const startedAt = performance.now()
    const result = run()
    const elapsed = performance.now() - startedAt
    times.push(elapsed)
    hashes.push(sha256(JSON.stringify(result)))
  }

  const distinctHashes = [...new Set(hashes)]
  presetRows[presetId] = {
    note: 'Mars compat: simulateBattle end-to-end (translation + core + compat mapping timed)',
    seed: SEED,
    inputSha256,
    units: input.units.length,
    summary: summarize(times),
    rawMs: times,
    hashes,
    distinctHashes,
    resultInvariant: distinctHashes.length === 1,
  }
}
report.presets = presetRows

const json = `${JSON.stringify(report, null, 2)}\n`
if (out) writeFileSync(out, json, 'utf8')
console.log(json)
