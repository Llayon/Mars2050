import { memo, useState } from 'react'
import type { BuildingRow } from '@/domains/building/building.types'
import { ConfirmModal, Modal } from '@/components/ui/modal'

interface BuildingActionModalProps {
  building: BuildingRow | null
  onClose: () => void
  onDemolish: (id: string) => Promise<void>
}

export const BuildingActionModal = memo(function BuildingActionModal({ building, onClose, onDemolish }: BuildingActionModalProps) {
  const [confirmDemolish, setConfirmDemolish] = useState(false)

  if (!building) return null

  const handleDemolish = async () => {
    await onDemolish(building.id)
    setConfirmDemolish(false)
    onClose()
  }

  // Base Modal Overlay
  return (
    <>
      <Modal open={true} onClose={onClose}>
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 text-gray-400 hover:text-white"
          aria-label="Закрыть"
        >
          ✕
        </button>
        
        <h2 className="text-2xl font-bold text-white mb-1">{building.name}</h2>
        <p className="text-gray-400 text-sm mb-6">Уровень {building.level} • {building.is_active ? 'Активно' : 'Неактивно'}</p>
        
        <div className="space-y-3">
          <button 
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded font-medium disabled:opacity-50"
            disabled // Upgrade not implemented yet
          >
            Улучшить (Скоро)
          </button>
          
          <button 
            onClick={() => setConfirmDemolish(true)}
            className="w-full bg-red-600 hover:bg-red-700 text-white py-2 rounded font-medium"
          >
            Снести
          </button>
        </div>
      </Modal>

      <ConfirmModal
        open={confirmDemolish}
        onClose={() => setConfirmDemolish(false)}
        onConfirm={handleDemolish}
        title="Снос здания"
        message={`Вы уверены, что хотите снести «${building.name}»? Производство будет отменено.`}
        confirmText="Снести"
        danger
      />
    </>
  )
})
