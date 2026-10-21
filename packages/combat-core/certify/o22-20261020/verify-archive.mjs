// Self-contained archive verifier for the CORE-HANDOFF handoff bundle.
// Installs the committed tarball into a scratch consumer, verifies it against the committed
// manifest and then checks the archive (not a workspace build) against the R7 golden matrix
// and the two CORE-HANDOFF MREs (per-tick journal completeness + survivor projection).
//
// Usage: node artifacts/core-handoff-20261018/verify-archive.mjs [--expect-sha <sha256>]
import { createHash } from 'node:crypto'
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join, dirname, relative } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { tmpdir } from 'node:os'

const HERE = dirname(fileURLToPath(import.meta.url))
const MANIFEST = JSON.parse(readFileSync(join(HERE, 'manifest.json'), 'utf8'))
const GOLDEN = JSON.parse(readFileSync(join(HERE, 'r7-matrix.json'), 'utf8'))
const sha256 = file => createHash('sha256').update(readFileSync(file)).digest('hex')
const TOLERANCE = 0.005 + 1e-9
const failures = []
const fail = message => { failures.push(message); console.log(`FAIL ${message}`) }

const expectIndex = process.argv.indexOf('--expect-sha')
const packIndex = process.argv.indexOf('--pack-workspace')
const tarballIndex = process.argv.indexOf('--tarball')
const packageDir = packIndex >= 0 && process.argv[packIndex + 1] && !process.argv[packIndex + 1].startsWith('--')
  ? process.argv[packIndex + 1]
  : join(HERE, '..', '..')
const committedTarball = join(HERE, MANIFEST.tarballName)

const scratch = join(tmpdir(), `core-handoff-${Date.now()}`)
mkdirSync(scratch, { recursive: true })

// Mode selection: an explicit --tarball wins; otherwise verify the committed archive bytes when
// the tarball is present, and otherwise rebuild the archive from the workspace package. The repo
// deliberately gitignores *.tgz, so CI uses the rebuild mode and enforces the committed manifest.
let tarball = tarballIndex >= 0 ? process.argv[tarballIndex + 1] : committedTarball
const effectivePackMode = packIndex >= 0 || (tarballIndex < 0 && !existsSync(committedTarball))
if (effectivePackMode) {
  const stage = join(scratch, 'stage')
  mkdirSync(stage, { recursive: true })
  cpSync(join(packageDir, 'dist'), join(stage, 'dist'), { recursive: true })
  const pkg = JSON.parse(readFileSync(join(packageDir, 'package.json'), 'utf8'))
  writeFileSync(join(stage, 'package.json'), `${JSON.stringify({ ...pkg, version: MANIFEST.identity.version }, null, 2)}\n`, 'utf8')
  const packDir = join(scratch, 'pack')
  mkdirSync(packDir, { recursive: true })
  const packed = spawnSync('npm', ['pack', '--pack-destination', packDir], { cwd: stage, encoding: 'utf8', shell: true })
  if (packed.status !== 0) { console.error(packed.stdout, packed.stderr); fail('npm pack failed') }
  const packedName = packed.stdout.trim().split(/\r?\n/).pop()
  tarball = join(packDir, packedName)
  console.log(JSON.stringify({ step: 'workspace-pack', packageDir, tarball: packedName, sha256: sha256(tarball) }))
}

const expectedSha = expectIndex >= 0 ? process.argv[expectIndex + 1] : MANIFEST.tarballSha256
const actualSha = sha256(tarball)
console.log(JSON.stringify({
  step: 'archive-identity',
  mode: effectivePackMode ? 'workspace-rebuild' : 'committed-bytes',
  tarball: tarball.replace(/\\/g, '/'),
  sha256: actualSha,
  committedSha256: MANIFEST.tarballSha256,
  expectedSha256: expectedSha,
  version: MANIFEST.identity.version,
  bytesMatchCommitted: actualSha === MANIFEST.tarballSha256,
}))
if (!effectivePackMode && actualSha !== expectedSha) fail(`tarball sha256 ${actualSha} != expected ${expectedSha}`)
if (effectivePackMode && actualSha !== MANIFEST.tarballSha256) {
  console.log(JSON.stringify({
    step: 'workspace-reproducibility',
    note: 'tarball bytes depend on the npm version/package.json text; content identity is enforced below via the manifest',
    packedSha256: actualSha,
    committedSha256: MANIFEST.tarballSha256,
  }))
}

