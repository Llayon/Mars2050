export const E2E_AUTH_COOKIE = 'mars2050-e2e-user-id'
export const E2E_USERNAME = 'mars2050_e2e_smoke'
export const E2E_USER_EMAIL = 'mars2050_e2e_smoke@mars2050.local'
export const E2E_USER_PASSWORD = 'mars2050-e2e-local-password'
export const E2E_COLONY_NAME = 'Mars2050 E2E Smoke Colony'

export function isE2eAuthBypassEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NODE_ENV !== 'production' && env.E2E_AUTH_BYPASS === '1'
}

export function isPublicE2eAuthBypassEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NODE_ENV !== 'production' && env.NEXT_PUBLIC_E2E_AUTH_BYPASS === '1'
}
