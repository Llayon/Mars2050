import { createClient, SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!

/**
 * Build a Supabase client that honors the caller's cookies/JWT.
 * This client respects RLS because it is scoped to the user, not the service role.
 * Use it for any read that must reflect the request's authorization.
 */
export function getAuthClient(request: Request): SupabaseClient {
  return createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: { cookie: request.headers.get('cookie') ?? '' },
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
  const client = getAuthClient(request)
  const { data, error } = await client.auth.getUser()
  if (error || !data.user) return null
  return {
    userId: data.user.id,
    email: data.user.email ?? null,
    client,
  }
}
