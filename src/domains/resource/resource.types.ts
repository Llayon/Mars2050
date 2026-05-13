/** Resource type keys matching DB enum values. */
export type ResourceTypeKey =
  | 'oxygen'
  | 'water'
  | 'energy'
  | 'minerals'
  | 'food'
  | 'research_points'

/** Resource icons for UI display. */
export const RESOURCE_ICONS: Record<string, string> = {
  oxygen: '🫁', water: '💧', energy: '⚡',
  minerals: '⛏️', food: '🌾', research_points: '🔬'
}

/** Resource display names (Russian). */
export const RESOURCE_NAMES: Record<string, string> = {
  oxygen: 'Кислород', water: 'Вода', energy: 'Энергия',
  minerals: 'Минералы', food: 'Еда', research_points: 'Исследования'
}

/** DB row for resources table. */
export interface ResourceRow {
  id: string
  colony_id: string
  type: ResourceTypeKey
  amount: number
  production_rate: number
  consumption_rate: number
  updated_at: string
}

/** Resource with display metadata. */
export interface ResourceDisplay {
  type: ResourceTypeKey
  amount: number
  production_rate: number
  consumption_rate: number
  icon: string
  name: string
}

/** API response for resource operations. */
export interface ResourceResponse {
  resources: ResourceRow[]
  error: string | null
  status: number
}