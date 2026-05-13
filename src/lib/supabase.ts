import { createClient, SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

let supabaseInstance: SupabaseClient<any> | null = null

export function getSupabaseClient(): SupabaseClient<any> {
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

export function createBrowserClient(): SupabaseClient<any> {
  return getSupabaseClient()
}