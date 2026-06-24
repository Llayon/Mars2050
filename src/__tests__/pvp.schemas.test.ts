import { describe, it, expect, vi, beforeEach } from 'vitest'
import { attackSchema, tradeSchema, battleIdSchema } from '@/domains/pvp/pvp.schemas'

const UUID_A = '550e8400-e29b-41d4-a716-446655440000'
const UUID_B = '550e8400-e29b-41d4-a716-446655440001'

describe('pvp.schemas: clientSeed', () => {
  it('accepts a positive integer seed', () => {
    const r = attackSchema.safeParse({
      attackerColonyId: UUID_A,
      defenderColonyId: UUID_B,
      clientSeed: 12345,
    })
    expect(r.success).toBe(true)
  })

  it('rejects negative seed', () => {
    const r = attackSchema.safeParse({
      attackerColonyId: UUID_A,
      defenderColonyId: UUID_B,
      clientSeed: -1,
    })
    expect(r.success).toBe(false)
  })

  it('rejects float seed', () => {
    const r = attackSchema.safeParse({
      attackerColonyId: UUID_A,
      defenderColonyId: UUID_B,
      clientSeed: 1.5,
    })
    expect(r.success).toBe(false)
  })

  it('omits clientSeed when not provided', () => {
    const r = attackSchema.safeParse({
      attackerColonyId: UUID_A,
      defenderColonyId: UUID_B,
    })
    expect(r.success).toBe(true)
  })
})

describe('pvp.schemas: battleIdSchema', () => {
  it('accepts a uuid', () => {
    expect(battleIdSchema.safeParse({ battleId: UUID_A }).success).toBe(true)
  })
  it('rejects non-uuid', () => {
    expect(battleIdSchema.safeParse({ battleId: 'abc' }).success).toBe(false)
  })
})
