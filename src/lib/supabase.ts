import { createClient, SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

if (typeof window !== 'undefined') {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.error('Mars2050: NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY is not set in environment!')
  } else {
    fetch(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/`, {
      method: 'HEAD',
      headers: { apikey: supabaseAnonKey }
    }).then(r => {
      if (!r.ok && r.status === 0) console.warn('Mars2050: Supabase project may be paused — DNS not resolving')
    }).catch(() => {
      console.warn('Mars2050: Cannot reach Supabase — check if project is active at https://supabase.com/dashboard')
    })
  }
}

let supabaseInstance: SupabaseClient | null = null

export function getSupabaseClient(): SupabaseClient {
  if (!supabaseInstance) {
    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        storage: typeof window !== 'undefined' ? window.localStorage : undefined,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    })
  }
  return supabaseInstance
}

export const supabase = getSupabaseClient()

export function createBrowserClient(): SupabaseClient {
  return getSupabaseClient()
}