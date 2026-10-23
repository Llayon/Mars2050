// Paired O2 vs O2.2 comparison for the manual performance workflow.
//
// Design notes (each maps to a review requirement):
//  * dependency resolution: both variants live inside the repository tree, so `zod` resolves to the
//    single root install; the worker reports the resolved path and this driver FAILS if they differ.
//  * null control: the same variant runs as both sides first, so the harness bias is measured in the
//    same job and can be compared against the A/B ratio.
//  * paired measurement: one process per (variant, pair), order alternated per pair, cooldown between
//    processes, medians and per-pair ratios; raw reports are kept.
//  * one expected result hash per scenario: every run of a preset — both variants and both sides of
//    the null control — must produce the same hash. Nondeterminism is an error, even when both
//    variants are "equally nondeterministic".
//  * direction: every ratio is baseline / candidate, so a value above 1 always means "candidate is
//    faster" (speedup of medians and per-pair ratio share the direction).
//  * informational timings: no timing threshold exists anywhere in this file. Only a result-hash
//    mismatch or a broken stand fails the run (exit codes below).
//
// Exit codes: 0 = measured, results identical; 2 = result hash mismatch between variants;
//             3 = harness/stand problem (bad parameters, missing module, mismatched dependency
//                 resolution, nondeterministic result, worker failure, unexpected runtime).
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const WORKER = join(HERE, 'perf-worker.mjs')

export const EXIT = { OK: 0, MISMATCH: 2, HARNESS: 3 }

export class PerfError extends Error {
  constructor(kind, message, exitCode) {
    super(message)
    this.name = 'PerfError'
    this.kind = kind
    this.exitCode = exitCode
  }
}

const integer = (value, name, min, max) => {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new PerfError('PARAMS', `${name} must be an integer between ${min} and ${max} (got ${JSON.stringify(value)})`, EXIT.HARNESS)
  }
  return parsed
}

/**
 * Validates and normalizes the measurement parameters. Any non-integer, out-of-range or empty value
 * is a harness error: a run with `pairs=0` must never be reported as a successful comparison.
 * @param {{ pairs: unknown, nullPairs: unknown, runs: unknown, warmup: unknown, cooldownMs: unknown, presets: unknown }} options
 * @returns {{ pairs: number, nullPairs: number, runs: number, warmup: number, cooldownMs: number, presets: string[] }}
 */
export function validateOptions(options) {
  const presetList = Array.isArray(options.presets)
    ? options.presets
    : String(options.presets ?? '').split(',')
  const presets = presetList.map(value => String(value).trim()).filter(Boolean)
  if (presets.length === 0) throw new PerfError('PARAMS', 'at least one preset is required', EXIT.HARNESS)
  const cooldownMs = Number(options.cooldownMs)
  if (!Number.isFinite(cooldownMs) || cooldownMs < 0 || cooldownMs > 60_000) {
    throw new PerfError('PARAMS', `cooldownMs must be a finite number between 0 and 60000 (got ${JSON.stringify(options.cooldownMs)})`, EXIT.HARNESS)
  }
  return {
    pairs: integer(options.pairs, 'pairs', 1, 50),
    nullPairs: integer(options.nullPairs, 'nullPairs', 1, 50),
    runs: integer(options.runs, 'runs', 1, 50),
    warmup: integer(options.warmup, 'warmup', 0, 50),
    cooldownMs,
    presets,
  }
}

