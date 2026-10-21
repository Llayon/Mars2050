// O2.2 negative controls. The sensitivity test is run against deliberately broken copies of the
// optimised module, in an ISOLATED COPY of the package (the working tree is never mutated). The
// script is a gate: it exits non-zero unless the pristine copy is green, every mutation behaves as
// declared, every restore is byte-identical, the restored copy is green again and the working tree
// is untouched.
//
//   node scripts/o2-next-verify/run-negative-controls-o22.mjs --out D:/Max/o2/evidence-o22/negative-controls
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 ? process.argv[index + 1] : fallback
}

const REPO = resolve('D:/Max/Mars2050-o2')
const LAB = resolve(arg('lab', 'D:/Max/o2/nc-o22'))
const OUT = resolve(arg('out', 'D:/Max/o2/evidence-o22/negative-controls'))
const SOURCE = join(REPO, 'packages', 'combat-core')
const TARGET = join(LAB, 'combat-core', 'src', 'contracts', 'ruleset-identity.ts')
const TEST = join(LAB, 'combat-core', 'tests', 'o22-ruleset-hash.test.ts')
const VITEST = join(REPO, 'node_modules', 'vitest', 'vitest.mjs')
const TSX = join(REPO, 'node_modules', 'tsx', 'dist', 'cli.mjs')

const sha256 = file => createHash('sha256').update(readFileSync(file)).digest('hex')
const pristineSha = sha256(join(SOURCE, 'src', 'contracts', 'ruleset-identity.ts'))
const workingTreeShaBefore = pristineSha

rmSync(LAB, { recursive: true, force: true })
mkdirSync(join(LAB, 'combat-core', 'tests'), { recursive: true })
mkdirSync(OUT, { recursive: true })

spawnSync(process.platform === 'win32' ? 'robocopy' : 'cp', process.platform === 'win32'
  ? [join(SOURCE, 'src'), join(LAB, 'combat-core', 'src'), '/E', '/NFL', '/NDL', '/NJH', '/NJS', '/NC', '/NS', '/NP']
  : ['-r', join(SOURCE, 'src'), join(LAB, 'combat-core', 'src')], { encoding: 'utf8' })
copyFileSync(join(SOURCE, 'tests', 'o22-ruleset-hash.test.ts'), TEST)
copyFileSync(join(SOURCE, 'tests', 'o2-fixtures.ts'), join(LAB, 'combat-core', 'tests', 'o2-fixtures.ts'))
copyFileSync(join(SOURCE, 'tsconfig.json'), join(LAB, 'combat-core', 'tsconfig.json'))
writeFileSync(join(LAB, 'vitest.config.mjs'), `export default {
  test: { environment: 'node', include: ['combat-core/tests/o22-ruleset-hash.test.ts'], testTimeout: 60_000 },
}\n`, 'utf8')
if (!existsSync(join(LAB, 'node_modules'))) {
  spawnSync('cmd', ['/c', 'mklink', '/J', join(LAB, 'node_modules'), join(REPO, 'node_modules')], { encoding: 'utf8' })
}

// Block-scope probe: hashes single-block and multi-block payloads with whatever version of the
// module is in the copy, so a mutation can be shown to be genuinely multi-block-only.
const PROBE = join(LAB, 'probe.ts')
writeFileSync(PROBE, `import { createHash } from 'node:crypto'
import { pureSha256 } from './combat-core/src/contracts/ruleset-identity.js'
const SINGLE = [0, 1, 3, 55]
const MULTI = [56, 64, 119, 146331]
const nodeCrypto = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex')
const single: Record<string, boolean> = {}
const multi: Record<string, boolean> = {}
for (const length of SINGLE) single[String(length)] = pureSha256('a'.repeat(length)) === nodeCrypto('a'.repeat(length))
for (const length of MULTI) multi[String(length)] = pureSha256('a'.repeat(length)) === nodeCrypto('a'.repeat(length))
console.log(JSON.stringify({ singleBlockMatchesNodeCrypto: single, multiBlockMatchesNodeCrypto: multi }))
`, 'utf8')

function runProbe() {
  const result = spawnSync(process.execPath, [TSX, PROBE], { cwd: LAB, encoding: 'utf8', maxBuffer: 1 << 24 })
  if (result.status !== 0) return { exitStatus: result.status, error: (result.stderr ?? '').slice(-800) }
  const line = (result.stdout ?? '').trim().split(/\r?\n/).pop() ?? '{}'
  return { exitStatus: result.status, ...JSON.parse(line) }
}

const pristineText = readFileSync(join(SOURCE, 'src', 'contracts', 'ruleset-identity.ts'), 'utf8')

