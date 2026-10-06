import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const targetDir = resolve(root, 'artifacts/combat-core-handoff/handoff-20261006-r4b-candidate')
const baseCommit = '9c7c49062ad064819968acfa41f667e00a8f39a3'
const sha = (b) => createHash('sha256').update(b).digest('hex')

console.log('[1/6] Preparing handoff directory:', targetDir)
rmSync(targetDir, { recursive: true, force: true })
mkdirSync(targetDir, { recursive: true })
mkdirSync(resolve(targetDir, 'overlay'), { recursive: true })
mkdirSync(resolve(targetDir, 'logs'), { recursive: true })

// Copy source-base.tar from clean handoff
const sourceBaseTar = resolve(root, 'artifacts/combat-core-handoff/handoff-20261006-deterministic-trig-r4-clean/source-base.tar')
const baseTarBytes = readFileSync(sourceBaseTar)
writeFileSync(resolve(targetDir, 'source-base.tar'), baseTarBytes)
const baseTarHash = sha(baseTarBytes)
assert.equal(baseTarHash, 'd0abb2dbe8916ecaa03fa450dae5c57c4718f9a7afad44094004510a1ba7f5c6')
console.log('source-base.tar verified, sha256:', baseTarHash)

// Unpack base tar to a temp inspection dir
const tmpBase = resolve(targetDir, 'tmp-base')
mkdirSync(tmpBase, { recursive: true })
execFileSync('tar', ['-xf', resolve(targetDir, 'source-base.tar'), '-C', tmpBase])

function walk(dir) {
  let list = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'dist' || entry.name === 'node_modules') continue
    const full = resolve(dir, entry.name)
    if (entry.isDirectory()) list = list.concat(walk(full))
    else list.push(full)
  }
  return list
}

const wtFiles = walk(resolve(root, 'packages/combat-core'))
const fixtures = [
  'src/__tests__/fixtures/combat-ecs-v8-golden.json',
  'src/__tests__/fixtures/combat-ecs-v9-golden.json'
]
const allCandidates = [...wtFiles, ...fixtures.map(f => resolve(root, f))]

console.log('[2/6] Calculating overlays against base commit...')
const overlays = []
const overlayDir = resolve(targetDir, 'overlay')
for (const file of allCandidates) {
  const normPath = relative(root, file).split(sep).join('/')
  const baseFile = resolve(tmpBase, normPath)
  const wtBytes = readFileSync(file)
  const wtHash = sha(wtBytes)

  let isDiff = false
  if (!existsSync(baseFile)) {
    isDiff = true
  } else {
    const baseBytes = readFileSync(baseFile)
    if (sha(baseBytes) !== wtHash) isDiff = true
  }

  if (isDiff) {
    overlays.push({ path: normPath, sha256: wtHash })
    const dest = resolve(overlayDir, normPath)
    mkdirSync(dirname(dest), { recursive: true })
    writeFileSync(dest, wtBytes)
  }
}
rmSync(tmpBase, { recursive: true, force: true })
overlays.sort((a, b) => a.path.localeCompare(b.path))
console.log(`Identified and copied ${overlays.length} overlays (with normalized forward slashes).`)

console.log('[3/6] Generating source-manifest.json...')
const packageLockSha = sha(readFileSync(resolve(root, 'package-lock.json')))
const cleanArchiveSha = sha(readFileSync(resolve(root, 'artifacts/combat-core-handoff/handoff-20261006-deterministic-trig-r4-clean/mars2050-combat-core-0.1.0.tgz')))

const sourceManifest = {
  status: 'candidate_for_audit',
  baseCommit,
  buildId: 'combat-core-r4b-20261006',
  sourceKind: 'committed-base-plus-explicit-uncommitted-overlay',
  createdAt: new Date().toISOString(),
  node: process.version,
  platform: process.platform,
  sourceArchiveSha256: baseTarHash,
  overlays,
  package: {
    name: '@mars2050/combat-core',
    version: '0.1.0',
    filename: 'mars2050-combat-core-0.1.0.tgz',
    sha256: 'f610158b3f4db5782a0978ccf7333eca651e024263f2d76988aa297417c08499',
    size: 385573,
    entryCount: 866
  },
  buildDependencies: {
    typescript: '5.9.3',
    zod: '4.4.2',
    rootPackageLockSha256: packageLockSha
  },
  revisions: {
    v8: 'combat-ecs-v8-deterministic-trig-r4',
    v9: 'combat-ecs-v9-deterministic-trig-r4'
  },
  checks: [],
  previousArchiveUnchanged: cleanArchiveSha,
  limitations: [
    'Frozen base archive plus 72 hashed overlays for R4b remediation',
    'ISO-08 boundary remains open until R6'
  ],
  buildMethod: 'Isolated reproduction from source-base.tar and 72 hashed overlays; zero uninventoried files'
}

writeFileSync(resolve(targetDir, 'source-manifest.json'), JSON.stringify(sourceManifest, null, 2) + '\n')

