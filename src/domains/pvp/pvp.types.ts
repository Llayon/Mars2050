export interface AttackResult {
  success: boolean
  error?: string
  message?: string
  stolen?: Record<string, number>
}

export interface TradeResult {
  success: boolean
  error?: string
  message?: string
}