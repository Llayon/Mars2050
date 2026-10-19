// Collects the O2 measurement evidence from the lab directory into the committed certification
// bundle, regenerates the (small) profile summaries and writes an index with per-file SHA256.
// Raw V8 profiles stay in the lab (tens of MB); their summaries and SHA256 are committed.
//
//   node scripts/o2-verify/collect-evidence.mjs
import { createHash } from 'node:crypto'
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const LAB = 'D:/Max/o2'
const BUNDLE = join(REPO, 'packages', 'combat-core', 'certify', 'o2-20261018')
const OUT = join(BUNDLE, 'measurements')

const sha256 = file => createHash('sha256').update(readFileSync(file)).digest('hex')
const copy = (from, to) => {
  if (!existsSync(from)) return false
  mkdirSync(dirname(to), { recursive: true })
  cpSync(from, to)
  return true
}

mkdirSync(OUT, { recursive: true })
const copied = []
const SKIP_DIRECTORIES = new Set(['tmp', '.tmp', 'node_modules', '.cache'])

function copyTree(fromDir, toDir, filter = () => true) {
  if (!existsSync(fromDir)) return
  for (const entry of readdirSync(fromDir, { withFileTypes: true })) {
    const from = join(fromDir, entry.name)
    const to = join(toDir, entry.name)
    if (entry.isDirectory()) {
      // Scratch/cache directories (tsx, npm, browser profiles) are never evidence.
      if (SKIP_DIRECTORIES.has(entry.name)) continue
      copyTree(from, to, filter)
    } else if (filter(from)) {
      copy(from, to)
      copied.push(to)
    }
  }
}

copyTree(join(LAB, 'evidence', 'ab'), join(OUT, 'ab'), file => !file.endsWith('.log'))
copyTree(join(LAB, 'evidence', 'ab-zerg-extended'), join(OUT, 'ab-zerg-extended'), file => !file.endsWith('.log'))
copyTree(join(LAB, 'evidence', 'ab-installed'), join(OUT, 'ab-installed'), file => !file.endsWith('.log'))
copyTree(join(LAB, 'evidence', 'memory'), join(OUT, 'memory'), file => !file.endsWith('.log'))
copyTree(join(LAB, 'evidence', 'fantasy'), join(OUT, 'fantasy'), file => !file.endsWith('.log'))
copyTree(join(LAB, 'evidence', 'cross-env'), join(OUT, 'cross-env'), file => !file.endsWith('.log'))
copyTree(join(LAB, 'evidence', 'negative-controls'), join(OUT, 'negative-controls'))
const single = [
  ['evidence/verify-installed-candidate.log', 'verify-installed-candidate.log'],
  ['evidence/candidate-tarball-manifest-0.1.0-o2mv.1.json', 'candidate-tarball-manifest-0.1.0-o2mv.1.json'],
  ['fantasy/bundles.json', 'fantasy-bundles.json'],
  ['evidence/dist-delta-o2-vs-o1mv1.json', 'dist-delta-o2-vs-o1mv1.json'],
  ['evidence/o2-source-diff.patch', 'o2-source-diff.patch'],
]
for (const [from, to] of single) {
  const target = join(OUT, to)
  if (copy(join(LAB, from), target)) copied.push(target)
}

// Profile summaries (raw profiles are large and stay in the lab).
const PROFILE_LABELS = [
  ['base-A-zerg-gc.heap.json', 'profile-baseline-A-zerg-heap.json', 'heap'],
  ['cand-A-zerg.heap.json', 'profile-candidate-A-zerg-heap.json', 'heap'],
  ['base-A-zerg.cpu.json', 'profile-baseline-A-zerg-cpu.json', 'cpu'],
  ['cand-A-zerg.cpu.json', 'profile-candidate-A-zerg-cpu.json', 'cpu'],
]
const profiles = {}
for (const [source, target, kind] of PROFILE_LABELS) {
  const sourcePath = join(LAB, 'profiles', source)
  if (!existsSync(sourcePath)) continue
  const result = spawnSync(process.execPath, [join(HERE, 'summarize-profile.mjs'), sourcePath, '--top', '25'], { encoding: 'utf8', maxBuffer: 1 << 28 })
  if (result.status !== 0) {
    console.error(`profile summary failed for ${source}`)
    continue
  }
  const targetPath = join(OUT, target)
  writeFileSync(targetPath, result.stdout, 'utf8')
  copied.push(targetPath)
  profiles[target] = {
    kind,
    sourceProfile: sourcePath.replace(/\\/g, '/'),
    sourceProfileBytes: statSync(sourcePath).size,
    sourceProfileSha256: sha256(sourcePath),
    summary: JSON.parse(result.stdout),
  }
}

const files = copied.filter(file => existsSync(file)).map(file => ({
  path: relative(BUNDLE, file).split('\\').join('/'),
  bytes: statSync(file).size,
  sha256: sha256(file),
}))

const index = {
  generatedAt: new Date().toISOString(),
  lab: LAB,
  node: process.version,
  platform: `${process.platform}-${process.arch}`,
  profiles,
  files,
}
writeFileSync(join(OUT, 'index.json'), `${JSON.stringify(index, null, 2)}\n`, 'utf8')
console.log(JSON.stringify({ files: files.length, bytes: files.reduce((sum, file) => sum + file.bytes, 0), profiles: Object.keys(profiles) }))
