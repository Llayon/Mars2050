// O2.2 microbenchmark (diagnosis only, not evidence): compares the accepted pureSha256 with an
// allocation-free prototype of the same algorithm on the real canonical ruleset string.
// Both must produce the same digest as node:crypto.
//
//   node scripts/o2-next-verify/bench-sha.mjs --core D:/Max/o2/baseline-o2/node_modules/@mars2050/combat-core
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 ? process.argv[index + 1] : fallback
}

const core = resolve(arg('core', 'D:/Max/o2/baseline-o2/node_modules/@mars2050/combat-core')).replace(/\\/g, '/')
const inputs = arg('inputs', 'D:/Max/Mars2050-o2/packages/combat-core/certify/o2-20261018/inputs')
const iterations = Number(arg('iterations', '15'))

const { pureSha256, canonicalizeValue } = await import(`file:///${core}/dist/contracts/ruleset-identity.js`)

function canonicalOf(input) {
  return JSON.stringify({
    rulesetId: input.rulesetId ?? input.rules.rulesetId ?? 'standard',
    rulesetVersion: input.rulesetVersion ?? input.rules.rulesetVersion ?? '1.0.0',
    rules: {
      maxTicks: input.rules.maxTicks ?? 2000,
      timeoutPolicy: input.rules.timeoutPolicy ?? 'draw',
      defenseResolutionMode: input.rules.defenseResolutionMode ?? 'v9_snapshot',
    },
    definitions: canonicalizeValue(input.definitions),
    ...(input.catalog ? { catalog: canonicalizeValue(input.catalog) } : {}),
  })
}

// Prototype of the candidate shape: 8 working variables, one 64-word schedule, no per-round arrays.
const HEX = Array.from({ length: 256 }, (_, value) => value.toString(16).padStart(2, '0'))

function rightRotate(value, amount) {
  return (value >>> amount) | (value << (32 - amount))
}

function allocationFreeSha256(str) {
  const bytes = new TextEncoder().encode(str)
  const bitLength = bytes.length * 8
  const K = [0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2]
  let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a,
    h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19
  const words = new Int32Array(64)
  const padded = ((bytes.length + 8) >> 6) + 1
  const block = new Uint8Array(padded * 64)
  block.set(bytes)
  block[bytes.length] = 0x80
  const view = new DataView(block.buffer)
  view.setUint32(block.length - 8, Math.floor(bitLength / 4294967296))
  view.setUint32(block.length - 4, bitLength >>> 0)
  for (let offset = 0; offset < block.length; offset += 64) {
    for (let i = 0; i < 16; i += 1) words[i] = view.getInt32(offset + i * 4)
    for (let i = 16; i < 64; i += 1) {
      const w15 = words[i - 15]
      const w2 = words[i - 2]
      const s0 = rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3)
      const s1 = rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10)
      words[i] = (words[i - 16] + s0 + words[i - 7] + s1) | 0
    }
    let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7
    for (let i = 0; i < 64; i += 1) {
      const s1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)
      const ch = (e & f) ^ (~e & g)
      const temp1 = (h + s1 + ch + K[i] + words[i]) | 0
      const s0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)
      const maj = (a & b) ^ (a & c) ^ (b & c)
      const temp2 = (s0 + maj) | 0
      h = g; g = f; f = e; e = (d + temp1) | 0
      d = c; c = b; b = a; a = (temp1 + temp2) | 0
    }
    h0 = (h0 + a) | 0; h1 = (h1 + b) | 0; h2 = (h2 + c) | 0; h3 = (h3 + d) | 0
    h4 = (h4 + e) | 0; h5 = (h5 + f) | 0; h6 = (h6 + g) | 0; h7 = (h7 + h) | 0
  }
  const out = [h0, h1, h2, h3, h4, h5, h6, h7]
  let result = ''
  for (let i = 0; i < 8; i += 1) {
    for (let j = 3; j >= 0; j -= 1) result += HEX[(out[i] >> (8 * j)) & 255]
  }
  return result
}

function time(fn, text) {
  const times = []
  let digest = ''
  for (let index = 0; index < iterations; index += 1) {
    const startedAt = performance.now()
    digest = fn(text)
    times.push(performance.now() - startedAt)
  }
  times.sort((left, right) => left - right)
  return { digest, medianMs: times[Math.floor(times.length / 2)], minMs: times[0], maxMs: times[times.length - 1] }
}

const report = { core, node: process.version, iterations, cases: {} }
for (const preset of ['massive_clash', 'zerg_rush']) {
  const input = JSON.parse(readFileSync(join(inputs, `${preset}.battle-input.json`), 'utf8'))
  const text = canonicalOf(input)
  const expected = createHash('sha256').update(text, 'utf8').digest('hex')
  const baseline = time(pureSha256, text)
  const prototype = time(allocationFreeSha256, text)
  report.cases[preset] = {
    chars: text.length,
    nodeCryptoMs: (() => {
      const startedAt = performance.now()
      for (let index = 0; index < iterations; index += 1) createHash('sha256').update(text, 'utf8').digest('hex')
      return (performance.now() - startedAt) / iterations
    })(),
    expectedDigest: expected,
    baseline,
    prototype,
    baselineMatches: baseline.digest === expected,
    prototypeMatches: prototype.digest === expected,
  }
}
console.log(JSON.stringify(report, null, 2))
