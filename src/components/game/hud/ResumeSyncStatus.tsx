'use client'

interface ResumeSyncStatusProps {
  visible: boolean
  mobile?: boolean
}

export function ResumeSyncStatus({ visible, mobile = false }: ResumeSyncStatusProps) {
  if (!visible) return null

  return (
    <div
      data-testid="resume-sync-status"
      className={[
        'absolute z-30 rounded border border-cyan-400/30 bg-black/70 px-3 py-1.5 text-xs font-medium text-cyan-100 shadow-lg shadow-cyan-950/30 backdrop-blur',
        mobile ? 'right-3 top-16' : 'right-4 top-20',
      ].join(' ')}
    >
      Синхронизация...
    </div>
  )
}
