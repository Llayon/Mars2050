export const FIELD_WIDTH = 600;
export const FIELD_HEIGHT = 1200;
export const TILE_SIZE = 40; // 1 unit of old grid

export { PRNG, getDistance, getDir, getSizeRadius, getSizeMass } from './math/index.js';

import type { Obstacle } from './combat.sim.types.js';
import { PRNG, getDistance } from './math/index.js';

/**
 * Generates random obstacles for the battlefield
 * @param seed The random seed
 * @returns Array of obstacles
 */
export function generateObstacles(seed: number): Obstacle[] {
  const rng = new PRNG(seed)
  const obstacles: Obstacle[] = [];
  const numObstacles = 4 + Math.floor(rng.next() * 4);
  let attempts = 0;
  
  while (obstacles.length < numObstacles && attempts < 50) {
     attempts++;
     const ox = 50 + rng.next() * (FIELD_WIDTH - 100);
     const oy = 250 + rng.next() * (FIELD_HEIGHT - 600);
     const oradius = 15 + rng.next() * 25; // Radius 15-40
     
     let overlaps = false;
     for (const existing of obstacles) {
       const dist = getDistance(ox, oy, existing.x, existing.y);
       if (dist < oradius + existing.radius + 20) {
         overlaps = true;
         break;
       }
     }
     
     if (!overlaps) {
       obstacles.push({ x: ox, y: oy, radius: oradius });
     }
  }
  return obstacles;
}
