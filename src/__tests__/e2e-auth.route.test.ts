import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mockGetOrCreateE2eSession = vi.fn()
const mockResetE2eSession = vi.fn()

vi.mock('@/domains/e2e/e2e.service', () => ({
  getOrCreateE2eSession: () => mockGetOrCreateE2eSession(),
  resetE2eSession: () => mockResetE2eSession(),
}))

import { GET } from '@/app/api/e2e/session/route'
import { POST } from '@/app/api/e2e/reset/route'

const USER_ID = '550e8400-e29b-41d4-a716-446655440000'
const COLONY_ID = '550e8400-e29b-41d4-a716-446655440001'

beforeEach(() => {
  vi.clearAllMocks()
  vi.unstubAllEnvs()
  mockGetOrCreateE2eSession.mockResolvedValue({
    data: { user: { id: USER_ID, email: 'mars2050_e2e_smoke@mars2050.local' }, colonyId: COLONY_ID },
    error: null,
  })
  mockResetE2eSession.mockResolvedValue({
    data: { user: { id: USER_ID, email: 'mars2050_e2e_smoke@mars2050.local' }, colonyId: COLONY_ID },
    error: null,
  })
})

describe('/api/e2e/session', () => {
  it('is disabled without E2E_AUTH_BYPASS', async () => {
    const res = await GET()

    expect(res.status).toBe(404)
    expect(mockGetOrCreateE2eSession).not.toHaveBeenCalled()
  })

  it('is disabled in production even when flag is set', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('E2E_AUTH_BYPASS', '1')

    const res = await GET()

    expect(res.status).toBe(404)
    expect(mockGetOrCreateE2eSession).not.toHaveBeenCalled()
  })

  it('returns an e2e session and sets the bypass cookie when enabled', async () => {
    vi.stubEnv('E2E_AUTH_BYPASS', '1')

    const res = await GET()
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.colonyId).toBe(COLONY_ID)
    expect(res.headers.get('set-cookie')).toContain('mars2050-e2e-user-id')
  })
})

describe('/api/e2e/reset', () => {
  it('validates an empty reset body and resets the e2e colony', async () => {
    vi.stubEnv('E2E_AUTH_BYPASS', '1')
    const req = new NextRequest('http://localhost/api/e2e/reset', { method: 'POST', body: '{}' })

    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.user.id).toBe(USER_ID)
    expect(data.colonyId).toBe(COLONY_ID)
    expect(mockResetE2eSession).toHaveBeenCalledOnce()
  })
})
