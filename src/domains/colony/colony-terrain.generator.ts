import { TerrainCell, TerrainGrid, TerrainType } from './colony-terrain.types';
import { COLONY_GRID_SIZE, START_ZONE_MIN, START_ZONE_MAX } from './colony-terrain.config';

/**
 * Simple seeded random generator (Mulberry32).
 * Returns a float between 0 and 1.
 */
function seededRandom(a: number) {
  return function() {
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/**
 * Converts a UUID string into a numeric seed.
 */
function uuidToSeed(uuid: string): number {
  let hash = 0;
  for (let i = 0; i < uuid.length; i++) {
    const char = uuid.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash;
}

/**
 * Generates a deterministic 40x40 terrain grid based on a seed (usually colonyId).
 */
export function generateColonyTerrain(seedString: string): TerrainGrid {
  const seed = uuidToSeed(seedString);
  const random = seededRandom(seed);
  
  const grid: TerrainGrid = [];
  
  // Guarantee resources in the starting zone (10x10)
  const startZoneResources: { x: number, y: number, t: TerrainType }[] = [];
  
  // Place 2 iron deposits and 2 ice pockets randomly in the start zone
  for (let i = 0; i < 2; i++) {
    startZoneResources.push({
      x: START_ZONE_MIN + Math.floor(random() * 10),
      y: START_ZONE_MIN + Math.floor(random() * 10),
      t: 'iron_deposit'
    });
    startZoneResources.push({
      x: START_ZONE_MIN + Math.floor(random() * 10),
      y: START_ZONE_MIN + Math.floor(random() * 10),
      t: 'ice_pocket'
    });
  }

  for (let x = 0; x < COLONY_GRID_SIZE; x++) {
    for (let y = 0; y < COLONY_GRID_SIZE; y++) {
      // Check if this cell is a pre-placed start zone resource
      const prePlaced = startZoneResources.find(res => res.x === x && res.y === y);
      if (prePlaced) {
        grid.push({ x, y, t: prePlaced.t });
        continue;
      }

      // Determine Chebyshev distance from center for zoning
      const distX = Math.abs(x - 19.5);
      const distY = Math.abs(y - 19.5);
      const maxDist = Math.max(distX, distY);
      
      let type: TerrainType = 'regolith';
      const r = random();

      if (maxDist <= 4.5) {
        // Soft Start Zone (10x10) - No blocked rocks
        if (r < 0.05) type = 'iron_deposit';
        else if (r < 0.1) type = 'ice_pocket';
      } else if (maxDist <= 9.5) {
        // Mid Zone (20x20) - Introduce rocks
        if (r < 0.15) type = 'blocked_rock';
        else if (r < 0.20) type = 'iron_deposit';
        else if (r < 0.25) type = 'ice_pocket';
      } else {
        // Deep Periphery (up to 40x40) - Heavy rocks, rare geothermal
        if (r < 0.3) type = 'blocked_rock';
        else if (r < 0.35) type = 'geothermal';
        else if (r < 0.40) type = 'iron_deposit';
      }

      grid.push({ x, y, t: type });
    }
  }

  return grid;
}
