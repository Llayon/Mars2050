// Runs the R7 common fixture scenarios against the INSTALLED @mars2050/combat-core of a scratch
// consumer. The core is imported through an explicit absolute path inside the consumer, so this
// script never resolves the workspace package even when it is executed from the repository.
//   <node> run-scenarios.mjs <consumerDir> <matrix-fixtures.mjs> [out.json]
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const [, , consumerArg, fixturesArg, outArg] = process.argv
if (!consumerArg || !fixturesArg) throw new Error('usage: run-scenarios.mjs <consumerDir> <matrix-fixtures.mjs> [out.json]')

const consumerDir = resolve(consumerArg)
const packageDir = join(consumerDir, 'node_modules', '@mars2050', 'combat-core')
const entryPath = join(packageDir, 'dist', 'index.js')
const packageJsonPath = join(packageDir, 'package.json')

const { runAllScenarios } = await import(pathToFileURL(resolve(fixturesArg)).href)
const core = await import(pathToFileURL(entryPath).href)
const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8'))
const sha256File = file => createHash('sha256').update(readFileSync(file)).digest('hex')

const results = runAllScenarios(core.simulateCombat)

const report = {
  environment: {
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    execPath: process.execPath,
  },
  installedPackage: {
    name: pkg.name,
    version: pkg.version,
    consumerDir: consumerDir.replace(/\\/g, '/'),
    entryPath: entryPath.replace(/\\/g, '/'),
    entrySha256: sha256File(entryPath),
    packageJsonSha256: sha256File(packageJsonPath),
  },
  exportedKeys: {
    root: Object.keys(core).sort(),
    hasSimulateCombat: typeof core.simulateCombat === 'function',
    leaksNormalizedInputHelper: Object.prototype.hasOwnProperty.call(core, 'isNormalizedBattleInput'),
    leaksBrand: Object.prototype.hasOwnProperty.call(core, 'NORMALIZED_INPUT_BRAND'),
  },
  results,
}

const payload = `${JSON.stringify(report, null, 2)}\n`
if (outArg) writeFileSync(outArg, payload, 'utf8')
console.log(JSON.stringify({
  node: report.environment.node,
  platform: report.environment.platform,
  version: report.installedPackage.version,
  entrySha256: report.installedPackage.entrySha256,
  scenarios: Object.keys(results).length,
}))
