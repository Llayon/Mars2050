export const SPRITE_PATHS: Record<string, string> = {
  'marine': '/sprites/marine/rotations',
  'rocketeer': '/sprites/rocketeer',
  'exosuit': '/sprites/exosuit',
  'sniper': '/sprites/sniper',
  'medic': '/assets/units/medic-v2',
  'turret': '/sprites/turret',
  'alien_bug': '/sprites/alien_bug',
  'alien_spitter': '/sprites/alien_spitter'
};

export const SPRITE_ATLASES: Record<string, string> = {
  'flamethrower': '/sprites/units/flamethrower.json'
};

export const SVG_UNITS = [
  'plasma_tank', 'missile_buggy', 'gunship', 'engineer', 'emp_drone', 'minelayer_rover', 'siege_tank',
  'railgun_walker', 'drone_carrier', 'cryo_tank', 'shield_emitter', 'interceptor', 'hacker_rover',
  'artillery_crawler', 'titan_mech', 'behemoth_tank', 'ion_crawler', 'goliath_gunship', 'mobile_factory',
  'sonic_devastator', 'radar_zepplin', 'stealth_operative', 'hologram_projector', 'gravity_manipulator',
  'nanite_generator', 'bounty_hunter'
];

export const SPRITE_DIRS = ['north', 'south', 'east', 'west', 'north-east', 'north-west', 'south-east', 'south-west'];


export const FIELD_WIDTH = 600;
export const FIELD_HEIGHT = 1200;
export const TILE_SIZE = 40; // 1 unit of old grid

/**
 * Calculates Euclidean distance between two points
 * @param x1 X coordinate of first point
 * @param y1 Y coordinate of first point
 * @param x2 X coordinate of second point
 * @param y2 Y coordinate of second point
 * @returns Distance between points
 */
export function getDistance(x1: number, y1: number, x2: number, y2: number): number {
    return Math.hypot(x2 - x1, y2 - y1);
}

import type { Obstacle } from './combat.sim.types';

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

/**
 * Returns 8-directional string based on delta X and Y
 */
export function getDir(dx: number, dy: number): string {
  if (Math.abs(dx) < 0.1 && Math.abs(dy) < 0.1) return 'south'
  const a = Math.atan2(dy, dx) * 180 / Math.PI
  if (a >= -22.5 && a < 22.5) return 'east'
  if (a >= 22.5 && a < 67.5) return 'south-east'
  if (a >= 67.5 && a < 112.5) return 'south'
  if (a >= 112.5 && a < 157.5) return 'south-west'
  if (a >= 157.5 || a < -157.5) return 'west'
  if (a >= -157.5 && a < -112.5) return 'north-west'
  if (a >= -112.5 && a < -67.5) return 'north'
  return 'north-east'
}

// Deterministic RNG (Linear Congruential Generator)
export class PRNG {
  private seed: number;
  constructor(seed: number) { this.seed = seed; }
  next(): number {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }
}

/**
 * Gets physical collision radius based on unit size category
 * @param size Unit size category (S, M, L, XL)
 * @returns Collision radius in pixels
 */
export function getSizeRadius(size: 'S' | 'M' | 'L' | 'XL'): number {
  switch (size) {
    case 'S': return 10;
    case 'M': return 18;
    case 'L': return 28;
    case 'XL': return 45;
    default: return 18;
  }
}

/**
 * Gets physical mass based on unit size category for collision pushing
 * @param size Unit size category
 * @returns Mass value
 */
export function getSizeMass(size: 'S' | 'M' | 'L' | 'XL'): number {
  switch (size) {
    case 'S': return 10;
    case 'M': return 50;
    case 'L': return 250;
    case 'XL': return 1000;
    default: return 50;
  }
}
