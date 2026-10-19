// Freezes the canonical Mars preset battle inputs used by every O2 measurement contour.
// Run from the Mars2050 worktree root: npx tsx scripts/o2-verify/freeze-inputs.ts
import { mkdirSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
import { getSimulatorPreset } from '@/app/simulator2/simulator.presets'
import { translateMarsBattleInput } from '@/domains/combat/combat.input-translator'

const SEED = 24680
const OUT_DIR = resolve('packages/combat-core/certify/o2-20261018/inputs')
const PRESETS = ['massive_clash', 'zerg_rush']

mkdirSync(OUT_DIR, { recursive: true })

const sha256 = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex')
const rows = []

for (const presetId of PRESETS) {
  const preset = getSimulatorPreset(presetId)
  if (!preset) throw new Error(`Missing simulator preset: ${presetId}`)
  const input = translateMarsBattleInput(preset.attackers, preset.defenders, SEED, [], [], [], { profile: false })
  const text = `${JSON.stringify(input, null, 2)}\n`
  const file = resolve(OUT_DIR, `${presetId}.battle-input.json`)
  writeFileSync(file, text, 'utf8')
  rows.push({
    presetId,
    seed: SEED,
    units: input.units.length,
    definitions: Object.keys(input.definitions).length,
    rules: input.rules,
    arena: input.arena,
    bytes: Buffer.byteLength(text),
    sha256: sha256(text),
  })
}

writeFileSync(resolve(OUT_DIR, 'index.json'), `${JSON.stringify({
  generator: 'scripts/o2-verify/freeze-inputs.ts',
  translator: 'src/domains/combat/combat.input-translator.ts (base commit 1134ffa9b80b3d66aee447e557e3bb20507b9269)',
  seed: SEED,
  inputs: rows,
}, null, 2)}\n`, 'utf8')

console.log(JSON.stringify(rows, null, 2))
