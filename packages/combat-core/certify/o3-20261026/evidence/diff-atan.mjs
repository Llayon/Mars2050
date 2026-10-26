// O3.0 lab: 0-ULP differential check of the changed deterministic atan/atan2 against accepted O2.2.
// Compares IEEE-754 bit patterns, not JSON. Includes recorded battle arguments, branch boundaries,
// signed zeros, subnormals, infinities, NaNs, quadrants and a seeded random corpus.
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 ? process.argv[index + 1] : fallback
}
const baselinePath = arg('baseline', 'D:/Max/Mars2050-o2/.tmp/base-o22/dist/math/trig-atan.js')
const candidatePath = arg('candidate', 'D:/Max/Mars2050-o2/packages/combat-core/dist/math/trig-atan.js')
const randomPairs = Number(arg('random', '2000000'))
const seedArg = Number(arg('seed', '24680'))

const baseline = await import(pathToFileURL(baselinePath).href)
const candidate = await import(pathToFileURL(candidatePath).href)

const bitsView = new DataView(new ArrayBuffer(8))
function bits(value) {
  bitsView.setFloat64(0, value, false)
  return `${bitsView.getUint32(0, false).toString(16).padStart(8, '0')}${bitsView.getUint32(4, false).toString(16).padStart(8, '0')}`
}
function fromWords(high, low = 0) {
  bitsView.setUint32(0, high >>> 0, false)
  bitsView.setUint32(4, low >>> 0, false)
  return bitsView.getFloat64(0, false)
}
function same(actual, expected) {
  return Object.is(actual, expected) && bits(actual) === bits(expected)
}

const specials = [
  0, -0, 1, -1, 1.5, -1.5, 0.5, -0.5, 2, -2, 3.141592653589793, -3.141592653589793,
  1.5707963267948966, -1.5707963267948966, 6.283185307179586, -6.283185307179586,
  Number.MIN_VALUE, -Number.MIN_VALUE, Number.MAX_VALUE, -Number.MAX_VALUE,
  Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, Number.EPSILON, -Number.EPSILON,
  Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NaN,
]
const wordEdges = [
  0x00000000, 0x00000001, 0x000fffff, 0x00100000, 0x3e1fffff, 0x3e200000, 0x3e200001,
  0x3fdfffff, 0x3fdc0000, 0x3fdc0001, 0x3fe5ffff, 0x3fe60000, 0x3fe60001,
  0x3ff2ffff, 0x3ff30000, 0x3ff30001, 0x40037fff, 0x40038000, 0x40038001,
  0x440fffff, 0x44100000, 0x44100001, 0x7fefffff, 0x7ff00000, 0x7ff00001,
  0x7ff7ffff, 0x7ff80000, 0x7fffffff,
]
for (const high of wordEdges) {
  for (const low of [0, 1, 0xffffffff]) {
    specials.push(fromWords(high, low), fromWords(high | 0x80000000, low))
  }
}
// Exact powers of two across the exponent range and their neighbours.
for (let exponent = -1074; exponent <= 1023; exponent += 1) {
  const value = exponent === -1074 ? Number.MIN_VALUE : 2 ** exponent
  specials.push(value, -value)
  if (Number.isFinite(value) && value !== 0) {
    specials.push(value * (1 - Number.EPSILON), value * (1 + Number.EPSILON))
    specials.push(-value * (1 - Number.EPSILON), -value * (1 + Number.EPSILON))
  }
}

// Real arguments recorded from one accepted-O2.2 battle each.
const recorded = []
for (const preset of ['zerg_rush', 'massive_clash']) {
  const data = JSON.parse(readFileSync(`D:/Max/o3/lab/atan2-args-${preset}.json`, 'utf8'))
  for (const [y, x] of data.pairs) recorded.push([y, x])
}
for (const [y, x] of recorded) {
  specials.push(y, x)
}

let state = seedArg >>> 0
function nextU32() {
  state ^= state << 13; state >>>= 0
  state ^= state >>> 17
  state ^= state << 5; state >>>= 0
  return state
}
const randomValues = []
for (let i = 0; i < Math.min(randomPairs, 200000); i += 1) {
  const high = nextU32()
  const low = nextU32()
  // Keep the corpus mostly finite: replace exponent 0x7ff with a random finite exponent.
  const safeHigh = (high & 0x7ff00000) === 0x7ff00000 ? (high & 0x800fffff) | ((nextU32() % 0x7ff) << 20) : high
  randomValues.push(fromWords(safeHigh, low))
}

const atanInputs = [...specials, ...randomValues]
let atanChecked = 0
for (const value of atanInputs) {
  const expected = baseline.deterministicAtan(value)
  const actual = candidate.deterministicAtan(value)
  if (!same(actual, expected)) {
    console.error(JSON.stringify({ function: 'atan', input: bits(value), expected: bits(expected), actual: bits(actual), value }))
    process.exit(1)
  }
  atanChecked += 1
}

const specialPrefix = specials.slice(0, 400)
const atan2Pairs = []
for (const [y, x] of recorded) atan2Pairs.push([y, x])
for (const y of specialPrefix) for (const x of specialPrefix) atan2Pairs.push([y, x])
for (let i = 0; i < randomPairs; i += 1) {
  const y = randomValues[nextU32() % randomValues.length]
  const x = randomValues[nextU32() % randomValues.length]
  atan2Pairs.push([y, x])
}
let atan2Checked = 0
for (const [y, x] of atan2Pairs) {
  const expected = baseline.deterministicAtan2(y, x)
  const actual = candidate.deterministicAtan2(y, x)
  if (!same(actual, expected)) {
    console.error(JSON.stringify({ function: 'atan2', y: bits(y), x: bits(x), expected: bits(expected), actual: bits(actual) }))
    process.exit(1)
  }
  atan2Checked += 1
}

// Negative control: the comparator must reject a deliberately perturbed value.
let detected = false
for (const value of atanInputs) {
  const expected = baseline.deterministicAtan(value)
  bitsView.setFloat64(0, expected, false)
  const perturbed = fromWords(
    bitsView.getUint32(0, false),
    (bitsView.getUint32(4, false) ^ 1) >>> 0,
  )
  if (!same(perturbed, expected)) { detected = true; break }
}
if (!detected) {
  console.error('negative control was not detected')
  process.exit(1)
}

console.log(JSON.stringify({
  baseline: baselinePath,
  candidate: candidatePath,
  node: process.version,
  seed: seedArg,
  recordedPairs: recorded.length,
  randomValues: randomValues.length,
  randomPairs,
  atanChecked,
  atan2Checked,
  negativeControlDetected: detected,
  result: 'BIT_IDENTICAL',
}, null, 2))
