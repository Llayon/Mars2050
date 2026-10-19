// Chromium cross-environment check for the INSTALLED candidate package.
// Bundles from the consumer dir with esbuild, asserts bundle provenance (no workspace inputs),
// runs the R7 scenarios in Chrome and writes the same report fields as the Node runner.
//   <node> browser-runner.mjs <consumerDir> <out.json> [fixtures.mjs] [r7-matrix.json]
import { createHash } from 'node:crypto'
import { readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..', '..')
const BUNDLE_DIR = resolve(REPO, 'packages', 'combat-core', 'certify', 'o2-20261018')

const consumerDir = resolve(process.argv[2] ?? 'D:/Max/o2/consumer')
const outPath = resolve(process.argv[3] ?? 'D:/Max/o2/evidence/cross-env/browser-report.json')
const fixturesPath = process.argv[4] ?? resolve(BUNDLE_DIR, 'matrix-fixtures.mjs')

const esbuildNs = await import(pathToFileURL(resolve(REPO, 'node_modules', 'esbuild', 'lib', 'main.js')).href)
const esbuildBuild = esbuildNs.build ?? esbuildNs.default?.build
const { chromium } = await import(pathToFileURL(resolve(REPO, 'node_modules', 'playwright', 'index.mjs')).href)

const sha256 = value => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex')

const entryPath = resolve(consumerDir, 'browser-entry.mjs')
const bundlePath = resolve(consumerDir, 'browser-bundle.js')

writeFileSync(entryPath, `
  import * as core from '@mars2050/combat-core';
  import * as contracts from '@mars2050/combat-core/contracts';
  import * as replay from '@mars2050/combat-core/replay';

  window.__surface = {
    coreKeys: Object.keys(core).sort(),
    hasSimulateCombat: typeof core.simulateCombat === 'function',
    leaksNormalizedInputHelper: Object.prototype.hasOwnProperty.call(core, 'isNormalizedBattleInput'),
    leaksBrand: Object.prototype.hasOwnProperty.call(core, 'NORMALIZED_INPUT_BRAND'),
    contractsOk: typeof contracts.combatEventSchema?.parse === 'function',
    replayOk: typeof replay.serializeCombatEvent === 'function',
  };

  window.__runScenarios = function (scenarios) {
    const reports = {};
    for (const [key, scenario] of Object.entries(scenarios)) {
      const inputCopy = JSON.parse(JSON.stringify(scenario.input));
      const result = core.simulateCombat(inputCopy);
      const cleanMetadata = result.metadata ? {
        contractVersion: result.metadata.contractVersion,
        engine: result.metadata.engine,
        ruleset: result.metadata.ruleset,
        replaySchema: result.metadata.replaySchema,
      } : null;
      reports[key] = { ...result, metadata: cleanMetadata };
    }
    return reports;
  };
`, 'utf8')

const build = await esbuildBuild({
  entryPoints: [entryPath],
  bundle: true,
  outfile: bundlePath,
  format: 'iife',
  platform: 'browser',
  target: ['chrome120'],
  absWorkingDir: consumerDir,
  metafile: true,
})

const inputs = Object.keys(build.metafile.inputs)
const workspaceInputs = inputs.filter(file => /packages[\\/]combat-core/.test(file) || file.startsWith('..'))
const unexpected = inputs.filter(file =>
  !/^node_modules[\\/]@mars2050[\\/]combat-core/.test(file) &&
  !/^node_modules[\\/]zod/.test(file) &&
  file !== 'browser-entry.mjs')
if (workspaceInputs.length || unexpected.length) {
  console.error(JSON.stringify({ workspaceInputs, unexpected }, null, 2))
  process.exit(1)
}

const bundleCode = readFileSync(bundlePath, 'utf8')
const provenance = {
  bundlePath: bundlePath.replace(/\\/g, '/'),
  bundleSha256: sha256(bundleCode),
  bundleSizeBytes: statSync(bundlePath).size,
  totalInputs: inputs.length,
  workspaceInputs: 0,
  isolatedFromWorkspace: true,
  inputs: inputs.sort(),
}

const { COMMON_SCENARIOS } = await import(pathToFileURL(fixturesPath).href)
const profileDir = resolve(tmpdir(), `o2-chrome-${Date.now()}`)
const context = await chromium.launchPersistentContext(profileDir, {
  channel: 'chrome',
  headless: true,
  args: ['--disable-gpu', '--no-sandbox'],
})

try {
  const page = await context.newPage()
  await page.addScriptTag({ path: bundlePath })
  const surface = await page.evaluate(() => window.__surface)
  const raw = await page.evaluate(scenarios => window.__runScenarios(scenarios), COMMON_SCENARIOS)
  const version = context.browser()?.version() ?? 'unknown'

  const results = {}
  for (const [key, report] of Object.entries(raw)) {
    results[key] = {
      scenario: key,
      winner: report.winner,
      terminationReason: report.terminationReason,
      elapsedTicks: report.elapsedTicks,
      initialStateCount: report.initialState.length,
      survivorsCount: report.survivors.length,
      logsCount: report.logs.length,
      initialStateSha256: sha256(report.initialState),
      survivorsSha256: sha256(report.survivors),
      logsSha256: sha256(report.logs),
      metadataSha256: report.metadata ? sha256(report.metadata) : null,
    }
  }

  const out = {
    environment: { node: process.version, platform: process.platform, arch: process.arch },
    browser: 'Chromium (Google Chrome, channel chrome)',
    version,
    userAgent: await page.evaluate(() => navigator.userAgent),
    surface,
    provenance,
    results,
  }
  writeFileSync(outPath, `${JSON.stringify(out, null, 2)}\n`, 'utf8')
  console.log(JSON.stringify({ version, surface, provenanceSha: provenance.bundleSha256, results: Object.keys(results).length }))
} finally {
  await context.close()
  try { rmSync(profileDir, { recursive: true, force: true }) } catch { /* ignore */ }
}
