// Compares a run-scenarios.mjs report against the accepted R7 matrix goldens.
// Exits non-zero on any field mismatch (positive check and matrix negative control).
import { readFileSync } from 'node:fs'

const [, , reportPath, goldenPath] = process.argv
if (!reportPath || !goldenPath) {
  console.error('usage: node check-matrix.mjs <report.json> <r7-matrix.json>')
  process.exit(2)
}

const report = JSON.parse(readFileSync(reportPath, 'utf8').replace(/^\uFEFF/, ''))
const golden = JSON.parse(readFileSync(goldenPath, 'utf8').replace(/^\uFEFF/, ''))
const FIELDS = [
  'winner',
  'terminationReason',
  'elapsedTicks',
  'initialStateCount',
  'survivorsCount',
  'logsCount',
  'initialStateSha256',
  'survivorsSha256',
  'logsSha256',
  'metadataSha256',
]

let allPass = true
const details = {}
for (const [key, expected] of Object.entries(golden.scenarios)) {
  const goldenNode = expected.nodeDeterminism
  const actual = report.results[key]
  if (!actual) {
    allPass = false
    details[key] = { ok: false, error: 'scenario missing from report' }
    continue
  }
  const matches = {}
  for (const field of FIELDS) matches[field] = actual[field] === goldenNode[field]
  const ok = Object.values(matches).every(Boolean)
  if (!ok) allPass = false
  details[key] = { ok, matches }
  const bad = Object.entries(matches).filter(([, value]) => !value).map(([key2]) => key2)
  console.log(`[${ok ? 'PASS' : 'FAIL'}] ${key}${ok ? '' : ` mismatched: ${bad.join(', ')}`}`)
}

console.log(`matrix-golden-equal=${allPass}`)
console.log(JSON.stringify({ reportPath, environment: report.environment, installedPackage: report.installedPackage, details }, null, 2))
process.exit(allPass ? 0 : 1)
