import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { E2E_AUTH_COOKIE, E2E_USERNAME, isE2eAuthBypassEnabled } from '@/domains/e2e/e2e.config'
import { getServerClient } from '@/domains/resource/resource.server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!

/**
 * Build a Supabase client that honors the caller's cookies/JWT.
 * This client respects RLS because it is scoped to the user, not the service role.
 * Use it for any read that must reflect the request's authorization.
 */
function getCookie(cookieStr: string, name: string): string | null {
  const matches = cookieStr.match(new RegExp('(?:^|; )' + name.replace(/([\.$?*|{}\(\)\[\]\\\/\+^])/g, '\\$1') + '=([^;]*)'))
  return matches ? decodeURIComponent(matches[1]) : null
}

export function getAuthClient(request: Request): SupabaseClient {
  const cookieStr = request.headers.get('cookie') ?? ''
  
  let token: string | null = null
  const authHeader = request.headers.get('authorization')
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7)
  }
  
  if (!token) {
    token = getCookie(cookieStr, 'supabase-access-token')
  }
  
  const headers: Record<string, string> = {
    cookie: cookieStr
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  return createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers,
      fetch: (...args) => fetch(args[0], { ...args[1], cache: 'no-store' }),
    },
  })
}

export interface AuthContext {
  userId: string
  email: string | null
  client: SupabaseClient
}

/**
 * Resolve the authenticated user from the request's cookies.
 * Returns null when no valid session is present.
 * Never reads userId from request body/query — only from the JWT.
 */
export async function getAuthContext(request: Request): Promise<AuthContext | null> {
  const cookieStr = request.headers.get('cookie') ?? ''
  const e2eUserId = getCookie(cookieStr, E2E_AUTH_COOKIE)
  if (e2eUserId && isE2eAuthBypassEnabled()) {
    const client = getServerClient()
    const { data } = await client
      .from('profiles')
      .select('id')
      .eq('id', e2eUserId)
      .eq('username', E2E_USERNAME)
      .maybeSingle()

    if (data) {
      return {
        userId: e2eUserId,
        email: null,
        client,
      }
    }
    return null
  }

  let token: string | null = null
  const authHeader = request.headers.get('authorization')
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7)
  }
  if (!token) {
    token = getCookie(cookieStr, 'supabase-access-token')
  }

  const client = getAuthClient(request)
  const { data, error } = await (token ? client.auth.getUser(token) : client.auth.getUser())
  
  if (error || !data.user) {
    console.log('[Auth Debug] getUser failed:', error?.message, 'Token exists:', !!token)
    return null
  }
  
  return {
    userId: data.user.id,
    email: data.user.email ?? null,
    client,
  }
}
