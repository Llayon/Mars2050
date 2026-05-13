export interface Colony {
  id: string
  name: string
  level: number
  experience: number
  user_id: string
  last_calc_at: string
  created_at: string
}

export interface ColonyInitResult {
  success: boolean
  error?: string
  count?: number
}