const median = values => {
  const sorted = [...values].sort((left, right) => left - right)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

const hashesOf = runs => [...new Set(runs.map(run => run.resultSha256))]

/**
 * Compares one preset from already-collected runs. Pure: no processes, no files — the synthetic
 * regression suite feeds it hand-written reports.
 *
 * Contract:
 *  1. every run of the preset (both variants, both null-control sides) must share ONE result hash;
 *     a side with two hashes, or a null control whose sides differ, is nondeterminism (exit 3);
 *  2. the two variants must produce the same hash (otherwise exit 2);
 *  3. ratios are baseline / candidate, so > 1 means the candidate is faster.
 * @param {{ preset: string, o2Runs: object[], o22Runs: object[], nullFirst: object[], nullSecond: object[] }} input
 */
export function compareCase({ preset, o2Runs, o22Runs, nullFirst, nullSecond }) {
  const groups = { o2: o2Runs, o22: o22Runs, nullFirst, nullSecond }
  for (const [name, runs] of Object.entries(groups)) {
    if (!Array.isArray(runs) || runs.length === 0) {
      throw new PerfError('PARAMS', `${preset}: group ${name} has no measured runs`, EXIT.HARNESS)
    }
  }

  const undefinedHash = [...o2Runs, ...o22Runs, ...nullFirst, ...nullSecond].find(run => typeof run.resultSha256 !== 'string' || run.resultSha256.length === 0)
  if (undefinedHash) throw new PerfError('HARNESS', `${preset}: a measured run reported no result hash`, EXIT.HARNESS)

  for (const [name, runs] of Object.entries(groups)) {
    const hashes = hashesOf(runs)
    if (hashes.length > 1) {
      throw new PerfError(
        'NONDETERMINISTIC',
        `${preset}: ${name} produced ${hashes.length} different results across its repeats: ${hashes.join(', ')}`,
        EXIT.HARNESS,
      )
    }
  }

  const o2Hash = hashesOf(o2Runs)[0]
  const o22Hash = hashesOf(o22Runs)[0]
  const nullFirstHash = hashesOf(nullFirst)[0]
  const nullSecondHash = hashesOf(nullSecond)[0]

  if (o2Hash !== o22Hash) {
    throw new PerfError('MISMATCH', `${preset}: result mismatch between variants: O2 ${o2Hash} vs O2.2 ${o22Hash}`, EXIT.MISMATCH)
  }
  if (nullFirstHash !== nullSecondHash || nullFirstHash !== o22Hash) {
    throw new PerfError(
      'NONDETERMINISTIC',
      `${preset}: null control is inconsistent: first ${nullFirstHash}, second ${nullSecondHash}, expected ${o22Hash}`,
      EXIT.HARNESS,
    )
  }

  const o2Medians = o2Runs.map(run => run.medianMs)
  const o22Medians = o22Runs.map(run => run.medianMs)
  const ratios = o2Medians.map((value, index) => value / o22Medians[index])
  const deltas = o2Medians.map((value, index) => value - o22Medians[index])
  const nullRatios = nullFirst.map((run, index) => run.medianMs / nullSecond[index].medianMs)

  return {
    null: {
      pairs: nullFirst.length,
      processMediansFirst: nullFirst.map(run => run.medianMs),
      processMediansSecond: nullSecond.map(run => run.medianMs),
      medianRatio: median(nullRatios),
      ratios: nullRatios,
    },
    o2: {
      processMediansMs: o2Medians,
      medianOfMediansMs: median(o2Medians),
      minMs: Math.min(...o2Runs.map(run => run.minMs)),
      maxMs: Math.max(...o2Runs.map(run => run.maxMs)),
    },
    o22: {
      processMediansMs: o22Medians,
      medianOfMediansMs: median(o22Medians),
      minMs: Math.min(...o22Runs.map(run => run.minMs)),
      maxMs: Math.max(...o22Runs.map(run => run.maxMs)),
    },
    expectedResultSha256: o2Hash,
    medianSpeedup: median(o2Medians) / median(o22Medians),
    medianPairedRatio: median(ratios),
    medianDeltaMs: median(deltas),
    ratios,
    deltas,
    wins: ratios.filter(ratio => ratio > 1).length,
    resultIdentical: true,
  }
}

function cli() {
  const arg = (name, fallback) => {
    const index = process.argv.indexOf(`--${name}`)
    return index >= 0 ? process.argv[index + 1] : fallback
  }

  const o2 = resolve(arg('o2', '.perf/variants/o2/packages/combat-core'))
  const o22 = resolve(arg('o22', '.perf/variants/o22/packages/combat-core'))
  const inputDir = resolve(arg('inputs', 'packages/combat-core/certify/o2-20261018/inputs'))
  const expectNode = arg('expect-node', 'v26.11.1')
  const o2Sha = arg('o2-sha', 'unknown')
  const o22Sha = arg('o22-sha', 'unknown')
  const outDir = resolve(arg('out', '.tmp/perf'))

  const options = validateOptions({
    pairs: arg('pairs', '5'),
    nullPairs: arg('null-pairs', '3'),
    runs: arg('runs', '5'),
    warmup: arg('warmup', '2'),
    cooldownMs: arg('cooldown', '1500'),
    presets: arg('presets', 'massive_clash,zerg_rush'),
  })

  if (expectNode !== 'any' && process.version !== expectNode) {
    throw new PerfError('HARNESS', `expected Node ${expectNode}, running ${process.version}`, EXIT.HARNESS)
  }

  const rawDir = join(outDir, 'raw')
  mkdirSync(rawDir, { recursive: true })

  let sequence = 0
  const measure = (label, packageDir, inputPath) => {
    sequence += 1
    const outFile = join(rawDir, `${String(sequence).padStart(3, '0')}-${label}.json`)
    const result = spawnSync(process.execPath, [
      WORKER, '--module', packageDir, '--input', inputPath, '--runs', String(options.runs),
      '--warmup', String(options.warmup), '--label', label, '--out', outFile,
    ], { encoding: 'utf8', maxBuffer: 1 << 26 })
    if (result.status !== 0) {
      throw new PerfError('HARNESS', `worker for ${label} exited ${result.status}: ${(result.stderr ?? '').slice(-800)}`, EXIT.HARNESS)
    }
    if (!existsSync(outFile)) throw new PerfError('HARNESS', `worker for ${label} produced no report`, EXIT.HARNESS)
    const report = JSON.parse(readFileSync(outFile, 'utf8'))
    const expected = resolve(packageDir).replace(/\\/g, '/').toLowerCase()
    if (!report.entryRealPath.toLowerCase().startsWith(expected)) {
      throw new PerfError('HARNESS', `${label} loaded ${report.entryRealPath}, expected a module inside ${expected}`, EXIT.HARNESS)
    }
    if (!report.resultInvariant) throw new PerfError('NONDETERMINISTIC', `${label} is not deterministic across its own ${options.runs} runs`, EXIT.HARNESS)
    if (expectNode !== 'any' && report.node !== expectNode) {
      throw new PerfError('HARNESS', `${label} ran on ${report.node}, expected ${expectNode}`, EXIT.HARNESS)
    }
    return report
  }

  const cooldown = () => {
    const end = Date.now() + options.cooldownMs
    for (;;) {
      const wait = end - Date.now()
      if (wait <= 0) break
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, wait)
    }
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    node: process.version,
    platform: `${process.platform}-${process.arch}`,
    direction: 'every ratio is baseline / candidate: > 1 means the candidate (O2.2) is faster',
    variants: {
      o2: { packageDir: o2.replace(/\\/g, '/'), sha: o2Sha },
      o22: { packageDir: o22.replace(/\\/g, '/'), sha: o22Sha },
    },
    methodology: {
      pairs: options.pairs,
      nullPairs: options.nullPairs,
      runs: options.runs,
      warmup: options.warmup,
      cooldownMs: options.cooldownMs,
      order: 'baseline/candidate process order swapped every pair',
      aggregation: 'per-process median, median of process medians, paired per-iteration ratios, per-pair deltas',
    },
    cases: {},
  }

  const zodPaths = new Set()
  for (const preset of options.presets) {
    const inputPath = join(inputDir, `${preset}.battle-input.json`)
    if (!existsSync(inputPath)) throw new PerfError('HARNESS', `missing frozen input ${inputPath}`, EXIT.HARNESS)

    const nullFirst = []
    const nullSecond = []
    for (let pair = 1; pair <= options.nullPairs; pair += 1) {
      for (const side of pair % 2 === 1 ? ['first', 'second'] : ['second', 'first']) {
        const report = measure(`${preset}-null-${side}-p${pair}`, o22, inputPath)
        zodPaths.add(report.zodRealPath)
        ;(side === 'first' ? nullFirst : nullSecond).push(report)
        cooldown()
      }
    }

    const o2Runs = []
    const o22Runs = []
    for (let pair = 1; pair <= options.pairs; pair += 1) {
      for (const side of pair % 2 === 1 ? ['o2', 'o22'] : ['o22', 'o2']) {
        const report = measure(`${preset}-${side}-p${pair}`, side === 'o2' ? o2 : o22, inputPath)
        zodPaths.add(report.zodRealPath)
        ;(side === 'o2' ? o2Runs : o22Runs).push(report)
        cooldown()
      }
    }

    summary.cases[preset] = compareCase({ preset, o2Runs, o22Runs, nullFirst, nullSecond })
  }

  if (zodPaths.size !== 1) {
    throw new PerfError('HARNESS', `variants resolved different zod copies: ${[...zodPaths].join(' | ')}`, EXIT.HARNESS)
  }

  const zodPath = [...zodPaths][0]
  const markdown = []
  markdown.push('# Combat-core performance comparison (manual, informational)')
  markdown.push('')
  markdown.push(`- Node ${process.version} on ${process.platform}-${process.arch}`)
  markdown.push(`- O2 (baseline): \`${o2Sha}\` — \`${o2.replace(/\\/g, '/')}\``)
  markdown.push(`- O2.2 (candidate): \`${o22Sha}\` — \`${o22.replace(/\\/g, '/')}\``)
  markdown.push(`- Pairs: ${options.pairs} measured (+${options.nullPairs} null-control), ${options.runs} runs/process, warmup ${options.warmup}, cooldown ${options.cooldownMs} ms`)
  markdown.push(`- Dependency resolution: both variants resolve the same zod (\`${zodPath}\`)`)
  markdown.push('- Direction: every ratio is **baseline / candidate**; > 1 means the candidate is faster')
  markdown.push('')
  markdown.push('| preset | null-control ratio (bias) | O2 median | O2.2 median | paired median | ratio of medians | per-pair | spread O2 / O2.2 |')
  markdown.push('| --- | ---: | ---: | ---: | ---: | ---: | --- | --- |')
  for (const [preset, row] of Object.entries(summary.cases)) {
    markdown.push(`| ${preset} | ${row.null.medianRatio.toFixed(3)}× | ${row.o2.medianOfMediansMs.toFixed(1)} ms | ${row.o22.medianOfMediansMs.toFixed(1)} ms | ${row.medianPairedRatio.toFixed(3)}× | ${row.medianSpeedup.toFixed(3)}× | ${row.ratios.map(value => value.toFixed(3)).join(', ')} | ${row.o2.minMs.toFixed(0)}–${row.o2.maxMs.toFixed(0)} / ${row.o22.minMs.toFixed(0)}–${row.o22.maxMs.toFixed(0)} ms |`)
  }
  markdown.push('')
  markdown.push('**Timings are informational.** This workflow has no timing threshold and never fails on a slow or noisy measurement; the numbers are for the owner to judge, not a release gate.')
  markdown.push('')
  markdown.push('**What does fail the run:** a result hash mismatch between the variants (exit 2); nondeterminism — any repeat, including the null control, producing a different result (exit 3); a content/manifest mismatch; a missing module; a worker failure; different `zod` copies; an unexpected Node version (exit 3).')
  markdown.push('')
  markdown.push('One expected result hash per preset, verified across every repeat of both variants:')
  for (const [preset, row] of Object.entries(summary.cases)) {
    markdown.push(`- ${preset}: \`${row.expectedResultSha256}\``)
  }

  writeFileSync(join(outDir, 'result.json'), `${JSON.stringify(summary, null, 2)}\n`, 'utf8')
  writeFileSync(join(outDir, 'summary.md'), `${markdown.join('\n')}\n`, 'utf8')
  console.log(markdown.join('\n'))
}

const invokedDirectly = process.argv[1] !== undefined && pathToFileURL(resolve(process.argv[1])).href === import.meta.url
if (invokedDirectly) {
  try {
    cli()
  } catch (error) {
    if (error instanceof PerfError) {
      console.error(`PERF-WORKFLOW-ERROR [${error.kind}]: ${error.message}`)
      process.exit(error.exitCode)
    }
    console.error(`PERF-WORKFLOW-ERROR [HARNESS]: ${error?.stack ?? error}`)
    process.exit(EXIT.HARNESS)
  }
}
