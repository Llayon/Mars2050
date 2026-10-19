// Diagnostic: counts every `structuredClone` call the public core makes during ONE battle and
// classifies the most suspicious call site (the action-group defense frame snapshot).
// Run: npx tsx scripts/o2-verify/count-clones.ts --preset zerg_rush
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { simulateCombat } from '@mars2050/combat-core'

function arg(name: string, fallback: string): string {
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 ? process.argv[index + 1] : fallback
}

const presetId = arg('preset', 'zerg_rush')
const input = JSON.parse(readFileSync(resolve('packages/combat-core/certify/o2-20261018/inputs', `${presetId}.battle-input.json`), 'utf8'))

const original = globalThis.structuredClone
let calls = 0
let nanos = 0n
let emptyArrays = 0
let emptyObjects = 0
let arrayElements = 0
let objectKeys = 0
let other = 0
globalThis.structuredClone = function countingStructuredClone<T>(value: T, options?: StructuredSerializeOptions): T {
  calls += 1
  if (Array.isArray(value)) {
    arrayElements += value.length
    if (value.length === 0) emptyArrays += 1
  } else if (value && typeof value === 'object') {
    const keys = Object.keys(value).length
    objectKeys += keys
    if (keys === 0) emptyObjects += 1
  } else {
    other += 1
  }
  const startedAt = process.hrtime.bigint()
  const result = original.call(globalThis, value, options)
  nanos += process.hrtime.bigint() - startedAt
  return result
} as typeof globalThis.structuredClone

const startedAt = performance.now()
let result: ReturnType<typeof simulateCombat>
try {
  result = simulateCombat(input)
} finally {
  globalThis.structuredClone = original
}
const elapsed = performance.now() - startedAt

console.log(JSON.stringify({
  preset: presetId,
  ticks: result.elapsedTicks,
  logs: result.logs.length,
  actions: result.logs.reduce((sum, entry) => sum + entry.actions.length, 0),
  elapsedMs: elapsed,
  structuredClone: {
    calls,
    emptyArrays,
    emptyObjects,
    arrayElements,
    objectKeys,
    other,
    totalMs: Number(nanos) / 1e6,
    shareOfElapsed: Number(nanos) / 1e6 / elapsed,
    callsPerTick: calls / Math.max(1, result.elapsedTicks),
  },
}, null, 2))
