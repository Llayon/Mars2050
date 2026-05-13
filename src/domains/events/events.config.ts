import type { EventType, EventEffect } from './events.types'

// Все события и их базовые эффекты
export const EVENT_CONFIG: Record<EventType, {
  name: string
  description: string
  effect: EventEffect
  default_duration_minutes?: number // undefined = мгновенное
  cooldown_hours: number // Минимальный интервал между событиями этого типа
}> = {
  dust_storm: {
    name: 'Пылевая буря',
    description: 'Солнечные панели работают на 30% эффективности',
    effect: {
      production_modifier: { energy: -0.7 }, // -70% energy production
    },
    default_duration_minutes: 60, // 1 час
    cooldown_hours: 4,
  },

  meteor_shower: {
    name: 'Метеоритный дождь',
    description: 'Повреждено 20% зданий случайного типа',
    effect: {
      building_damage: { damage_percent: 20 },
    },
    default_duration_minutes: 30,
    cooldown_hours: 8,
  },

  anomaly_discovered: {
    name: 'Аномалия обнаружена',
    description: 'Находка дает +50 research_points',
    effect: {
      research_bonus: 50,
    },
    cooldown_hours: 2,
  },

  resource_vein: {
    name: 'Жила ресурсов',
    description: 'Бонус +30% к добыче minerals на 2 часа',
    effect: {
      production_modifier: { minerals: 0.3 },
    },
    default_duration_minutes: 120,
    cooldown_hours: 6,
  },

  cold_wave: {
    name: 'Холодная волна',
    description: 'Потребление energy увеличено на 40%',
    effect: {
      production_modifier: { energy: -0.4 }, // -40% (больше потребление)
    },
    default_duration_minutes: 90,
    cooldown_hours: 5,
  },

  solar_flare: {
    name: 'Солнечная вспышка',
    description: 'Все электронные здания отключены на 15 минут',
    effect: {
      production_modifier: { energy: -1.0 }, // -100% energy
    },
    default_duration_minutes: 15,
    cooldown_hours: 12,
  },
}
