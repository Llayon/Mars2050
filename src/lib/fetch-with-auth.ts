interface FetchWithAuthOptions {
  cookieFirst?: boolean
}

function hasAccessTokenCookie(): boolean {
  if (typeof document === 'undefined') return false
  return document.cookie.split(';').some(cookie => cookie.trim().startsWith('supabase-access-token='))
}

function isSameOriginRequest(url: string): boolean {
  if (typeof window === 'undefined') return false
  try {
    return new URL(url, window.location.href).origin === window.location.origin
  } catch {
    return false
  }
}

/**
 * A fetch wrapper that automatically attaches the Supabase access token
 * as an Authorization header. This prevents 401 Unauthorized errors in
 * cross-origin iframe scenarios (like Telegram Web Apps) where SameSite=Lax 
 * cookies might be blocked by the browser.
 */
export async function fetchWithAuth(
  url: string,
  options: RequestInit = {},
  authOptions: FetchWithAuthOptions = {},
): Promise<Response> {
  if (authOptions.cookieFirst && hasAccessTokenCookie() && isSameOriginRequest(url)) {
    return fetch(url, options)
  }

  const { supabase } = await import('@/lib/supabase')
  const { data: { session } } = await supabase.auth.getSession()
  
  const headers = new Headers(options.headers || {})
  if (session?.access_token) {
    headers.set('Authorization', `Bearer ${session.access_token}`)
  }
  
  return fetch(url, { ...options, headers })
}
