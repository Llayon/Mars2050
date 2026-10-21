// O2.2 diagnosis: how much of a battle is the one-shot ruleset identity hash?
// Loads the installed baseline package internals directly (no bundling) and reports the canonical
// JSON size plus the wall time of pureSha256 over exactly that string.
//
//   node scripts/o2-next-verify/diag-hash.mjs --core D:/Max/o2/baseline-o2/node_modules/@mars2050/combat-core
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 ? process.argv[index + 1] : fallback
}

const core = resolve(arg('core', 'D:/Max/o2/baseline-o2/node_modules/@mars2050/combat-core')).replace(/\\/g, '/')
const inputs = arg('inputs', 'D:/Max/Mars2050-o2/packages/combat-core/certify/o2-20261018/inputs')
const iterations = Number(arg('iterations', '20'))

const { pureSha256, canonicalizeValue } = await import(`file:///${core}/dist/contracts/ruleset-identity.js`)
const input = JSON.parse(readFileSync(join(inputs, 'massive_clash.battle-input.json'), 'utf8'))

const canonicalData = {
  rulesetId: input.rulesetId ?? input.rules.rulesetId ?? 'standard',
  rulesetVersion: input.rulesetVersion ?? input.rules.rulesetVersion ?? '1.0.0',
  rules: {
    maxTicks: input.rules.maxTicks ?? 2000,
    timeoutPolicy: input.rules.timeoutPolicy ?? 'draw',
    defenseResolutionMode: input.rules.defenseResolutionMode ?? 'v9_snapshot',
  },
  definitions: canonicalizeValue(input.definitions),
  ...(input.catalog ? { catalog: canonicalizeValue(input.catalog) } : {}),
}
const jsonStr = JSON.stringify(canonicalData)

const canonicalizeStart = performance.now()
for (let index = 0; index < iterations; index += 1) {
  JSON.stringify({
    definitions: canonicalizeValue(input.definitions),
    ...(input.catalog ? { catalog: canonicalizeValue(input.catalog) } : {}),
  })
}
const canonicalizeMs = (performance.now() - canonicalizeStart) / iterations

const times = []
let digest = ''
for (let index = 0; index < iterations; index += 1) {
  const startedAt = performance.now()
  digest = pureSha256(jsonStr)
  times.push(performance.now() - startedAt)
}
times.sort((a, b) => a - b)

console.log(JSON.stringify({
  core,
  entrySha256: createHash('sha256').update(readFileSync(`${core}/dist/index.js`)).digest('hex'),
  node: process.version,
  canonicalJsonChars: jsonStr.length,
  canonicalJsonSha256: createHash('sha256').update(jsonStr, 'utf8').digest('hex'),
  digest,
  digestMatchesNodeCrypto: createHash('sha256').update(jsonStr, 'utf8').digest('hex') === digest,
  hashMedianMs: times[Math.floor(times.length / 2)],
  hashMinMs: times[0],
  hashMaxMs: times[times.length - 1],
  canonicalizePlusStringifyMedianMs: canonicalizeMs,
  iterations,
}, null, 2))
