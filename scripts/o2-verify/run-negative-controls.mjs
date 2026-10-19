// O2 negative controls. Each mutation is applied in isolation to the working tree, the regression
// suite is run, and the file is restored byte-for-byte afterwards (the script fails if the restore
// is not byte-identical). A mutation that does NOT break the suite is reported as a failure of the
// control itself, because it would mean the suite cannot detect that class of aliasing/tail bug.
//
//   node scripts/o2-verify/run-negative-controls.mjs --out D:/Max/o2/evidence/negative-controls
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 ? process.argv[index + 1] : fallback
}

const repo = resolve(arg('repo', process.cwd()))
const outDir = resolve(arg('out', 'D:/Max/o2/evidence/negative-controls'))
const suite = 'packages/combat-core/tests/o2-buffer-isolation.test.ts'
mkdirSync(outDir, { recursive: true })

const LEDGER = 'packages/combat-core/src/combat.action-intent.ts'
const TARGETING = 'packages/combat-core/src/ecs/targeting-runtime.ts'

const MUTATIONS = [
  {
    id: 'shared-empty-status-array',
    // A single module-level empty array reused by every snapshot (the aliasing class the suite
    // must catch): still "empty", but no longer per-snapshot.
    edits: [{
      file: LEDGER,
      find: '  return source.length === 0 ? [] : structuredClone(source)',
      replace: '  return source.length === 0 ? SHARED_EMPTY_STATUSES : structuredClone(source)',
    }, {
      file: LEDGER,
      find: 'function cloneStatusEffects(source: RuntimeStatusEffect[]): RuntimeStatusEffect[] {',
      replace: 'const SHARED_EMPTY_STATUSES: RuntimeStatusEffect[] = []\nfunction cloneStatusEffects(source: RuntimeStatusEffect[]): RuntimeStatusEffect[] {',
    }],
    expectFailing: ['never aliases the live status list'],
  },
  {
    id: 'alias-live-status-array',
    // The pre-O2 naivety, taken to the extreme: hand the live component array to the frame.
    edits: [{
      file: LEDGER,
      find: '  return source.length === 0 ? [] : structuredClone(source)',
      replace: '  return source',
    }],
    expectFailing: ['never aliases the live status list', 'copies a populated status list'],
  },
  {
    id: 'drop-targeting-scratch-reset',
    // Reusable candidate buffer without a length reset: the next query keeps the previous tail.
    edits: [{
      file: TARGETING,
      find: '    const scratch = this.scratch\n    scratch.reset()',
      replace: '    const scratch = this.scratch',
    }],
    expectFailing: ['leaves no tail', 'deterministic candidate order'],
  },
]

const sha256 = file => createHash('sha256').update(readFileSync(file)).digest('hex')

function runSuite(label) {
  const result = spawnSync(process.execPath, ['node_modules/vitest/vitest.mjs', 'run',
    '--config', 'packages/combat-core/vitest.config.ts', suite], { cwd: repo, encoding: 'utf8', maxBuffer: 1 << 28 })
  const output = `${result.stdout}\n${result.stderr}`
  writeFileSync(join(outDir, `${label}.log`), output, 'utf8')
  const testsLine = output.split(/\r?\n/).find(line => line.includes('Tests ')) ?? ''
  const failed = Number(/Tests\s+(\d+) failed/.exec(testsLine)?.[1] ?? 0)
  const passed = Number(/Tests\s+(\d+) passed/.exec(testsLine)?.[1] ?? 0)
  const failingTitles = [...output.matchAll(/FAIL\s+\S+\s+>\s+(.+)/g)].map(match => match[1].trim())
  return { exitCode: result.status, failed, passed, failingTitles, testsLine: testsLine.trim() }
}

const baseline = runSuite('00-unmutated')
const report = {
  generatedAt: new Date().toISOString(),
  repo,
  suite,
  node: process.version,
  baseline,
  mutations: [],
}

for (const mutation of MUTATIONS) {
  const backups = []
  const before = []
  for (const edit of mutation.edits) {
    const file = join(repo, edit.file)
    const backup = join(outDir, `${mutation.id}__${edit.file.replace(/[\\/]/g, '_')}.bak`)
    copyFileSync(file, backup)
    backups.push({ file, backup, sha: sha256(file) })
    before.push(file)
  }
  let applied = true
  for (const edit of mutation.edits) {
    const file = join(repo, edit.file)
    const text = readFileSync(file, 'utf8')
    const variants = [edit.find, edit.find.replace(/\n/g, '\r\n')]
    const match = variants.find(variant => text.includes(variant))
    if (!match) {
      applied = false
      break
    }
    const replacement = match === edit.find ? edit.replace : edit.replace.replace(/\n/g, '\r\n')
    writeFileSync(file, text.replace(match, replacement), 'utf8')
  }

  let outcome = { skipped: true }
  if (applied) {
    outcome = runSuite(`10-${mutation.id}`)
  }

  let restored = true
  for (const entry of backups) {
    copyFileSync(entry.backup, entry.file)
    if (sha256(entry.file) !== entry.sha) restored = false
  }

  const failing = mutation.expectFailing.every(fragment => outcome.failingTitles?.some(title => title.includes(fragment)))
  report.mutations.push({
    id: mutation.id,
    applied,
    restoredByteIdentical: restored,
    expectedFailureObserved: Boolean(failing),
    controlPassed: applied && restored && failing && (outcome.failed ?? 0) > 0,
    outcome,
    files: before.map(file => file.replace(/\\/g, '/')),
  })
  console.log(`${mutation.id}: applied=${applied} restored=${restored} controlPassed=${report.mutations[report.mutations.length - 1].controlPassed} ${outcome.testsLine ?? ''}`)
}

const final = runSuite('90-restored')
report.final = final
report.allControlsPassed = report.mutations.every(entry => entry.controlPassed)
report.restoredSuiteGreen = final.failed === 0 && baseline.failed === 0
writeFileSync(join(outDir, 'negative-controls.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8')
console.log(`allControlsPassed=${report.allControlsPassed} restoredSuiteGreen=${report.restoredSuiteGreen}`)
process.exit(report.allControlsPassed && report.restoredSuiteGreen ? 0 : 1)
