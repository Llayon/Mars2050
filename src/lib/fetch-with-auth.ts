import { supabase } from '@/lib/supabase'

/**
 * A fetch wrapper that automatically attaches the Supabase access token
 * as an Authorization header. This prevents 401 Unauthorized errors in
 * cross-origin iframe scenarios (like Telegram Web Apps) where SameSite=Lax 
 * cookies might be blocked by the browser.
 */
export async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  const { data: { session } } = await supabase.auth.getSession()
  
  const headers = new Headers(options.headers || {})
  if (session?.access_token) {
    headers.set('Authorization', `Bearer ${session.access_token}`)
  }
  
  return fetch(url, { ...options, headers })
}
