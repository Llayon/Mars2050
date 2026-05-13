import type { MapLocationType } from './map.types'

/** Exploration cost by difficulty level (1-5). */
export const EXPLORATION_COST: Record<number, Record<string, number>> = {
  1: { energy: 5 },
  2: { energy: 15 },
  3: { energy: 30 },
  4: { energy: 50 },
  5: { energy: 80 }
}

/** Base resource reward from exploration (scaled by location resources / 100). */
export const EXPLORATION_BASE_REWARD = 50

/** Tailwind CSS classes for location types. */
export const LOCATION_COLORS: Record<MapLocationType, string> = {
  plains: 'bg-green-600',
  mountains: 'bg-gray-600',
  canyon: 'bg-red-800',
  crater: 'bg-yellow-800',
  ice_cap: 'bg-blue-300'
}

/** Russian labels for location types. */
export const LOCATION_LABELS: Record<MapLocationType, string> = {
  plains: 'Равнины',
  mountains: 'Горы',
  canyon: 'Каньон',
  crater: 'Кратер',
  ice_cap: 'Ледник'
}