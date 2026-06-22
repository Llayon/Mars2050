export const FIELD_WIDTH = 600;
export const FIELD_HEIGHT = 1200;
export const TILE_SIZE = 40; // 1 unit of old grid

export function getDistance(x1: number, y1: number, x2: number, y2: number): number {
  return Math.hypot(x2 - x1, y2 - y1);
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
