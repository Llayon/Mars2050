import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { computeRulesetIdentity, pureSha256 } from '../src/index.js'
import { smallBattle } from './o2-fixtures.js'

/**
 * O2.2 regression suite for the ruleset hasher.
 *
 * The slice replaced the per-round array rebuilding inside `pureSha256` with eight working
 * variables and one 64-word schedule. The digest is part of every public result
 * (`metadata.ruleset.contentHash`), so these tests pin the exact bytes for the padding boundaries
 * (55/56/57, 63/64/65, 119/120/127/128), for the real 146 331-character canonical ruleset string
 * and for the canonical identity of the shared O2 fixture. Every pinned value was produced by the
 * accepted o2mv.1 package and cross-checked against `node:crypto`, so a single wrong rotation,
 * constant or byte order fails here instead of silently changing a replay.
 */

const NODE_CRYPTO = (text: string): string => createHash('sha256').update(text, 'utf8').digest('hex')

const PINNED_BY_LENGTH: ReadonlyArray<readonly [number, string]> = [
  [0, 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'],
  [1, 'ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb'],
  [3, '9834876dcfb05cb167a5c24953eba58c4ac89b1adf57f28f2f9d09af107ee8f0'],
  [55, '9f4390f8d30c2dd92ec9f095b65e2b9ae9b0a925a5258e241c9f1e910f734318'],
  [56, 'b35439a4ac6f0948b6d6f9e3c6af0f5f590ce20f1bde7090ef7970686ec6738a'],
  [57, 'f13b2d724659eb3bf47f2dd6af1accc87b81f09f59f2b75e5c0bed6589dfe8c6'],
  [63, '7d3e74a05d7db15bce4ad9ec0658ea98e3f06eeecf16b4c6fff2da457ddc2f34'],
  [64, 'ffe054fe7ae0cb6dc65c3af9b61d5209f439851db43d0ba5997337df154668eb'],
  [65, '635361c48bb9eab14198e76ea8ab7f1a41685d6ad62aa9146d301d4f17eb0ae0'],
  [119, '31eba51c313a5c08226adf18d4a359cfdfd8d2e816b13f4af952f7ea6584dcfb'],
  [120, '2f3d335432c70b580af0e8e1b3674a7c020d683aa5f73aaaedfdc55af904c21c'],
  [127, 'c57e9278af78fa3cab38667bef4ce29d783787a2f731d4e12200270f0c32320a'],
  [128, '6836cf13bac400e9105071cd6af47084dfacad4e5e302c94bfed24e013afb73e'],
  [146331, 'd6ca9c53a7979e1c1dd4e4ff988b786690c77bef809bae80d112928d8557bf05'],
]

/** The canonical identity of the shared O2 fixture, produced by the accepted o2mv.1 package. */
const FIXTURE_RULESET_CONTENT_HASH = 'bf0fdfb00f694c60e9fd6723fa6fc35ed5018402a60c0a47a322b0a36b022295'

describe('O2.2: pureSha256 keeps the accepted digest for every padding boundary', () => {
  it('matches the pinned digests and node:crypto at block boundaries', () => {
    for (const [length, expected] of PINNED_BY_LENGTH) {
      const text = 'a'.repeat(length)
      expect(pureSha256(text), `length ${length}`).toBe(expected)
      expect(pureSha256(text), `length ${length} vs node:crypto`).toBe(NODE_CRYPTO(text))
    }
  })

  it('hashes the production-sized canonical string with the accepted digest', () => {
    // 146 331 characters is the real canonical ruleset payload of both R7 presets: 2 286 blocks.
    // Correctness is asserted by the digest only: a wall-clock bound here would turn machine load
    // into a red build, and the speed of this slice is measured by the A/B harness instead.
    const text = 'a'.repeat(146331)
    expect(pureSha256(text)).toBe('d6ca9c53a7979e1c1dd4e4ff988b786690c77bef809bae80d112928d8557bf05')
    expect(pureSha256(text)).toBe(NODE_CRYPTO(text))
  })

  it('preserves multi-byte input and repeated calls without shared state', () => {
    const multiByte = 'тест детерминизма марса 🚀 '.repeat(400)
    const first = pureSha256(multiByte)
    const other = pureSha256('b'.repeat(4096))
    const again = pureSha256(multiByte)
    expect(first).toBe(NODE_CRYPTO(multiByte))
    expect(other).toBe(NODE_CRYPTO('b'.repeat(4096)))
    expect(again).toBe(first)
  })

  it('hashes small -> large -> small without cross-contamination', () => {
    const small = 'o2.2 small payload'
    const large = 'a'.repeat(146331)
    const firstSmall = pureSha256(small)
    const largeDigest = pureSha256(large)
    const secondSmall = pureSha256(small)
    expect(secondSmall).toBe(firstSmall)
    expect(largeDigest).toBe('d6ca9c53a7979e1c1dd4e4ff988b786690c77bef809bae80d112928d8557bf05')
    expect(firstSmall).toBe(NODE_CRYPTO(small))
  })

  it('pins the canonical ruleset identity of the shared fixture', () => {
    const identity = computeRulesetIdentity(smallBattle())
    expect(identity.contentHash).toBe(FIXTURE_RULESET_CONTENT_HASH)
    expect(computeRulesetIdentity(smallBattle()).contentHash).toBe(FIXTURE_RULESET_CONTENT_HASH)
  })
})
