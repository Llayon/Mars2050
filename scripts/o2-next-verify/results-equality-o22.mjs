// O2.2 direct result equality: the accepted o2mv.1 install and the installed o2.2 archive must
// produce a byte-identical JSON result for both canonical inputs (not only inside the A/B driver).
//
//   node scripts/o2-next-verify/results-equality-o22.mjs
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const BASELINE = 'D:/Max/o2/baseline-o2/node_modules/@mars2050/combat-core'
const CANDIDATE = 'D:/Max/o2/consumer-o22/node_modules/@mars2050/combat-core'
const INPUTS = 'D:/Max/Mars2050-o2/packages/combat-core/certify/o2-20261018/inputs'
const OUT = 'D:/Max/o2/evidence-o22/results-equality.json'

const sha256 = text => createHash('sha256').update(text, 'utf8').digest('hex')
const baseline = await import(pathToFileURL(join(BASELINE, 'dist/index.js')).href)
const candidate = await import(pathToFileURL(join(CANDIDATE, 'dist/index.js')).href)

const report = { baseline: BASELINE, candidate: CANDIDATE, node: process.version, cases: {} }
for (const preset of ['massive_clash', 'zerg_rush']) {
  const text = readFileSync(join(INPUTS, `${preset}.battle-input.json`), 'utf8')
  const input = JSON.parse(text)
  const baselineResult = JSON.stringify(baseline.simulateCombat(input))
  const candidateResult = JSON.stringify(candidate.simulateCombat(input))
  report.cases[preset] = {
    inputSha256: sha256(text),
    baselineResultSha256: sha256(baselineResult),
    candidateResultSha256: sha256(candidateResult),
    equal: baselineResult === candidateResult,
    baselineBytes: baselineResult.length,
    candidateBytes: candidateResult.length,
    rulesetContentHash: JSON.parse(candidateResult).metadata.ruleset.contentHash,
  }
}
report.allEqual = Object.values(report.cases).every(row => row.equal)
writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
console.log(JSON.stringify({ allEqual: report.allEqual, cases: Object.fromEntries(Object.entries(report.cases).map(([k, v]) => [k, v.candidateResultSha256.slice(0, 16)])) }, null, 2))
