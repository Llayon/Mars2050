// Stages the built O2 candidate with its own identity, packs it outside git and writes the
// committed content pin (per-file SHA256 of dist) into the O2 certification bundle, in the same
// schema the CORE-HANDOFF verifier already reads.
//
//   node scripts/o2-verify/pack-candidate.mjs --version 0.1.0-o2mv.1 --lab D:/Max/o2
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const arg = (name, fallback) => {
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 ? process.argv[index + 1] : fallback
}

const VERSION = arg('version', '')
if (!VERSION) throw new Error('--version is required')
const SOURCE_PKG = resolve(arg('source', join(REPO, 'packages', 'combat-core')))
const LAB = resolve(arg('lab', 'D:/Max/o2'))
const BUNDLE = join(SOURCE_PKG, 'certify', 'o2-20261018')
const STAGE = join(LAB, 'pack', 'mars2050-combat-core')
const OUT_DIR = join(LAB, 'evidence')
const sha256 = file => createHash('sha256').update(readFileSync(file)).digest('hex')

mkdirSync(STAGE, { recursive: true })
mkdirSync(OUT_DIR, { recursive: true })
mkdirSync(BUNDLE, { recursive: true })
rmSync(join(STAGE, 'dist'), { recursive: true, force: true })
cpSync(join(SOURCE_PKG, 'dist'), join(STAGE, 'dist'), { recursive: true })

const pkg = JSON.parse(readFileSync(join(SOURCE_PKG, 'package.json'), 'utf8'))
const staged = { ...pkg, version: VERSION }
writeFileSync(join(STAGE, 'package.json'), `${JSON.stringify(staged, null, 2)}\n`, 'utf8')
cpSync(join(SOURCE_PKG, 'README.md'), join(STAGE, 'README.md'))

function walk(dir) {
  const out = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...walk(full))
    else if (entry.isFile()) out.push(full)
  }
  return out
}

const npmCli = process.env.npm_execpath ?? join(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js')
const result = spawnSync(process.execPath, [npmCli, 'pack', '--pack-destination', OUT_DIR], {
  cwd: STAGE,
  encoding: 'utf8',
  env: { ...process.env, npm_config_cache: join(LAB, '.npm-cache'), TEMP: join(LAB, 'tmp'), TMP: join(LAB, 'tmp') },
})
if (result.status !== 0) {
  console.error(result.stdout, result.stderr)
  process.exit(result.status ?? 1)
}
const tarballName = result.stdout.trim().split(/\r?\n/).pop()
const tarballPath = join(OUT_DIR, tarballName)

const distFiles = walk(join(STAGE, 'dist'))
const manifest = {
  tarballName,
  tarballSha256: sha256(tarballPath),
  tarballBytes: statSync(tarballPath).size,
  identity: { name: staged.name, version: staged.version },
  sourcePackage: SOURCE_PKG.replace(/\\/g, '/'),
  distFileCount: distFiles.length,
  dist: Object.fromEntries(distFiles.map(f => [relative(STAGE, f).split('\\').join('/'), sha256(f)])),
}
writeFileSync(join(BUNDLE, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
writeFileSync(join(OUT_DIR, `candidate-tarball-manifest-${VERSION}.json`), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')

console.log(JSON.stringify({
  tarball: tarballPath.replace(/\\/g, '/'),
  tarballSha256: manifest.tarballSha256,
  tarballBytes: manifest.tarballBytes,
  identity: manifest.identity,
  distFileCount: manifest.distFileCount,
  committedManifest: join(BUNDLE, 'manifest.json').replace(/\\/g, '/'),
}, null, 2))
