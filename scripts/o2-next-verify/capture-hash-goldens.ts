// Captures the exact digests the new O2.2 sensitivity test pins: sha256 length boundaries, a large
// multi-block string, and the canonical ruleset identity of the shared O2 fixture input, computed by
// the ACCEPTED o2mv.1 package (baseline) and cross-checked against node:crypto.
//
//   npx tsx scripts/o2-next-verify/capture-hash-goldens.mjs --core D:/Max/o2/baseline-o2/node_modules/@mars2050/combat-core
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { smallBattle } from '../../packages/combat-core/tests/o2-fixtures.js'

function arg(name: string, fallback: string): string {
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 ? process.argv[index + 1] : fallback
}

async function main(): Promise<void> {
  const core = resolve(arg('core', 'D:/Max/o2/baseline-o2/node_modules/@mars2050/combat-core')).replace(/\\/g, '/')
  const { pureSha256, computeRulesetIdentity } = await import(`file:///${core}/dist/contracts/ruleset-identity.js`)

  const h = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex')
  const lengths = [0, 1, 3, 55, 56, 57, 63, 64, 65, 119, 120, 127, 128, 146331]
  const pinned: Record<string, string> = {}
  for (const length of lengths) {
    const text = 'a'.repeat(length)
    const candidate = pureSha256(text)
    pinned[String(length)] = candidate
    if (candidate !== h(text)) throw new Error(`length ${length} mismatch`)
  }
  const identity = computeRulesetIdentity(smallBattle())
  console.log(JSON.stringify({
    core,
    entrySha256: createHash('sha256').update(readFileSync(`${core}/dist/index.js`)).digest('hex'),
    pinned,
    identityDigest: identity.contentHash,
    identityId: identity.id,
    identityVersion: identity.version,
  }, null, 2))
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
