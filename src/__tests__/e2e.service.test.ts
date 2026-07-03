import { beforeEach, describe, expect, it, vi } from 'vitest'
import { E2E_COLONY_NAME, E2E_USERNAME } from '@/domains/e2e/e2e.config'

const USER_ID = '550e8400-e29b-41d4-a716-446655440000'
const COLONY_ID = '550e8400-e29b-41d4-a716-446655440001'

const mockProfileMaybeSingle = vi.fn()
const mockColonyMaybeSingle = vi.fn()
const mockColonyInsert = vi.fn()
const mockColonySingle = vi.fn()
const mockGetUserById = vi.fn()
const mockCreateUser = vi.fn()
const mockListUsers = vi.fn()
const profileEq = vi.fn()
const colonyEq = vi.fn()

function chain(methods: Record<string, unknown>) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn(),
    ...methods,
  }
}

const mockFrom = vi.fn((table: string) => {
  if (table === 'profiles') {
    return chain({ eq: profileEq, maybeSingle: mockProfileMaybeSingle })
  }
  if (table === 'colonies') {
    return chain({
      eq: colonyEq,
      maybeSingle: mockColonyMaybeSingle,
      insert: mockColonyInsert,
    })
  }
  return chain({})
})

vi.mock('@/domains/resource/resource.server', () => ({
  getServerClient: () => ({
    from: mockFrom,
    auth: {
      admin: {
        getUserById: mockGetUserById,
        createUser: mockCreateUser,
        listUsers: mockListUsers,
      },
    },
  }),
}))

import { getOrCreateE2eSession } from '@/domains/e2e/e2e.service'

beforeEach(() => {
  vi.clearAllMocks()
  profileEq.mockReturnThis()
  colonyEq.mockReturnThis()
  mockProfileMaybeSingle.mockResolvedValue({ data: { id: USER_ID }, error: null })
  mockGetUserById.mockResolvedValue({ data: { user: { id: USER_ID, email: 'e2e@example.com' } }, error: null })
  mockColonyMaybeSingle.mockResolvedValue({ data: { id: COLONY_ID }, error: null })
  mockColonySingle.mockResolvedValue({ data: { id: COLONY_ID }, error: null })
  mockColonyInsert.mockReturnValue({
    select: vi.fn().mockReturnValue({ single: mockColonySingle }),
  })
})

describe('getOrCreateE2eSession', () => {
  it('reuses only the named e2e colony for the e2e profile', async () => {
    const result = await getOrCreateE2eSession()

    expect(result.data?.colonyId).toBe(COLONY_ID)
    expect(profileEq).toHaveBeenCalledWith('username', E2E_USERNAME)
    expect(colonyEq).toHaveBeenCalledWith('user_id', USER_ID)
    expect(colonyEq).toHaveBeenCalledWith('name', E2E_COLONY_NAME)
    expect(mockColonyInsert).not.toHaveBeenCalled()
  })

  it('creates a named e2e colony when none exists', async () => {
    mockColonyMaybeSingle.mockResolvedValueOnce({ data: null, error: null })

    const result = await getOrCreateE2eSession()

    expect(result.data?.colonyId).toBe(COLONY_ID)
    expect(mockColonyInsert).toHaveBeenCalledWith(expect.objectContaining({
      user_id: USER_ID,
      name: E2E_COLONY_NAME,
    }))
  })
})