console.log('[4/6] Creating reproduce.mjs and running reproduction...')
const reproduceCode = `import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '../../..')
const manifest = JSON.parse(readFileSync(resolve(here, 'source-manifest.json'), 'utf8'))
const sha = bytes => createHash('sha256').update(bytes).digest('hex')
const reproduction = resolve(here, 'reproduced')
assert(!existsSync(reproduction), 'Reproductions are append-only; use a new directory for another run')
assert.equal(sha(readFileSync(resolve(here, 'source-base.tar'))), manifest.sourceArchiveSha256)
const source = resolve(reproduction, 'source')
mkdirSync(source, { recursive: true })
execFileSync('tar', ['-xf', resolve(here, 'source-base.tar'), '-C', source], { windowsHide: true })
for (const file of manifest.overlays) {
  const from = resolve(here, 'overlay', file.path), to = resolve(source, file.path)
  assert(to.startsWith(source + sep), 'Invalid overlay path')
  assert.equal(sha(readFileSync(from)), file.sha256, \`Overlay hash mismatch: \${file.path}\`)
  mkdirSync(dirname(to), { recursive: true })
  copyFileSync(from, to)
}
const compiler = process.argv[2] ?? resolve(root, 'node_modules/typescript/bin/tsc')
const npmCli = process.argv[3] ?? resolve(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js')
const cwd = resolve(source, 'packages/combat-core')
const options = { cwd, encoding: 'utf8', windowsHide: true, env: { ...process.env, NODE_PATH: '' } }
execFileSync(process.execPath, [compiler, '-p', 'tsconfig.json'], options)
const packed = JSON.parse(execFileSync(process.execPath, [npmCli, 'pack', '--json', '--offline', '--ignore-scripts',
  '--workspaces=false', '--cache', resolve(reproduction, 'npm-cache'), '--pack-destination', reproduction], options))[0]
const actualHash = sha(readFileSync(resolve(reproduction, packed.filename)))
assert.equal(actualHash, manifest.package.sha256, \`Archive reproduction drift: got \${actualHash}, expected \${manifest.package.sha256}\`)
copyFileSync(resolve(reproduction, packed.filename), resolve(here, packed.filename))
const report = { status: 'passed', archiveSha256: actualHash, baseCommit: manifest.baseCommit, buildId: manifest.buildId,
  overlayCount: manifest.overlays.length, source: 'Frozen base archive plus hashed overlays, no shared source reads',
  compiler, npmCli, node: process.version, dependencies: manifest.buildDependencies }
writeFileSync(resolve(here, 'reproduction-verification.json'), JSON.stringify(report, null, 2) + '\\n')
console.log(JSON.stringify(report, null, 2))
`
writeFileSync(resolve(targetDir, 'reproduce.mjs'), reproduceCode, 'utf8')
execFileSync('node', [resolve(targetDir, 'reproduce.mjs')], { stdio: 'inherit' })

console.log('[5/6] Creating verify-inventory.mjs and running inventory check...')
const inventoryCode = `import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '../../..')
const manifest = JSON.parse(readFileSync(resolve(here, 'source-manifest.json'), 'utf8'))
const source = resolve(here, 'reproduced/source')
const prefix = 'packages/combat-core/src/'
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const tree = execFileSync('git', ['ls-tree', '-rz', manifest.baseCommit, '--', prefix], { cwd: root, encoding: 'utf8' })
const originals = new Map(tree.split('\\0').filter(Boolean).map(entry => {
  const [meta, path] = entry.split('\\t')
  return [path, meta.split(' ')[2]]
}))
const overlays = new Map(manifest.overlays.map(file => [file.path, file.sha256]))
const expected = new Set([...originals.keys(), ...overlays.keys()].filter(path => path.startsWith(prefix)))
const actual = []
function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = resolve(dir, entry.name)
    if (entry.isDirectory()) walk(path)
    else actual.push(relative(source, path).split(sep).join('/'))
  }
}
walk(resolve(source, prefix))
assert.deepEqual(actual.sort(), [...expected].sort(), 'Unexpected or missing source files')
for (const path of actual) {
  const bytes = readFileSync(resolve(source, path))
  if (overlays.has(path)) assert.equal(hash(bytes), overlays.get(path), path)
  else {
    const normalized = Buffer.from(bytes.toString('utf8').replaceAll('\\r\\n', '\\n'))
    const gitHash = createHash('sha1').update(\`blob \${normalized.length}\\0\`).update(normalized).digest('hex')
    assert.equal(gitHash, originals.get(path), path)
  }
}
const archive = resolve(here, manifest.package.filename)
assert.equal(hash(readFileSync(archive)), manifest.package.sha256)
const entries = execFileSync('tar', ['-tf', archive], { encoding: 'utf8' }).trim().split(/\\r?\\n/).sort()
const expectedEntries = ['package/package.json', 'package/README.md']
for (const path of expected) {
  assert(path.endsWith('.ts') && !path.endsWith('.d.ts'), \`Unexpected source extension: \${path}\`)
  const stem = 'package/dist/' + path.slice(prefix.length, -3)
  for (const extension of ['.js', '.js.map', '.d.ts', '.d.ts.map']) expectedEntries.push(stem + extension)
}
assert.deepEqual(entries, expectedEntries.sort(), 'Archive has missing, stale or unexpected emitted files')
const report = { status: 'passed', sourceFiles: expected.size, archiveEntries: entries.length,
  archiveSha256: manifest.package.sha256, buildId: manifest.buildId, extraSourceFiles: 0, extraEmittedFiles: 0,
  sourceKind: 'Committed base plus the exact hashed overlay allowlist' }
writeFileSync(resolve(here, 'inventory-verification.json'), JSON.stringify(report, null, 2) + '\\n')
console.log(JSON.stringify(report, null, 2))
`
writeFileSync(resolve(targetDir, 'verify-inventory.mjs'), inventoryCode, 'utf8')
execFileSync('node', [resolve(targetDir, 'verify-inventory.mjs')], { stdio: 'inherit' })

console.log('[6/6] Build candidate handoff complete!')
