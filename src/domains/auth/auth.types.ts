import type { User } from '@supabase/supabase-js'

/** Auth state returned by useAuth hook. */
export interface AuthState {
  user: User | null
  colonyId: string | null
  loading: boolean
  error: string | null
}

/** Result from server-side auth operations. */
export interface AuthResult {
  user: Record<string, unknown> | null
  error: string | null
}