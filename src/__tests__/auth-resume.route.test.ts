import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockGetAuthContext = vi.fn()
const mockResumeColony = vi.fn()

vi.mock('@/lib/auth', () => ({
  getAuthContext: (...args: unknown[]) => mockGetAuthContext(...args),
}))

vi.mock('@/domains/auth/auth.service', () => ({
  resumeColony: (...args: unknown[]) => mockResumeColony(...args),
}))

import { GET } from '@/app/api/auth/resume/route'

const USER_ID = '550e8400-e29b-41d4-a716-446655440000'
const COLONY_ID = '550e8400-e29b-41d4-a716-446655440001'

beforeEach(() => {
  vi.clearAllMocks()
  mockGetAuthContext.mockResolvedValue({
    userId: USER_ID,
    email: 'commander@mars2050.test',
    client: {},
  })
  mockResumeColony.mockResolvedValue({ user: null, error: null, colonyId: COLONY_ID })
})

describe('/api/auth/resume', () => {
  it('returns 401 without an authenticated request', async () => {
    mockGetAuthContext.mockResolvedValue(null)

    const res = await GET(new Request('http://localhost/api/auth/resume'))

    expect(res.status).toBe(401)
    expect(mockResumeColony).not.toHaveBeenCalled()
  })

  it('returns the authenticated user and colony id', async () => {
    const res = await GET(new Request('http://localhost/api/auth/resume'))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.user.id).toBe(USER_ID)
    expect(data.user.email).toBe('commander@mars2050.test')
    expect(data.colonyId).toBe(COLONY_ID)
    expect(mockResumeColony).toHaveBeenCalledWith(USER_ID)
  })

  it('returns 500 when the colony cannot be resumed', async () => {
    mockResumeColony.mockResolvedValue({ user: null, error: 'database unavailable', colonyId: null })

    const res = await GET(new Request('http://localhost/api/auth/resume'))
    const data = await res.json()

    expect(res.status).toBe(500)
    expect(data.error.message).toBe('database unavailable')
  })
})
