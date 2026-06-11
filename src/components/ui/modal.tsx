'use client'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
}

export function Modal({ open, onClose, title, children }: ModalProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-gray-800 rounded-xl shadow-2xl max-w-md w-full mx-4 p-6 text-white">
        {title && (
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">{title}</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl leading-none" aria-label="Закрыть">&times;</button>
          </div>
        )}
        {children}
      </div>
    </div>
  )
}

interface ConfirmModalProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmText?: string
  danger?: boolean
}

export function ConfirmModal({ open, onClose, onConfirm, title, message, confirmText = 'Подтвердить', danger = false }: ConfirmModalProps) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <p className="text-gray-300 mb-6">{message}</p>
      <div className="flex gap-3 justify-end">
        <button onClick={onClose} className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-sm">
          Отмена
        </button>
        <button
          onClick={() => { onConfirm(); onClose() }}
          className={`px-4 py-2 rounded-lg text-sm ${danger ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}
        >
          {confirmText}
        </button>
      </div>
    </Modal>
  )
}