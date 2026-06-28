import { describe, it, expect } from 'vitest';
import { validateBuildingPlacement } from '../src/domains/building/building-placement';
import { TerrainCell } from '../src/domains/colony/colony-terrain.types';

describe('Building Placement Validation', () => {
  const mockTerrain: TerrainCell[] = [
    { x: 19, y: 19, t: 'regolith' },
    { x: 20, y: 19, t: 'regolith' },
    { x: 19, y: 20, t: 'blocked_rock' },
    { x: 20, y: 20, t: 'regolith' },
  ];

  const baseInput = {
    x: 19,
    y: 19,
    width: 1,
    height: 1,
    unlockedRadius: 5,
    terrainGrid: mockTerrain,
    occupiedCells: []
  };

  it('should allow valid placement', () => {
    const result = validateBuildingPlacement(baseInput);
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('should reject placement out of bounds (negative)', () => {
    const result = validateBuildingPlacement({ ...baseInput, x: -1 });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Координаты вне пределов');
  });

  it('should reject placement out of bounds (exceeding 40x40)', () => {
    const result = validateBuildingPlacement({ ...baseInput, x: 39, width: 2 });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Координаты вне пределов');
  });

  it('should reject placement outside unlocked radius', () => {
    // Center is 19.5, radius 5 means 15 to 24 is valid. 
    // 25 should be rejected.
    const result = validateBuildingPlacement({ ...baseInput, x: 25 });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Эта территория еще не расчищена');
  });

  it('should reject placement on blocked_rock', () => {
    const result = validateBuildingPlacement({ ...baseInput, x: 19, y: 20 });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Нельзя строить на скалах');
  });

  it('should reject placement if multi-tile building touches blocked_rock', () => {
    // Placing 2x2 at 19,19 covers 19,19 to 20,20. Cell 19,20 is rock.
    const result = validateBuildingPlacement({ ...baseInput, x: 19, y: 19, width: 2, height: 2 });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Нельзя строить на скалах');
  });

  it('should reject placement on occupied cells (1x1)', () => {
    const result = validateBuildingPlacement({
      ...baseInput,
      occupiedCells: [{ x: 19, y: 19, width: 1, height: 1 }]
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('занята другим зданием');
  });

  it('should reject placement on occupied cells (multi-tile collision)', () => {
    const result = validateBuildingPlacement({
      ...baseInput,
      x: 18,
      y: 19,
      width: 2, // 18,19 and 19,19
      occupiedCells: [{ x: 19, y: 19, width: 2, height: 2 }] // Occupies 19,19
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('занята другим зданием');
  });

  it('should allow placement adjacent to occupied cells without collision', () => {
    const result = validateBuildingPlacement({
      ...baseInput,
      x: 18,
      y: 19,
      width: 1,
      height: 1,
      occupiedCells: [{ x: 19, y: 19, width: 1, height: 1 }]
    });
    expect(result.valid).toBe(true);
  });

  it('should reject placement if required terrain is not met', () => {
    const result = validateBuildingPlacement({
      ...baseInput,
      requiredTerrain: ['geothermal']
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('требуется особый ландшафт');
  });

  it('should allow placement if at least one cell touches required terrain', () => {
    const terrainWithGeothermal: TerrainCell[] = [
      { x: 19, y: 19, t: 'regolith' },
      { x: 20, y: 19, t: 'geothermal' },
      { x: 19, y: 20, t: 'regolith' },
      { x: 20, y: 20, t: 'regolith' },
    ];
    const result = validateBuildingPlacement({
      ...baseInput,
      width: 2,
      height: 2,
      terrainGrid: terrainWithGeothermal,
      requiredTerrain: ['geothermal']
    });
    expect(result.valid).toBe(true);
  });
});
