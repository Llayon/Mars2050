import { describe, it, expect, vi } from 'vitest'
import { loadOwnedColony } from '@/domains/pvp/pvp.persistence'

function chainableForSingle(data: unknown, error: unknown = null) {
  const c: Record<string, unknown> = {}
  c.select = vi.fn(() => c)
  c.eq = vi.fn(() => c)
  c.single = vi.fn(() => Promise.resolve({ data, error }))
  return c
}

describe('pvp.service: loadOwnedColony', () => {
  it('returns the colony when the user owns it', async () => {
    const client = {
      from: vi.fn(() => chainableForSingle({ id: 'c1', user_id: 'u1' })),
    }
    const r = await loadOwnedColony(client as never, 'c1', 'u1')
    expect(r).toEqual({ id: 'c1', user_id: 'u1' })
  })

  it('returns null when the colony belongs to another user', async () => {
    const client = {
      from: vi.fn(() => chainableForSingle({ id: 'c1', user_id: 'someone-else' })),
    }
    const r = await loadOwnedColony(client as never, 'c1', 'me')
    expect(r).toBeNull()
  })

  it('returns null when the colony is missing (RLS hides it)', async () => {
    const client = {
      from: vi.fn(() => chainableForSingle(null, { message: 'not found' })),
    }
    const r = await loadOwnedColony(client as never, 'c1', 'me')
    expect(r).toBeNull()
  })
})