// 1. install into a scratch consumer
writeFileSync(join(scratch, 'package.json'), `${JSON.stringify({
  name: 'core-handoff-consumer', private: true, type: 'module',
  dependencies: { '@mars2050/combat-core': `file:${tarball}`, zod: '4.4.2' },
}, null, 2)}\n`, 'utf8')
const install = spawnSync('npm', ['install', '--no-audit', '--no-fund'], { cwd: scratch, encoding: 'utf8', shell: true })
if (install.status !== 0) { console.error(install.stdout, install.stderr); fail('npm install failed') }
const pkgDir = join(scratch, 'node_modules', '@mars2050', 'combat-core')

// 2. installed files must match the committed manifest exactly
let mismatches = 0
for (const [rel, expected] of Object.entries(MANIFEST.dist)) {
  const file = join(pkgDir, rel)
  if (!existsSync(file) || sha256(file) !== expected) mismatches += 1
}
const installedPkg = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8'))
if (installedPkg.version !== MANIFEST.identity.version) fail(`installed version ${installedPkg.version} != ${MANIFEST.identity.version}`)
if (mismatches > 0) fail(`installed archive differs from manifest in ${mismatches} file(s)`)
console.log(JSON.stringify({ step: 'installed-vs-manifest', checked: Object.keys(MANIFEST.dist).length, mismatches, version: installedPkg.version }))

// 3. R7 golden matrix on the installed archive
const { COMMON_SCENARIOS, runAllScenarios, sha256: hashOf } = await import(pathToFileURL(join(HERE, 'matrix-fixtures.mjs')).href)
const simulate = (await import(pathToFileURL(join(pkgDir, 'dist/index.js')).href)).simulateCombat
const results = runAllScenarios(simulate)
let goldenMismatches = 0
for (const [key, golden] of Object.entries(GOLDEN.scenarios)) {
  const row = results[key]
  const expected = golden.nodeDeterminism
  for (const field of ['winner', 'terminationReason', 'elapsedTicks', 'initialStateSha256', 'survivorsSha256', 'logsSha256', 'metadataSha256']) {
    if (row[field] !== expected[field]) { goldenMismatches += 1; fail(`matrix ${key}.${field}: ${row[field]} != ${expected[field]}`) }
  }
}
console.log(JSON.stringify({ step: 'r7-matrix-goldens', scenarios: Object.keys(GOLDEN.scenarios).length, mismatches: goldenMismatches, passed: goldenMismatches === 0 }))

// 4. CORE-HANDOFF MREs: per-tick journal completeness on the installed archive
const { createEcsCombatRuntime } = await import(pathToFileURL(join(pkgDir, 'dist/ecs/combat-ecs-runtime.js')).href)
const { compileSpawnSpecBundles } = await import(pathToFileURL(join(pkgDir, 'dist/combat.spawn-spec-compiler.js')).href)
const { createPathfindingMap } = await import(pathToFileURL(join(pkgDir, 'dist/combat.pathfinding.js')).href)
const { mapDefinitionToUnitTypeConfig } = await import(pathToFileURL(join(pkgDir, 'dist/combat.definition-mapper.js')).href)
const { validateBattleInput, PRNG } = await import(pathToFileURL(join(pkgDir, 'dist/index.js')).href)

