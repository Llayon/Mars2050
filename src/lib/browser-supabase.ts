export async function getBrowserSupabase() {
  const { supabase } = await import('@/lib/supabase')
  return supabase
}

export type BrowserSupabase = Awaited<ReturnType<typeof getBrowserSupabase>>
