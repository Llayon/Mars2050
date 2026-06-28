import { describe, it, expect } from 'vitest';
import { generateColonyTerrain } from '../src/domains/colony/colony-terrain.generator';
import { COLONY_GRID_SIZE, START_ZONE_MIN, START_ZONE_MAX } from '../src/domains/colony/colony-terrain.config';

describe('Terrain Generator', () => {
  it('should generate a grid of exactly 40x40 (1600 cells)', () => {
    const grid = generateColonyTerrain('test-uuid-1');
    expect(grid.length).toBe(COLONY_GRID_SIZE * COLONY_GRID_SIZE);
  });

  it('should be deterministic based on the seed', () => {
    const grid1 = generateColonyTerrain('test-colony-id-alpha');
    const grid2 = generateColonyTerrain('test-colony-id-alpha');
    const grid3 = generateColonyTerrain('test-colony-id-beta');

    // Same seed yields same grid
    expect(grid1).toEqual(grid2);
    // Different seed yields different grid
    expect(grid1).not.toEqual(grid3);
  });

  it('should not contain blocked_rock in the start zone', () => {
    const grid = generateColonyTerrain('test-safe-start');
    
    const startZoneCells = grid.filter(
      c => c.x >= START_ZONE_MIN && c.x <= START_ZONE_MAX && 
           c.y >= START_ZONE_MIN && c.y <= START_ZONE_MAX
    );

    // Ensure we checked exactly 10x10 = 100 cells
    expect(startZoneCells.length).toBe(100);

    const hasBlockedRock = startZoneCells.some(c => c.t === 'blocked_rock');
    expect(hasBlockedRock).toBe(false);
  });

  it('should guarantee iron_deposit and ice_pocket in the start zone', () => {
    const grid = generateColonyTerrain('test-guaranteed-resources');
    
    const startZoneCells = grid.filter(
      c => c.x >= START_ZONE_MIN && c.x <= START_ZONE_MAX && 
           c.y >= START_ZONE_MIN && c.y <= START_ZONE_MAX
    );

    const hasIron = startZoneCells.some(c => c.t === 'iron_deposit');
    const hasIce = startZoneCells.some(c => c.t === 'ice_pocket');

    expect(hasIron).toBe(true);
    expect(hasIce).toBe(true);
  });
});
