import type { MapLocationType } from '@/domains/map/map.types'

/** Tailwind CSS badge background classes for map location types. */
export const LOCATION_COLORS: Record<MapLocationType, string> = {
  plains: 'bg-green-600',
  mountains: 'bg-gray-600',
  canyon: 'bg-red-800',
  crater: 'bg-yellow-800',
  ice_cap: 'bg-blue-300'
}
