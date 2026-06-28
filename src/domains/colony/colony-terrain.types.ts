/**
 * Types of terrain available on the colony map.
 */
export type TerrainType =
  | 'regolith'      // Base terrain
  | 'iron_deposit'  // Boosts mining
  | 'ice_pocket'    // Boosts water extraction
  | 'geothermal'    // Late-game energy source
  | 'blocked_rock'; // Obstacle

/**
 * Represents a single cell in the 40x40 terrain grid.
 */
export interface TerrainCell {
  x: number;
  y: number;
  t: TerrainType;
}

/**
 * The entire 40x40 terrain grid.
 */
export type TerrainGrid = TerrainCell[];
