'use client'

import { memo } from 'react'

interface AccountPanelProps {
  userEmail?: string
  userId?: string
  colonyId: string | null
  tgUser?: { id: number; first_name: string; username?: string } | null
  isTWA?: boolean
  onLogout: () => void
}

function shortId(value?: string | null): string {
  if (!value) return 'нет'
  if (value.length <= 12) return value
  return `${value.slice(0, 8)}...${value.slice(-4)}`
}

export const AccountPanel = memo(function AccountPanel({
  userEmail,
  userId,
  colonyId,
  tgUser,
  isTWA,
  onLogout,
}: AccountPanelProps) {
  const accountName = tgUser
    ? `${tgUser.first_name}${tgUser.username ? ` (@${tgUser.username})` : ''}`
    : userEmail || 'Неизвестный аккаунт'

  return (
    <section className="rounded-lg border border-gray-800 bg-black/30 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-bold uppercase tracking-widest text-gray-400">Account</h3>
          <p className="mt-2 truncate text-base font-semibold text-white">{accountName}</p>
          <p className="text-xs text-gray-500">{isTWA ? 'Telegram session' : 'Supabase session'}</p>
        </div>
        <button
          onClick={onLogout}
          className="shrink-0 rounded-md border border-red-500/30 bg-red-950/30 px-3 py-1.5 text-xs font-semibold text-red-100 hover:bg-red-900/50"
        >
          Выйти
        </button>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-2 text-xs">
        <div className="rounded-md bg-gray-900/70 px-2 py-1.5">
          <span className="text-gray-500">User ID: </span>
          <span className="font-mono text-cyan-200" title={userId || ''}>{shortId(userId)}</span>
        </div>
        <div className="rounded-md bg-gray-900/70 px-2 py-1.5">
          <span className="text-gray-500">Colony ID: </span>
          <span className="font-mono text-cyan-200" title={colonyId || ''}>{shortId(colonyId)}</span>
        </div>
      </div>

      <p className="mt-3 text-xs leading-relaxed text-gray-500">
        Постройки привязаны к Colony ID. Если после обновления страницы ID другой, открыт другой аккаунт или сессия.
      </p>
    </section>
  )
})
