export const SPRITE_PATHS: Record<string, string> = {
  'marine': '/sprites/marine/rotations',
  'rocketeer': '/sprites/rocketeer',
  'exosuit': '/sprites/exosuit',
  'sniper': '/sprites/sniper',
  'medic': '/sprites/medic',
  'turret': '/sprites/turret',
  'alien_bug': '/sprites/alien_bug',
  'alien_spitter': '/sprites/alien_spitter'
};

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
