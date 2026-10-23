// Synthetic regressions for the performance harness (no battles, no child processes, < 1 s).
//   node --test scripts/o2-next-verify/perf-compare-synthetic.mjs
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { compareCase, EXIT, PerfError, validateOptions } from './perf-compare.mjs'

const run = (medianMs, resultSha256, extra = {}) => ({
  medianMs, minMs: medianMs, maxMs: medianMs, resultSha256, node: 'v26.11.1', ...extra,
})

const groups = (o2Hashes, o22Hashes, nullHashes = o22Hashes) => ({
  o2Runs: o2Hashes.map((hash, index) => run(100 + index, hash)),
  o22Runs: o22Hashes.map((hash, index) => run(80 + index, hash)),
  nullFirst: [run(90, nullHashes[0] ?? 'A')],
  nullSecond: [run(91, nullHashes[1] ?? nullHashes[0] ?? 'A')],
})

const expectPerfError = (fn, kind, exitCode) => {
  assert.throws(fn, error => {
    assert.ok(error instanceof PerfError, `expected PerfError, got ${error?.name}`)
    assert.equal(error.kind, kind)
    assert.equal(error.exitCode, exitCode)
    return true
  })
}

describe('parameter validation (pairs=0 must never pass)', () => {
  it('rejects zero, negative, fractional and non-numeric pairs', () => {
    for (const pairs of [0, -1, 2.5, 'x', '', 'NaN', null]) {
      expectPerfError(() => validateOptions({ pairs, nullPairs: 1, runs: 1, warmup: 0, cooldownMs: 0, presets: 'massive_clash' }), 'PARAMS', EXIT.HARNESS)
    }
  })

  it('rejects zero runs, negative warmup, zero null pairs and an empty preset list', () => {
    expectPerfError(() => validateOptions({ pairs: 1, nullPairs: 1, runs: 0, warmup: 0, cooldownMs: 0, presets: 'x' }), 'PARAMS', EXIT.HARNESS)
    expectPerfError(() => validateOptions({ pairs: 1, nullPairs: 1, runs: 1, warmup: -1, cooldownMs: 0, presets: 'x' }), 'PARAMS', EXIT.HARNESS)
    expectPerfError(() => validateOptions({ pairs: 1, nullPairs: 0, runs: 1, warmup: 0, cooldownMs: 0, presets: 'x' }), 'PARAMS', EXIT.HARNESS)
    expectPerfError(() => validateOptions({ pairs: 1, nullPairs: 1, runs: 1, warmup: 0, cooldownMs: 0, presets: ' , ' }), 'PARAMS', EXIT.HARNESS)
  })

  it('accepts a normal configuration and normalizes numbers', () => {
    const options = validateOptions({ pairs: '5', nullPairs: '3', runs: '5', warmup: '2', cooldownMs: '1500', presets: 'massive_clash, zerg_rush' })
    assert.deepEqual(options, { pairs: 5, nullPairs: 3, runs: 5, warmup: 2, cooldownMs: 1500, presets: ['massive_clash', 'zerg_rush'] })
  })
})

describe('speedup direction (baseline / candidate)', () => {
  it('baseline 100 ms vs candidate 80 ms is 1.25x in both the median and the paired ratio', () => {
    const result = compareCase({ preset: 'p', ...groups(['A', 'A'], ['A', 'A']) })
    // medians are 100/101 and 80/81 in the fixture; the direction is what matters here
    assert.ok(result.medianSpeedup > 1, `expected > 1, got ${result.medianSpeedup}`)
    assert.ok(result.medianPairedRatio > 1, `expected > 1, got ${result.medianPairedRatio}`)
    assert.ok(result.medianDeltaMs > 0, 'positive delta must mean the candidate is faster')
    assert.equal(result.wins, 2)
    assert.equal(result.resultIdentical, true)
    assert.equal(result.expectedResultSha256, 'A')
  })

  it('uses the same direction for a scalar pair', () => {
    const result = compareCase({
      preset: 'p',
      o2Runs: [run(100, 'A')],
      o22Runs: [run(80, 'A')],
      nullFirst: [run(90, 'A')],
      nullSecond: [run(90, 'A')],
    })
    assert.equal(result.medianSpeedup, 1.25)
    assert.equal(result.medianPairedRatio, 1.25)
    assert.equal(result.medianDeltaMs, 20)
  })
})

describe('one expected hash across every repeat', () => {
  it('fails when one variant is nondeterministic across its own processes', () => {
    expectPerfError(() => compareCase({ preset: 'p', ...groups(['A', 'B'], ['A', 'B']) }), 'NONDETERMINISTIC', EXIT.HARNESS)
  })

  it('fails when both variants are "equally nondeterministic" (the former blind spot)', () => {
    // Both sides produce the same set {A, B}: the old set comparison passed here.
    expectPerfError(() => compareCase({
      preset: 'p',
      o2Runs: [run(100, 'A'), run(101, 'B')],
      o22Runs: [run(80, 'A'), run(81, 'B')],
      nullFirst: [run(90, 'A')],
      nullSecond: [run(90, 'A')],
    }), 'NONDETERMINISTIC', EXIT.HARNESS)
  })

  it('fails when the two sides of the null control disagree', () => {
    expectPerfError(() => compareCase({
      preset: 'p',
      o2Runs: [run(100, 'A')],
      o22Runs: [run(80, 'A')],
      nullFirst: [run(90, 'A')],
      nullSecond: [run(90, 'B')],
    }), 'NONDETERMINISTIC', EXIT.HARNESS)
  })

  it('fails on a variant mismatch with exit code 2', () => {
    expectPerfError(() => compareCase({
      preset: 'p',
      o2Runs: [run(100, 'A')],
      o22Runs: [run(80, 'B')],
      nullFirst: [run(90, 'B')],
      nullSecond: [run(90, 'B')],
    }), 'MISMATCH', EXIT.MISMATCH)
  })

  it('fails when a null control does not match the compared variant', () => {
    expectPerfError(() => compareCase({
      preset: 'p',
      o2Runs: [run(100, 'A')],
      o22Runs: [run(80, 'A')],
      nullFirst: [run(90, 'C')],
      nullSecond: [run(90, 'C')],
    }), 'NONDETERMINISTIC', EXIT.HARNESS)
  })

  it('fails when a group has no runs at all', () => {
    expectPerfError(() => compareCase({ preset: 'p', o2Runs: [], o22Runs: [run(80, 'A')], nullFirst: [run(90, 'A')], nullSecond: [run(90, 'A')] }), 'PARAMS', EXIT.HARNESS)
  })
})