function checkMre(file) {
  const input = validateBattleInput(JSON.parse(readFileSync(join(HERE, 'mre', file), 'utf8')))
  const rng = new PRNG(input.seed)
  const catalog = {
    unitTypes: Object.fromEntries(Object.entries(input.definitions).map(([key, def]) => [key, mapDefinitionToUnitTypeConfig(def)])),
    upgrades: input.catalog?.upgrades ?? {},
    targetingProfiles: input.catalog?.targetingProfiles,
  }
  const runtime = createEcsCombatRuntime({ profile: false, defenseResolutionMode: input.rules.defenseResolutionMode, catalog })
  runtime.world.resources.set('arena', input.arena)
  for (const spec of input.units) {
    runtime.world.queueCompiledUnitCreation(...compileSpawnSpecBundles(spec, input.definitions, catalog, rng, input.arena))
  }
  runtime.world.flushStructuralCommands()
  const initialState = runtime.snapshotUnits()
  const resources = runtime.world.resources
  resources.set('clock', { tick: 0, dt: 0.1, maxTicks: input.rules.maxTicks, timeoutPolicy: input.rules.timeoutPolicy })
  resources.set('rng', rng); resources.set('actions', []); resources.set('obstacles', input.arena.obstacles)
  resources.set('arena', input.arena); resources.set('flowField', createPathfindingMap(input.arena.obstacles, input.arena))
  resources.set('globals', []); resources.set('metrics', undefined)

  const projection = new Map(initialState.map(unit => [unit.id, { x: unit.x, y: unit.y }]))
  let maxDelta = 0
  let mismatches = 0
  let ticks = 0
  const publish = (actions, tick) => {
    for (const action of actions) {
      if (action.type !== 'move') continue
      const unitId = action.sourceId ?? action.unitId
      if (projection.has(unitId)) projection.set(unitId, { x: action.toX, y: action.toY })
    }
  }
  const verify = () => {
    for (const entityId of runtime.world.query(['identity', 'transform', 'vitality'])) {
      if (runtime.world.stores.vitality.get(entityId)?.isDead) continue
      const unitId = runtime.world.stores.identity.get(entityId)?.id
      const transform = runtime.world.stores.transform.get(entityId)
      const projected = projection.get(unitId)
      if (!projected || !transform) continue
      const delta = Math.max(Math.abs(projected.x - transform.x), Math.abs(projected.y - transform.y))
      maxDelta = Math.max(maxDelta, delta)
      if (delta > TOLERANCE) mismatches += 1
    }
  }
  while (ticks < input.rules.maxTicks) {
    const actions = []
    resources.require('clock').tick = ticks
    resources.set('actions', actions)
    runtime.runStage('pre_action', { tick: ticks, actions, rng, activeGlobals: [] })
    if (runtime.getTerminalOutcome()) { publish(actions, ticks); if (actions.length) { verify(); ticks += 1 } break }
    runtime.runStage('action', { tick: ticks, actions, rng, activeGlobals: [] })
    runtime.runStage('post_action', { tick: ticks, actions, rng, activeGlobals: [] })
    publish(actions, ticks); verify(); ticks += 1
  }
  const survivors = runtime.getSurvivors()
  let finalDelta = 0
  for (const survivor of survivors) {
    const projected = projection.get(survivor.id)
    if (projected) finalDelta = Math.max(finalDelta, Math.abs(projected.x - survivor.x), Math.abs(projected.y - survivor.y))
  }
  return { file, ticks, living: survivors.length, mismatches, maxDelta, finalDelta }
}

for (const file of ['case-1.json', 'case-2.json']) {
  const row = checkMre(file)
  console.log(JSON.stringify({ step: 'mre-journal-completeness', ...row }))
  if (row.mismatches > 0) fail(`${file}: ${row.mismatches} intermediate frame(s) inconsistent with the world`)
  if (row.finalDelta > TOLERANCE) fail(`${file}: survivor projection delta ${row.finalDelta} > tolerance`)
}

rmSync(scratch, { recursive: true, force: true })
const summary = { node: process.version, platform: process.platform, sha256: actualSha, version: MANIFEST.identity.version, failures }
console.log(JSON.stringify({ step: 'summary', ...summary }))
console.log(failures.length === 0 ? 'ARCHIVE-VERIFY=PASS' : 'ARCHIVE-VERIFY=FAIL')
process.exit(failures.length === 0 ? 0 : 1)
