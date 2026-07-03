/** Resource type keys matching DB enum values. */
export const RESOURCE_TYPES = [
  'oxygen',
  'water',
  'energy',
  'minerals',
  'food',
  'research_points',
  'consumer_goods',
  'rare_metals',
  'databanks',
  'nanomaterials',
] as const

export type ResourceTypeKey = typeof RESOURCE_TYPES[number]

/** Resource display names (Russian). */
export const RESOURCE_NAMES: Record<string, string> = {
  oxygen: 'Кислород', water: 'Вода', energy: 'Энергия',
  minerals: 'Минералы', food: 'Еда', research_points: 'Исследования',
  consumer_goods: 'Товары', rare_metals: 'Редкие металлы',
  databanks: 'Датабанки', nanomaterials: 'Наноматериалы'
}

export function isResourceTypeKey(type: string): type is ResourceTypeKey {
  return (RESOURCE_TYPES as readonly string[]).includes(type)
}

/** DB row for resources table. */
export interface ResourceRow {
  id: string
  colony_id: string
  type: ResourceTypeKey
  amount: number
  capacity: number
  production_rate: number
  consumption_rate: number
  updated_at: string
}

/** Resource with display metadata. */
export interface ResourceDisplay {
  type: ResourceTypeKey
  amount: number
  capacity: number
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