const MUTATIONS = [
  {
    id: 'rotation',
    expectFail: true,
    singleBlockSafe: false,
    note: 'Sigma1 uses rotate 7 instead of 6 - one wrong rotation in the compression round',
    apply: text => text.replace('rightRotate(e, 6)', 'rightRotate(e, 7)'),
  },
  {
    id: 'block-step',
    expectFail: true,
    singleBlockSafe: true,
    note: 'the block loop advances by two blocks instead of one - a single-block payload is still hashed by the same first block, every payload of two or more blocks drops its odd blocks',
    apply: text => text.replace('block += 16', 'block += 32'),
  },
  {
    id: 'block-count',
    expectFail: true,
    singleBlockSafe: false,
    note: 'padding block count off by one - the final block carrying the length is dropped',
    apply: text => text.replace('const blockWords = (((bytes.length + 8) >> 6) + 1) * 16', 'const blockWords = (((bytes.length + 8) >> 6)) * 16'),
  },
  {
    id: 'length-high-word',
    expectFail: false,
    singleBlockSafe: false,
    note: 'high 32 bits of the message bit length dropped - mathematically unobservable below 512 MiB, so the suite is expected to stay GREEN; recorded to show the controls are not a blunt instrument',
    apply: text => text.replace('words[blockWords - 2] = (bitLength / 4294967296) | 0', 'words[blockWords - 2] = 0'),
  },
]

function runSuite() {
  const result = spawnSync(process.execPath, [VITEST, 'run', '--config', join(LAB, 'vitest.config.mjs')], {
    cwd: LAB, encoding: 'utf8', maxBuffer: 1 << 26,
  })
  const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`
  const failed = [...output.matchAll(/FAIL\s+([^\n]+)/g)].map(match => match[1].trim())
  const summary = output.match(/Tests\s+([^\n]+)/)?.[1]?.trim() ?? ''
  return { status: result.status, failed, summary }
}

const problems = []
const controls = []

const baseline = runSuite()
const baselineProbe = runProbe()
if (baseline.status !== 0) problems.push(`pristine copy is red (exit ${baseline.status})`)
if (baselineProbe.exitStatus !== 0) problems.push('pristine probe failed')
for (const [length, ok] of Object.entries(baselineProbe.singleBlockMatchesNodeCrypto ?? {})) {
  if (!ok) problems.push(`pristine copy disagrees with node:crypto at single-block length ${length}`)
}
for (const [length, ok] of Object.entries(baselineProbe.multiBlockMatchesNodeCrypto ?? {})) {
  if (!ok) problems.push(`pristine copy disagrees with node:crypto at multi-block length ${length}`)
}

for (const mutation of MUTATIONS) {
  const mutated = mutation.apply(pristineText)
  if (mutated === pristineText) throw new Error(`mutation ${mutation.id} did not apply`)
  writeFileSync(TARGET, mutated, 'utf8')
  const probe = runProbe()
  const run = runSuite()
  writeFileSync(TARGET, pristineText, 'utf8')
  const restoredByteIdentical = sha256(TARGET) === pristineSha
  const behavedAsExpected = mutation.expectFail ? run.status !== 0 && run.failed.length > 0 : run.status === 0
  const singleBlockOnly = mutation.singleBlockSafe
    ? Object.values(probe.singleBlockMatchesNodeCrypto ?? { false: false }).every(Boolean) &&
      Object.values(probe.multiBlockMatchesNodeCrypto ?? {}).length > 0 &&
      Object.values(probe.multiBlockMatchesNodeCrypto ?? {}).every(ok => ok === false)
    : null
  controls.push({
    id: mutation.id,
    note: mutation.note,
    expectFail: mutation.expectFail,
    singleBlockSafe: mutation.singleBlockSafe,
    singleBlockOnly,
    mutatedSha256: createHash('sha256').update(mutated).digest('hex'),
    exitStatus: run.status,
    failedTests: run.failed,
    testSummary: run.summary,
    probe,
    behavedAsExpected,
    restoredByteIdentical,
  })
  if (!behavedAsExpected) problems.push(`control ${mutation.id} did not behave as declared (exit ${run.status}, ${run.failed.length} failing tests)`)
  if (!restoredByteIdentical) problems.push(`control ${mutation.id} was not restored byte-identically`)
  if (singleBlockOnly === false) problems.push(`control ${mutation.id} was expected to be multi-block-only but the probe disagrees`)
  console.log(`${mutation.id}: expectFail=${mutation.expectFail} exit=${run.status} failed=${run.failed.length} ` +
    `singleBlockOnly=${singleBlockOnly} restored=${restoredByteIdentical}`)
}

const after = runSuite()
if (after.status !== 0) problems.push(`restored copy is red (exit ${after.status})`)
const workingTreeShaAfter = sha256(join(SOURCE, 'src', 'contracts', 'ruleset-identity.ts'))
if (workingTreeShaAfter !== workingTreeShaBefore) problems.push('the working tree module changed during the control run')

const report = {
  generatedAt: new Date().toISOString(),
  node: process.version,
  lab: LAB.replace(/\\/g, '/'),
  sourceModule: join(SOURCE, 'src', 'contracts', 'ruleset-identity.ts').replace(/\\/g, '/'),
  sourceSha256: pristineSha,
  workingTreeShaBefore,
  workingTreeShaAfter,
  baselineRun: baseline,
  baselineProbe,
  controls,
  restoredSuiteGreen: after.status === 0,
  problems,
  allControlsPassed: problems.length === 0,
}
writeFileSync(join(OUT, 'negative-controls.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8')
console.log(JSON.stringify({
  allControlsPassed: report.allControlsPassed,
  restoredSuiteGreen: report.restoredSuiteGreen,
  workingTreeUntouched: workingTreeShaBefore === workingTreeShaAfter,
  problems,
}, null, 2))
if (problems.length > 0) process.exitCode = 1
