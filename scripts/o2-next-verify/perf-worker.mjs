// One measurement process for the paired performance workflow.
// A separate process per (variant, pair) keeps JIT/GC state from leaking between the two sides.
// Writes a JSON report; exits non-zero only on harness problems (missing module, bad input).
import { createHash } from 'node:crypto'
import { readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 ? process.argv[index + 1] : fallback
}

const packageDir = resolve(arg('module', ''))
const inputPath = resolve(arg('input', ''))
const runs = Number(arg('runs', '5'))
const warmup = Number(arg('warmup', '2'))
const out = arg('out', '')
const label = arg('label', 'unknown')

const entry = join(packageDir, 'dist', 'index.js')
const pkg = JSON.parse(readFileSync(join(packageDir, 'package.json'), 'utf8'))
const sha256 = value => createHash('sha256').update(value).digest('hex')
const entrySha256 = sha256(readFileSync(entry))

// Dependency-resolution probe: both variants must resolve the SAME zod instance. The workflow
// places the variants inside the repository tree, so the bare specifier walks up to the single
// root install; this probe proves it instead of assuming it.
const requireFromVariant = createRequire(entry)
const zodEntry = requireFromVariant.resolve('zod')
const zodReal = realpathSync(zodEntry)

const { simulateCombat } = await import(pathToFileURL(entry).href)
const inputText = readFileSync(inputPath, 'utf8')
const input = JSON.parse(inputText)

for (let index = 0; index < warmup; index += 1) simulateCombat(input)

const times = []
const hashes = []
for (let index = 0; index < runs; index += 1) {
  const startedAt = performance.now()
  const result = simulateCombat(input)
  times.push(performance.now() - startedAt)
  hashes.push(sha256(JSON.stringify(result)))
}

const sorted = [...times].sort((left, right) => left - right)
const mid = Math.floor(sorted.length / 2)
const medianMs = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
const distinctHashes = [...new Set(hashes)]

const report = {
  label,
  packageDir: packageDir.replace(/\\/g, '/'),
  package: { name: pkg.name, version: pkg.version },
  entry: entry.replace(/\\/g, '/'),
  entryRealPath: realpathSync(entry).replace(/\\/g, '/'),
  entrySha256,
  zodEntry: zodEntry.replace(/\\/g, '/'),
  zodRealPath: zodReal.replace(/\\/g, '/'),
  inputPath: inputPath.replace(/\\/g, '/'),
  inputSha256: sha256(inputText),
  units: input.units.length,
  warmup,
  runs,
  rawMs: times,
  medianMs,
  minMs: sorted[0],
  maxMs: sorted[sorted.length - 1],
  hashes,
  distinctHashes,
  resultSha256: hashes[0],
  resultInvariant: distinctHashes.length === 1,
  node: process.version,
  platform: `${process.platform}-${process.arch}`,
}

if (out) writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
console.log(JSON.stringify({ label, medianMs, resultSha256: report.resultSha256, distinctHashes: distinctHashes.length }))
