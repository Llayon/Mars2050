import { createHmac } from 'crypto'
import { getServerClient } from '@/domains/resource/resource.server'
import { getOrCreateColony } from '@/domains/auth/auth.service'
import type { TelegramAuthResponse, TelegramUserData } from './telegram.types'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || ''

/**
 * Validates Telegram WebApp initData HMAC-SHA256 signature.
 * @param initData - Raw initData string from Telegram.WebApp.initData
 * @returns Parsed user data if valid, null if invalid
 */
export function validateInitData(initData: string): TelegramUserData | null {
  if (!BOT_TOKEN) return null

  const params = new URLSearchParams(initData)
  const hash = params.get('hash')
  if (!hash) return null

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
 * Password is derived from telegram_id + service_role_key (secret).
 */
function tgCredentials(tgId: number): { email: string; password: string } {
  const email = `tg_${tgId}@mars2050.game`
  const hmac = createHmac('sha256', BOT_TOKEN)
  hmac.update(String(tgId))
  const password = 'tg_' + hmac.digest('hex').substring(0, 24)
  return { email, password }
}

/**
 * Handles Telegram WebApp authentication:
 * 1. Validates initData signature
 * 2. Finds or creates Supabase user
 * 3. Returns colonyId
 */
export async function handleTelegramAuth(initData: string): Promise<TelegramAuthResponse> {
  const supabase = getServerClient()
  const tgUser = validateInitData(initData)
  if (!tgUser) return { colonyId: '', error: 'Invalid Telegram authentication' }

  const { email, password } = tgCredentials(tgUser.id)

  const { data: existingUsers } = await supabase.auth.admin.listUsers()
  const existing = existingUsers?.users.find(u => u.email === email)

  if (existing) {
    const colony = await getOrCreateColony(existing.id)
    if (colony.error) return { colonyId: '', error: colony.error }
    return { colonyId: colony.colonyId || '' }
  }

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

  const { error: profileError } = await supabase.from('profiles').insert({
    id: newUser.user.id,
    username: tgUser.username || `tg_${tgUser.id}`,
    avatar_url: tgUser.photo_url,
  })

  if (profileError) {
    return { colonyId: '', error: profileError.message }
  }

  const colony = await getOrCreateColony(newUser.user.id)
  if (colony.error) return { colonyId: '', error: colony.error }

  return { colonyId: colony.colonyId || '' }
}

/**
 * Returns the stored Telegram credentials for a user to sign in via Supabase Auth.
 */
export function getTelegramCredentials(tgId: number): { email: string; password: string } {
  return tgCredentials(tgId)
}
