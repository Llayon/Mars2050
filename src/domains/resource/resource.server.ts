import { createClient, SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export function getServerClient(): SupabaseClient {
  return createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (...args) => fetch(args[0], { ...args[1], cache: 'no-store' })
    }
  })
}

export async function checkSupabaseConnection(): Promise<string | true> {
  try {
    const supabase = getServerClient()
    const { error } = await supabase.from('colonies').select('id', { count: 'exact', head: true }).limit(0)
    return !error ? true : error.message
  } catch (err) {
    return String(err)
  }
}