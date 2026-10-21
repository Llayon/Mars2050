// Compares a dist tree against a committed per-file SHA256 manifest.
// Usage: node compare-dist.mjs <distDir> <manifest.json> [--label <name>]
// Prints JSON: { label, checked, missing, mismatched, extra, files: { rel: sha } }
import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const [, , distArg, manifestArg, ...rest] = process.argv
const labelIndex = rest.indexOf('--label')
const label = labelIndex >= 0 ? rest[labelIndex + 1] : 'unlabeled'
if (!distArg || !manifestArg) {
  console.error('usage: node compare-dist.mjs <distDir> <manifest.json> [--label <name>]')
  process.exit(2)
}

const sha256 = file => createHash('sha256').update(readFileSync(file)).digest('hex')
const manifest = JSON.parse(readFileSync(manifestArg, 'utf8'))
const expected = manifest.dist ?? manifest

function walk(root, prefix = '') {
  const result = []
  for (const entry of readdirSync(root)) {
    const full = join(root, entry)
    const rel = prefix ? `${prefix}/${entry}` : entry
    if (statSync(full).isDirectory()) result.push(...walk(full, rel))
    else result.push(rel)
  }
  return result
}

const actualFiles = walk(distArg)
const actual = {}
for (const rel of actualFiles) actual[`dist/${rel}`] = sha256(join(distArg, rel))

const missing = []
const mismatched = []
for (const [rel, sha] of Object.entries(expected)) {
  if (!(rel in actual)) missing.push(rel)
  else if (actual[rel] !== sha) mismatched.push(rel)
}
const expectedKeys = new Set(Object.keys(expected))
const extra = Object.keys(actual).filter(rel => !expectedKeys.has(rel))

const summary = {
  label,
  distDir: distArg.replace(/\\/g, '/'),
  manifest: manifestArg.replace(/\\/g, '/'),
  manifestFileCount: expectedKeys.size,
  actualFileCount: actualFiles.length,
  missingCount: missing.length,
  mismatchedCount: mismatched.length,
  extraCount: extra.length,
  contentIdentical: missing.length === 0 && mismatched.length === 0 && extra.length === 0,
  missing,
  mismatched,
  extra,
  files: actual,
}
console.log(JSON.stringify(summary, null, 2))
process.exit(summary.contentIdentical ? 0 : 1)
