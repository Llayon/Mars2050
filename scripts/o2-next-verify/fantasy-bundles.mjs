// O2.2 Fantasy native-path bundles. Same Fantasy adapter as the accepted O2 measurement, but the
// baseline is the accepted o2mv.1 archive instead of o1mv.1.
// Fantasy sources, dependencies, vendor and builds are only read; esbuild writes into the O2 lab.
//
//   node scripts/o2-next-verify/fantasy-bundles.mjs \
//     --baseline D:/Max/o2/baseline-o2/node_modules/@mars2050/combat-core \
//     --candidate D:/Max/Mars2050-o2/packages/combat-core --out-root D:/Max/o2/fantasy-o22
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { build } from 'file:///D:/Max/fantasy-battles/apps/fantasy/node_modules/esbuild/lib/main.js'

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 ? process.argv[index + 1] : fallback
}

const APP = 'D:/Max/fantasy-battles/apps/fantasy'
const OUT_ROOT = resolve(arg('out-root', 'D:/Max/o2/fantasy-o22'))
const VARIANTS = {
  baseline: resolve(arg('baseline', 'D:/Max/o2/baseline-o2/node_modules/@mars2050/combat-core')),
  candidate: resolve(arg('candidate', 'D:/Max/Mars2050-o2/packages/combat-core')),
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
    alias: { '@fantasy/combat-core-native': coreDir.replace(/\\/g, '/') },
  })
  const inputs = Object.keys(result.metafile.inputs).sort()
  const coreInputs = inputs.filter(input => input.includes('combat-core'))
  writeFileSync(join(outDir, 'node-inputs.json'), `${JSON.stringify(inputs, null, 2)}\n`, 'utf8')
  report.variants[variant] = {
    coreDir: coreDir.replace(/\\/g, '/'),
    corePackageJsonSha256: sha256(join(coreDir, 'package.json')),
    coreEntrySha256: sha256(join(coreDir, 'dist', 'index.js')),
    outfile: outfile.replace(/\\/g, '/'),
    bundleSha256: sha256(outfile),
    inputCount: inputs.length,
    coreInputCount: coreInputs.length,
  }
  console.log(`${variant}: inputs=${inputs.length} coreInputs=${coreInputs.length} sha=${report.variants[variant].bundleSha256}`)
}

writeFileSync(join(OUT_ROOT, 'bundles.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8')
