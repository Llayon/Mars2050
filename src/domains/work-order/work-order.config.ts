import type { WorkOrderConfig, WorkOrderType } from './work-order.types'

export const WORK_ORDER_TYPES: Record<WorkOrderType, WorkOrderConfig> = {
  clear_rubble: {
    name: 'Расчистка завалов',
    description: 'Бригада рабочих освобождает площадку и возвращает часть материалов.',
    assignedTier: 'worker',
    assignedSlots: 2,
    durationMinutes: 20,
    cost: { energy: 10 },
    reward: { minerals: 80 },
  },
  repair_grid: {
    name: 'Ремонт энергосети',
    description: 'Техники стабилизируют инфраструктуру и возвращают энергию в сеть.',
    assignedTier: 'technician',
    assignedSlots: 1,
    durationMinutes: 30,
    cost: { minerals: 40 },
    reward: { energy: 120 },
  },
  survey_anomaly: {
    name: 'Изучение аномалии',
    description: 'Ученые исследуют аномалию и получают данные для будущих проектов.',
    assignedTier: 'scientist',
    assignedSlots: 1,
    durationMinutes: 45,
    cost: { energy: 30 },
    reward: { research_points: 150, databanks: 8 },
  },
  trade_manifest: {
    name: 'Торговый манифест',
    description: 'Директора проводят сделку и привозят редкие промышленные ресурсы.',
    assignedTier: 'director',
    assignedSlots: 1,
    durationMinutes: 60,
    cost: { research_points: 50 },
    reward: { consumer_goods: 80, rare_metals: 20 },
  },
}
