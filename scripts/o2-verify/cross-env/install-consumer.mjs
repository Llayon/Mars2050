// Creates a scratch consumer that installs the O2 candidate tarball (never the workspace dist) and
// pins zod to the same version the accepted package was verified with.
//   node scripts/o2-verify/cross-env/install-consumer.mjs --tarball <path> --dir D:/Max/o2/consumer
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 ? process.argv[index + 1] : fallback
}

const tarball = resolve(arg('tarball', 'D:/Max/o2/evidence/mars2050-combat-core-0.1.0-o2mv.1.tgz'))
const dir = resolve(arg('dir', 'D:/Max/o2/consumer'))
const npmCli = process.env.npm_execpath ?? join(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js')

rmSync(join(dir, 'node_modules'), { recursive: true, force: true })
rmSync(join(dir, 'package-lock.json'), { force: true })
mkdirSync(dir, { recursive: true })
writeFileSync(join(dir, 'package.json'), `${JSON.stringify({
  name: 'o2-cross-env-consumer',
  private: true,
  type: 'module',
  dependencies: { '@mars2050/combat-core': `file:${tarball.replace(/\\/g, '/')}`, zod: '4.4.2' },
}, null, 2)}\n`, 'utf8')

const install = spawnSync(process.execPath, [npmCli, 'install', '--no-audit', '--no-fund', '--ignore-scripts'], {
  cwd: dir,
  encoding: 'utf8',
  env: { ...process.env, TEMP: 'D:/Max/o2/tmp', TMP: 'D:/Max/o2/tmp' },
})
if (install.status !== 0) {
  console.error(install.stdout, install.stderr)
  process.exit(install.status ?? 1)
}

const installedDir = join(dir, 'node_modules', '@mars2050', 'combat-core')
const pkg = JSON.parse(readFileSync(join(installedDir, 'package.json'), 'utf8'))
console.log(JSON.stringify({
  dir: dir.replace(/\\/g, '/'),
  version: pkg.version,
  installed: existsSync(join(installedDir, 'dist', 'index.js')),
  zod: JSON.parse(readFileSync(join(dir, 'node_modules', 'zod', 'package.json'), 'utf8')).version,
}, null, 2))
