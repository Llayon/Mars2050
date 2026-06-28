import { TerrainType } from './colony-terrain.types';

export interface TerrainConfig {
  color: number;
  label: string;
  canClear: boolean;
  clearCost?: { energy?: number; minerals?: number };
}

export const TERRAIN_CONFIG: Record<TerrainType, TerrainConfig> = {
  regolith: {
    color: 0x8B4513, // Standard brownish
    label: 'Реголит',
    canClear: false,
  },
  iron_deposit: {
    color: 0xA0522D, // Darker, reddish brown
    label: 'Железная жила',
    canClear: false,
  },
  ice_pocket: {
    color: 0xADD8E6, // Light blue
    label: 'Ледник',
    canClear: false,
  },
  geothermal: {
    color: 0xFF4500, // Orange red
    label: 'Геотермальный выход',
    canClear: false,
  },
  blocked_rock: {
    color: 0x4A4A4A, // Dark gray
    label: 'Скала',
    canClear: true,
    clearCost: { energy: 100, minerals: 50 }, // For future clear functionality
  },
};

// Global grid constants
export const COLONY_GRID_SIZE = 40;
export const COLONY_CENTER_COORD = 19.5; // True center of 0-39 range is 19.5
export const COLONY_START_RADIUS = 5; // Using Chebyshev distance <= 4.5 gives exactly 10x10

// Exact indices for the start zone (10x10)
export const START_ZONE_MIN = 15;
export const START_ZONE_MAX = 24;
