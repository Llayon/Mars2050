interface TelegramWindow extends Window {
  Telegram?: {
    WebApp?: {
      initData?: string
    }
  }
}

function hasParam(source: string, key: string): boolean {
  try {
    return new URLSearchParams(source).has(key)
  } catch {
    return false
  }
}

export function hasTelegramWebAppSignal(): boolean {
  if (typeof window === 'undefined') return false
  const telegramWindow = window as TelegramWindow
  if (telegramWindow.Telegram?.WebApp) return true
  if (hasParam(window.location.search, 'tgWebAppData')) return true
  return hasParam(window.location.hash.replace(/^#/, ''), 'tgWebAppData')
}
