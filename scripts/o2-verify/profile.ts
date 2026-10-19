// Region-scoped V8 profiler for the O2 diagnosis.
// Uses the inspector session so ONLY the measured battle region is sampled: module loading, zod
// schema construction and the warmup runs stay outside the profile.
//   npx tsx scripts/o2-verify/profile.ts --contour A --mode heap --preset zerg_rush --runs 2 \
//     --out D:/Max/o2/profiles/candidate-A-zerg.heapprofile
import { Session } from 'node:inspector/promises'
import { createHash } from 'node:crypto'
import { readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { simulateCombat } from '@mars2050/combat-core'
import { simulateBattle } from '@/domains/combat/combat.engine'
import { getSimulatorPreset } from '@/app/simulator2/simulator.presets'
import { translateMarsBattleInput } from '@/domains/combat/combat.input-translator'

const requireHere = createRequire(`${process.cwd().replace(/\\/g, '/')}/package.json`)
const SEED = 24680
const INPUT_DIR = resolve('packages/combat-core/certify/o2-20261018/inputs')

function arg(name: string, fallback: string): string {
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 ? process.argv[index + 1] : fallback
}

async function main(): Promise<void> {
  const contour = arg('contour', 'A')
  const mode = arg('mode', 'heap')
  const presetId = arg('preset', 'zerg_rush')
  const warmup = Number(arg('warmup', '1'))
  const runs = Number(arg('runs', '2'))
  const out = arg('out', '')

  const resolvedEntry = requireHere.resolve('@mars2050/combat-core')
  const entrySha256 = createHash('sha256').update(readFileSync(resolvedEntry)).digest('hex')

  let run: () => unknown
  let note: string
  if (contour === 'A') {
    const input = JSON.parse(readFileSync(resolve(INPUT_DIR, `${presetId}.battle-input.json`), 'utf8'))
    run = () => simulateCombat(input)
    note = 'pure core'
  } else if (contour === 'B') {
    const preset = getSimulatorPreset(presetId)
    if (!preset) throw new Error(`Missing simulator preset: ${presetId}`)
    const translated = translateMarsBattleInput(preset.attackers, preset.defenders, SEED, [], [], [], { profile: false })
    void translated
    run = () => simulateBattle(preset.attackers, preset.defenders, SEED, [], [], [], { profile: false })
    note = 'mars compat'
  } else {
    throw new Error(`Unknown contour: ${contour}`)
  }

  for (let index = 0; index < warmup; index += 1) run()

  const session = new Session()
  session.connect()

  let profile: unknown
  if (mode === 'heap') {
    await session.post('HeapProfiler.enable')
    await session.post('HeapProfiler.startSampling', {
      samplingInterval: 4096,
      includeObjectsCollectedByMajorGC: true,
      includeObjectsCollectedByMinorGC: true,
    })
    for (let index = 0; index < runs; index += 1) run()
    profile = (await session.post('HeapProfiler.stopSampling')).profile
  } else if (mode === 'cpu') {
    await session.post('Profiler.enable')
    await session.post('Profiler.setSamplingInterval', { interval: 100 })
    await session.post('Profiler.start')
    for (let index = 0; index < runs; index += 1) run()
    profile = (await session.post('Profiler.stop')).profile
  } else {
    throw new Error(`Unknown mode: ${mode}`)
  }
  session.disconnect()

  const payload = `${JSON.stringify(profile)}\n`
  if (out) writeFileSync(out, payload, 'utf8')

  console.log(JSON.stringify({
    contour,
    mode,
    note,
    preset: presetId,
    warmup,
    runs,
    node: process.version,
    core: {
      resolvedEntry: resolvedEntry.replace(/\\/g, '/'),
      realEntry: realpathSync(resolvedEntry).replace(/\\/g, '/'),
      entrySha256,
    },
    out,
    bytes: payload.length,
  }, null, 2))
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
