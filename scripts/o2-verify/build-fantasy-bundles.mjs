// Builds two self-contained Fantasy native-path bundles: the same Fantasy adapter
// (apps/fantasy/scripts/native-compare.ts) with @fantasy/combat-core-native aliased either to the
// accepted baseline tarball install or to the O2 candidate package.
// Fantasy sources, dependencies, vendor and builds are only read, never modified: esbuild writes
// its output into the O2 lab directory on D:.
//
//   node scripts/o2-verify/build-fantasy-bundles.mjs
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { build } from 'file:///D:/Max/fantasy-battles/apps/fantasy/node_modules/esbuild/lib/main.js'

const APP = 'D:/Max/fantasy-battles/apps/fantasy'
const OUT_ROOT = 'D:/Max/o2/fantasy'
const VARIANTS = {
  baseline: 'D:/Max/o2/baseline-install/node_modules/@mars2050/combat-core',
  candidate: 'D:/Max/Mars2050-o2/packages/combat-core',
}

const sha256 = file => createHash('sha256').update(readFileSync(file)).digest('hex')
const report = { generatedAt: new Date().toISOString(), app: APP, variants: {} }

for (const [variant, coreDir] of Object.entries(VARIANTS)) {
  const outDir = join(OUT_ROOT, variant)
  mkdirSync(outDir, { recursive: true })
  const outfile = join(outDir, 'native-compare.mjs')
  const result = await build({
    absWorkingDir: APP,
    entryPoints: ['scripts/native-compare.ts'],
    outfile,
    platform: 'node',
    target: 'node26',
    bundle: true,
    format: 'esm',
    metafile: true,
    logLevel: 'warning',
    alias: { '@fantasy/combat-core-native': coreDir },
  })
  const inputs = Object.keys(result.metafile.inputs).sort()
  const coreInputs = inputs.filter(input => input.includes('combat-core'))
  writeFileSync(join(outDir, 'node-inputs.json'), `${JSON.stringify(inputs, null, 2)}\n`, 'utf8')
  report.variants[variant] = {
    coreDir,
    corePackageJsonSha256: sha256(join(coreDir, 'package.json')),
    coreEntrySha256: sha256(join(coreDir, 'dist', 'index.js')),
    outfile: outfile.replace(/\\/g, '/'),
    bundleSha256: sha256(outfile),
    inputCount: inputs.length,
    coreInputCount: coreInputs.length,
    coreInputs,
  }
  console.log(`${variant}: inputs=${inputs.length} coreInputs=${coreInputs.length} sha=${report.variants[variant].bundleSha256}`)
}

writeFileSync(join(OUT_ROOT, 'bundles.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8')
