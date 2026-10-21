// O2.2 diagnosis: size and cost of the one-shot ruleset hash for the Fantasy corpus scenarios.
// The battlefield adapter comes from the baseline Fantasy bundle (read-only input), the hash from
// the installed o2mv.1 core.
//
//   node scripts/o2-next-verify/diag-hash-c.mjs --bundle D:/Max/o2/fantasy-o22/baseline/native-compare.mjs
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 ? process.argv[index + 1] : fallback
}

const FIXTURES = join('D:/Max/fantasy-battles', 'apps', 'fantasy', 'tests', 'fixtures', 'native-sdk')
const bundlePath = resolve(arg('bundle', 'D:/Max/o2/fantasy-o22/baseline/native-compare.mjs'))
const core = arg('core', 'D:/Max/o2/baseline-o2/node_modules/@mars2050/combat-core').replace(/\\/g, '/')
const scenarios = arg('scenarios', 'recruit/orc-black-fang/attacker,recruit/dawn-oathkeeper/defender,recruit/dawn-shield-marshal/attacker,recruit/court-coffin-bearer/defender').split(',')
const iterations = Number(arg('iterations', '10'))

const { pureSha256, canonicalizeValue } = await import(`file:///${core}/dist/contracts/ruleset-identity.js`)
const api = await import(pathToFileURL(bundlePath).href)
const corpus = [
  ...JSON.parse(gunzipSync(readFileSync(join(FIXTURES, 'corpus.json.gz')))).scenarios,
  ...JSON.parse(gunzipSync(readFileSync(join(FIXTURES, 'extra-corpus.json.gz')))).scenarios,
]

function canonicalOf(input) {
  return JSON.stringify({
    rulesetId: input.rulesetId ?? input.rules.rulesetId ?? 'standard',
    rulesetVersion: input.rulesetVersion ?? input.rules.rulesetVersion ?? '1.0.0',
    rules: {
      maxTicks: input.rules.maxTicks ?? 2000,
      timeoutPolicy: input.rules.timeoutPolicy ?? 'draw',
      defenseResolutionMode: input.rules.defenseResolutionMode ?? 'v9_snapshot',
    },
    definitions: canonicalizeValue(input.definitions),
    ...(input.catalog ? { catalog: canonicalizeValue(input.catalog) } : {}),
  })
}

const report = { bundle: bundlePath.replace(/\\/g, '/'), bundleSha256: createHash('sha256').update(readFileSync(bundlePath)).digest('hex'), node: process.version, scenarios: {} }
for (const name of scenarios) {
  const sample = corpus.find(entry => entry.name === name)
  if (!sample) throw new Error(`missing scenario ${name}`)
  const envelope = { format: api.SDK52_RUNTIME.inputFormat, sdk: api.SDK52_RUNTIME.sdk, input: sample.input }
  const translated = await api.translateNativeInput(envelope)
  const text = canonicalOf(translated.input)
  const expected = createHash('sha256').update(text, 'utf8').digest('hex')
  const times = []
  for (let index = 0; index < iterations; index += 1) {
    const startedAt = performance.now()
    pureSha256(text)
    times.push(performance.now() - startedAt)
  }
  times.sort((left, right) => left - right)
  report.scenarios[name] = {
    chars: text.length,
    digest: pureSha256(text),
    digestMatchesNodeCrypto: pureSha256(text) === expected,
    hashMedianMs: times[Math.floor(times.length / 2)],
    hashMinMs: times[0],
    hashMaxMs: times[times.length - 1],
    iterations,
  }
}
console.log(JSON.stringify(report, null, 2))
