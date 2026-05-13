export type EventType =
  | 'dust_storm'        // Пылевая буря — отключает солнечные панели
  | 'meteor_shower'     // Метеоритный дождь — повреждает здания
  | 'anomaly_discovered' // Аномалия — находка (технологии/ресурсы)
  | 'resource_vein'      // Жила ресурсов — бонус к добыче
  | 'cold_wave'          // Холодная волна — увеличивает потребление energy
  | 'solar_flare'        // Солнечная вспышка — сбой электроники

export interface GameEvent {
  id: string
  colony_id: string
  type: EventType
  name: string
  description: string
  effect: EventEffect
  duration_minutes?: number // Длительность (null = мгновенное)
  is_active: boolean
  created_at: string
  ends_at?: string
}

export interface EventEffect {
  // Бонусы/штрафы к производству
  production_modifier?: Record<string, number> // { "energy": -0.5 } = -50% energy
  // Повреждение зданий
  building_damage?: {
    type?: string // конкретный тип здания или undefined для всех
    damage_percent: number
  }
  // Находка ресурсов
  resource_bonus?: Record<string, number>
  // Находка технологий
  research_bonus?: number
}

export interface CreateEventDTO {
  colony_id: string
  type: EventType
  duration_minutes?: number
}
