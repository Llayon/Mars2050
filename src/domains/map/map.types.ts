/** Map location type keys. */
export type MapLocationType = 'plains' | 'mountains' | 'canyon' | 'crater' | 'ice_cap'

/** Rectangular grid coordinate. */
export interface GridCoord {
  x: number
  y: number
}

/** Rectangular grid dimensions. */
export interface GridSize {
  width: number
  height: number
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

/** Location payload generated deterministically by procedural generator (before persistence). */
export type GeneratedMapLocation = Omit<MapLocation, 'id' | 'created_at'>

/** DTO for discovering a location. */
export interface DiscoverLocationDTO {
  locationId: string
  colonyId: string
}