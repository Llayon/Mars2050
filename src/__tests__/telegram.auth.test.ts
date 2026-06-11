import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createHmac } from 'crypto'

/**
 * Builds a valid Telegram initData string with HMAC signature for testing.
 * Uses the same algorithm as Telegram's WebApp.
 */
function buildInitData(
  botToken: string,
  user: { id: number; first_name: string; username?: string },
  authDateSec?: number
): string {
  const authDate = authDateSec ?? Math.floor(Date.now() / 1000)
  const userJson = JSON.stringify(user)
  const params = new URLSearchParams()
  params.set('auth_date', String(authDate))
  params.set('query_id', 'AAHdF6IqAAAAAN0XohCK8z3y')
  params.set('user', userJson)

  const sorted = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n')

  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest()
  const hash = createHmac('sha256', secretKey).update(sorted).digest('hex')
  params.set('hash', hash)

  return params.toString()
}

const TEST_BOT_TOKEN = 'test-bot-token-for-unit-tests'

describe('tgCredentials', () => {
  it('produces deterministic email/password for the same tgId', async () => {
    vi.stubEnv('TELEGRAM_BOT_TOKEN', TEST_BOT_TOKEN)
    const { tgCredentials } = await import('@/domains/telegram/telegram.service')

    const a = tgCredentials(123456789)
    const b = tgCredentials(123456789)
    expect(a.email).toBe(b.email)
    expect(a.password).toBe(b.password)
    expect(a.email).toMatch(/^tg_123456789@mars2050\.game$/)
    expect(a.password).toMatch(/^tg_[a-f0-9]{24}$/)
  })

  it('produces different credentials for different tgIds', async () => {
    vi.stubEnv('TELEGRAM_BOT_TOKEN', TEST_BOT_TOKEN)
    const { tgCredentials } = await import('@/domains/telegram/telegram.service')

    const a = tgCredentials(111)
    const b = tgCredentials(222)
    expect(a.email).not.toBe(b.email)
    expect(a.password).not.toBe(b.password)
  })
})

describe('validateInitData', () => {
  beforeEach(() => {
    vi.stubEnv('TELEGRAM_BOT_TOKEN', TEST_BOT_TOKEN)
  })

  it('returns user data for valid initData', async () => {
    // Re-import to pick up the stubbed env
    vi.resetModules()
    vi.stubEnv('TELEGRAM_BOT_TOKEN', TEST_BOT_TOKEN)
    const { validateInitData } = await import('@/domains/telegram/telegram.service')

    const user = { id: 12345, first_name: 'Max', username: 'maxdev' }
    const initData = buildInitData(TEST_BOT_TOKEN, user)

    const result = validateInitData(initData)
    expect(result).not.toBeNull()
    expect(result!.id).toBe(12345)
    expect(result!.first_name).toBe('Max')
    expect(result!.username).toBe('maxdev')
  })

  it('returns null for tampered hash', async () => {
    vi.resetModules()
    vi.stubEnv('TELEGRAM_BOT_TOKEN', TEST_BOT_TOKEN)
    const { validateInitData } = await import('@/domains/telegram/telegram.service')

    const user = { id: 12345, first_name: 'Max' }
    const initData = buildInitData(TEST_BOT_TOKEN, user)
    const tampered = initData.replace(/hash=[^&]+/, 'hash=deadbeef')

    expect(validateInitData(tampered)).toBeNull()
  })

  it('returns null for expired auth_date (older than 5 minutes)', async () => {
    vi.resetModules()
    vi.stubEnv('TELEGRAM_BOT_TOKEN', TEST_BOT_TOKEN)
    const { validateInitData } = await import('@/domains/telegram/telegram.service')

    const user = { id: 12345, first_name: 'Max' }
    const tenMinAgo = Math.floor(Date.now() / 1000) - 10 * 60
    const initData = buildInitData(TEST_BOT_TOKEN, user, tenMinAgo)

    expect(validateInitData(initData)).toBeNull()
  })

  it('accepts auth_date within the 5-minute window', async () => {
    vi.resetModules()
    vi.stubEnv('TELEGRAM_BOT_TOKEN', TEST_BOT_TOKEN)
    const { validateInitData } = await import('@/domains/telegram/telegram.service')

    const user = { id: 12345, first_name: 'Max' }
    const twoMinAgo = Math.floor(Date.now() / 1000) - 2 * 60
    const initData = buildInitData(TEST_BOT_TOKEN, user, twoMinAgo)

    const result = validateInitData(initData)
    expect(result).not.toBeNull()
    expect(result!.id).toBe(12345)
  })

  it('returns null when BOT_TOKEN is empty', async () => {
    vi.resetModules()
    vi.stubEnv('TELEGRAM_BOT_TOKEN', '')
    const { validateInitData } = await import('@/domains/telegram/telegram.service')

    const user = { id: 12345, first_name: 'Max' }
    const initData = buildInitData(TEST_BOT_TOKEN, user)

    expect(validateInitData(initData)).toBeNull()
  })

  it('returns null when initData is missing hash', async () => {
    vi.resetModules()
    vi.stubEnv('TELEGRAM_BOT_TOKEN', TEST_BOT_TOKEN)
    const { validateInitData } = await import('@/domains/telegram/telegram.service')

    expect(validateInitData('auth_date=123&user={}')).toBeNull()
  })
})
