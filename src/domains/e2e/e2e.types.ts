export interface E2eSessionUser {
  id: string
  email: string
}

export interface E2eSessionPayload {
  user: E2eSessionUser
  colonyId: string
}

export interface E2eSessionResult {
  data: E2eSessionPayload | null
  error: string | null
}
