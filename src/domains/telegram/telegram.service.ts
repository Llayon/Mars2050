import { createHmac } from 'crypto'
import { getServerClient } from '@/domains/resource/resource.server'
import { getOrCreateColony } from '@/domains/auth/auth.service'
import type { TelegramAuthResponse, TelegramUserData } from './telegram.types'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || ''

/** Max age of Telegram auth_date before we reject it (5 minutes) */
const AUTH_DATE_MAX_AGE_SEC = 5 * 60

/**
 * Validates Telegram WebApp initData HMAC-SHA256 signature and auth_date freshness.
 * @param initData - Raw initData string from Telegram.WebApp.initData
 * @returns Parsed user data if valid, null if invalid or expired
 */
export function validateInitData(initData: string): TelegramUserData | null {
  if (!BOT_TOKEN) return null

  const params = new URLSearchParams(initData)
  const hash = params.get('hash')
  if (!hash) return null

  // Check auth_date freshness (replay attack prevention)
  const authDateRaw = params.get('auth_date')
  if (authDateRaw) {
    const authDate = Number(authDateRaw)
    const nowSec = Math.floor(Date.now() / 1000)
    if (nowSec - authDate > AUTH_DATE_MAX_AGE_SEC) return null
  }

  params.delete('hash')
  const sorted = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n')

  const secretKey = createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest()
  const computedHash = createHmac('sha256', secretKey).update(sorted).digest('hex')

  if (computedHash !== hash) return null

  const userRaw = params.get('user')
  if (!userRaw) return null

  try {
    return JSON.parse(userRaw) as TelegramUserData
  } catch {
    return null
  }
}

/**
 * Generates a deterministic Supabase Auth email/password pair for a Telegram user.
 * Password is derived from telegram_id + BOT_TOKEN (secret).
 */
export function tgCredentials(tgId: number): { email: string; password: string } {
  const email = `tg_${tgId}@mars2050.game`
  const hmac = createHmac('sha256', BOT_TOKEN)
  hmac.update(String(tgId))
  const password = 'tg_' + hmac.digest('hex').substring(0, 24)
  return { email, password }
}

/**
 * Handles Telegram WebApp authentication:
 * 1. Validates initData signature and auth_date
 * 2. Finds or creates Supabase user (via profiles.telegram_id lookup)
 * 3. Returns colonyId + credentials so client can establish a session
 */
export async function handleTelegramAuth(initData: string): Promise<TelegramAuthResponse> {
  const supabase = getServerClient()
  const tgUser = validateInitData(initData)
  if (!tgUser) return { colonyId: '', error: 'Invalid or expired Telegram authentication' }

  const { email, password } = tgCredentials(tgUser.id)

  // O(1) lookup by telegram_id instead of scanning all auth.users
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('telegram_id', tgUser.id)
    .maybeSingle()

  if (profile) {
    const userId = (profile as Record<string, unknown>).id as string
    const colony = await getOrCreateColony(userId)
    if (colony.error) return { colonyId: '', error: colony.error }
    return { colonyId: colony.colonyId || '', email, password }
  }

  // New user — create via admin API
  const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      telegram_id: tgUser.id,
      telegram_name: tgUser.first_name,
      telegram_username: tgUser.username,
    },
  })

  if (createError || !newUser?.user) {
    return { colonyId: '', error: createError?.message || 'Failed to create user' }
  }

  // Store profile with telegram_id for future O(1) lookups
  const { error: profileError } = await supabase.from('profiles').insert({
    id: newUser.user.id,
    username: tgUser.username || `tg_${tgUser.id}`,
    avatar_url: tgUser.photo_url,
    telegram_id: tgUser.id,
  })

  if (profileError) {
    return { colonyId: '', error: profileError.message }
  }

  const colony = await getOrCreateColony(newUser.user.id)
  if (colony.error) return { colonyId: '', error: colony.error }

  return { colonyId: colony.colonyId || '', email, password }
}
