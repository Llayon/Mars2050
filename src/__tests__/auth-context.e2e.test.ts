import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockGetUser = vi.fn()
const mockMaybeSingle = vi.fn()
const mockGetServerClient = vi.fn()
const mockProfileEq = vi.fn()
const mockCreateClient = vi.fn(() => ({
  auth: { getUser: mockGetUser },
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => mockCreateClient(),
}))

vi.mock('@/domains/resource/resource.server', () => ({
  getServerClient: () => mockGetServerClient(),
}))

import { E2E_AUTH_COOKIE, E2E_USERNAME } from '@/domains/e2e/e2e.config'
import { getAuthContext } from '@/lib/auth'

const USER_ID = '550e8400-e29b-41d4-a716-446655440000'

beforeEach(() => {
  vi.clearAllMocks()
  vi.unstubAllEnvs()
  mockGetUser.mockResolvedValue({ data: { user: { id: 'normal-user', email: 'normal@example.com' } }, error: null })
  mockMaybeSingle.mockResolvedValue({ data: { id: USER_ID }, error: null })
  mockProfileEq.mockReturnThis()
  mockGetServerClient.mockReturnValue({
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: mockProfileEq,
      maybeSingle: mockMaybeSingle,
    })),
  })
})

describe('getAuthContext e2e branch', () => {
  it('keeps the normal Supabase auth path when e2e bypass is disabled', async () => {
    const req = new Request('http://localhost/api/resources', {
      headers: { authorization: 'Bearer token-1' },
    })

    const auth = await getAuthContext(req)

    expect(auth?.userId).toBe('normal-user')
    expect(mockGetUser).toHaveBeenCalledWith('token-1')
    expect(mockGetServerClient).not.toHaveBeenCalled()
  })

  it('accepts e2e cookie only for the isolated e2e profile', async () => {
    vi.stubEnv('E2E_AUTH_BYPASS', '1')
    const req = new Request('http://localhost/api/resources', {
      headers: { cookie: `${E2E_AUTH_COOKIE}=${USER_ID}` },
    })

    const auth = await getAuthContext(req)

    expect(auth?.userId).toBe(USER_ID)
    expect(mockMaybeSingle).toHaveBeenCalled()
    expect(mockProfileEq).toHaveBeenCalledWith('username', E2E_USERNAME)
  })

  it('rejects an e2e cookie that does not match the e2e profile', async () => {
    vi.stubEnv('E2E_AUTH_BYPASS', '1')
    mockMaybeSingle.mockResolvedValue({ data: null, error: null })
    const req = new Request('http://localhost/api/resources', {
      headers: { cookie: `${E2E_AUTH_COOKIE}=${USER_ID}` },
    })

    const auth = await getAuthContext(req)

    expect(auth).toBeNull()
  })
})
