import { createClient, SupabaseClient } from '@supabase/supabase-js'

let supabaseInstance: SupabaseClient | null = null

function checkConnectivity(url: string, key: string): void {
  if (typeof window === 'undefined') return
  fetch(`${url.replace(/\/$/, '')}/rest/v1/?apikey=${key}&limit=1`, {
    method: 'HEAD',
  }).then(r => {
    if (!r.ok && r.status === 0) console.warn('Mars2050: Supabase project may be paused — DNS not resolving')
  }).catch(() => {
    console.warn('Mars2050: Cannot reach Supabase — check if project is active at https://supabase.com/dashboard')
  })
}

/** Lazy singleton — safe to import during SSR/build (no crash on missing env vars) */
export function getSupabaseClient(): SupabaseClient {
  if (!supabaseInstance) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !key) {
      console.error('Mars2050: NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY is not set!')
    }
    supabaseInstance = createClient(url || 'https://placeholder.supabase.co', key || 'placeholder', {
      auth: {
        persistSession: true,
        storage: typeof window !== 'undefined' ? window.localStorage : undefined,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    })
    if (url && key) checkConnectivity(url, key)
  }
  return supabaseInstance
}

/**
 * Lazy proxy — defers Supabase client creation until a property is accessed.
 * Prevents crashes during `next build` static prerendering when env vars are empty.
 */
export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    return Reflect.get(getSupabaseClient(), prop, receiver)
  },
})

export function createBrowserClient(): SupabaseClient {
  return getSupabaseClient()
}