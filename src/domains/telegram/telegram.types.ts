export interface TelegramUserData {
  id: number
  first_name: string
  last_name?: string
  username?: string
  language_code?: string
  photo_url?: string
}

export interface TelegramAuthResponse {
  colonyId: string
  error?: string
}

export interface TelegramInitData {
  query_id?: string
  user?: TelegramUserData
  auth_date: number
  hash: string
}
