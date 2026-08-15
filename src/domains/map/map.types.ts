/** Map location type keys. */
export type MapLocationType = 'plains' | 'mountains' | 'canyon' | 'crater' | 'ice_cap'

/** Axial hexagonal coordinate (pointy-top). */
export interface HexCoord {
  q: number
  r: number
}

/** Difficulty level 1-5. */
export type Difficulty = 1 | 2 | 3 | 4 | 5

/** DB row for map_locations table. */
export interface MapLocation {
  id: string
  name: string
  type: MapLocationType
  x: number
  y: number
  difficulty: Difficulty
  resources: Record<string, number>
  is_discovered: boolean
  discovered_by?: string | null
  created_at: string
}

/** DTO for discovering a location. */
export interface DiscoverLocationDTO {
  locationId: string
  colonyId: string
}