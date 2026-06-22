import { FIELD_WIDTH, FIELD_HEIGHT, TILE_SIZE } from './combat.utils';

export const COLS = Math.ceil(FIELD_WIDTH / TILE_SIZE); // 15
export const ROWS = Math.ceil(FIELD_HEIGHT / TILE_SIZE); // 30

export interface FlowFieldMap {
  costField: Uint8Array; // 0 for empty, 255 for impassable
  vectorFields: Map<number, Float32Array>; // Keyed by target cell index. Array of angles (radians).
}

/**
 * Creates a new flow field map with static obstacles
 */
export function createPathfindingMap(obstacles: {x: number, y: number, radius: number}[]): FlowFieldMap {
  const costField = new Uint8Array(COLS * ROWS);
  costField.fill(1); // Default cost

  for (const obs of obstacles) {
    const minX = Math.max(0, Math.floor((obs.x - obs.radius) / TILE_SIZE));
    const maxX = Math.min(COLS - 1, Math.floor((obs.x + obs.radius) / TILE_SIZE));
    const minY = Math.max(0, Math.floor((obs.y - obs.radius) / TILE_SIZE));
    const maxY = Math.min(ROWS - 1, Math.floor((obs.y + obs.radius) / TILE_SIZE));

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const cx = x * TILE_SIZE + TILE_SIZE / 2;
        const cy = y * TILE_SIZE + TILE_SIZE / 2;
        const dist = Math.hypot(cx - obs.x, cy - obs.y);
        
        // If the cell center is roughly inside the obstacle radius
        if (dist < obs.radius + TILE_SIZE / 4) {
          costField[y * COLS + x] = 255; // impassable
        }
      }
    }
  }

  return { costField, vectorFields: new Map() };
}

/**
 * Gets the desired angle for a unit to reach its target, avoiding obstacles.
 * Returns null if the target is unreachable or unit is already at target cell.
 */
export function getFlowVector(map: FlowFieldMap, startX: number, startY: number, targetX: number, targetY: number): number | null {
  const tx = Math.max(0, Math.min(COLS - 1, Math.floor(targetX / TILE_SIZE)));
  const ty = Math.max(0, Math.min(ROWS - 1, Math.floor(targetY / TILE_SIZE)));
  const tIndex = ty * COLS + tx;

  let vectorField = map.vectorFields.get(tIndex);
  if (!vectorField) {
    vectorField = generateVectorField(map.costField, tx, ty);
    map.vectorFields.set(tIndex, vectorField);
  }

  const sx = Math.max(0, Math.min(COLS - 1, Math.floor(startX / TILE_SIZE)));
  const sy = Math.max(0, Math.min(ROWS - 1, Math.floor(startY / TILE_SIZE)));
  
  if (sx === tx && sy === ty) {
    // Already in the same cell, just walk straight to exact coordinate
    return Math.atan2(targetY - startY, targetX - startX);
  }

  const sIndex = sy * COLS + sx;
  const angle = vectorField[sIndex];
  
  if (isNaN(angle)) {
     // Unreachable or no gradient, fallback to direct line
     return Math.atan2(targetY - startY, targetX - startX);
  }
  
  return angle;
}

function generateVectorField(costField: Uint8Array, tx: number, ty: number): Float32Array {
  const size = COLS * ROWS;
  const integrationField = new Uint32Array(size);
  integrationField.fill(0xFFFFFFFF); // infinity

  const targetIdx = ty * COLS + tx;
  integrationField[targetIdx] = 0;

  // Simple BFS for Dijkstra
  const queue: number[] = [targetIdx];
  let head = 0;

  const neighbors = [
    { dx: 0, dy: -1 }, { dx: 1, dy: 0 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 },
    { dx: 1, dy: -1 }, { dx: 1, dy: 1 }, { dx: -1, dy: 1 }, { dx: -1, dy: -1 }
  ];

  while (head < queue.length) {
    const idx = queue[head++];
    const cx = idx % COLS;
    const cy = Math.floor(idx / COLS);
    const currentCost = integrationField[idx];

    for (const n of neighbors) {
      const nx = cx + n.dx;
      const ny = cy + n.dy;
      if (nx >= 0 && nx < COLS && ny >= 0 && ny < ROWS) {
        const nIdx = ny * COLS + nx;
        const cellCost = costField[nIdx];
        if (cellCost === 255) continue; // Impassable

        // Diagonal cost is roughly 1.4x straight cost (14 vs 10)
        const moveCost = (n.dx !== 0 && n.dy !== 0) ? cellCost * 14 : cellCost * 10;
        
        if (currentCost + moveCost < integrationField[nIdx]) {
          integrationField[nIdx] = currentCost + moveCost;
          queue.push(nIdx);
        }
      }
    }
  }

  const vectorField = new Float32Array(size);
  vectorField.fill(NaN);

  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const idx = y * COLS + x;
      if (costField[idx] === 255 && idx !== targetIdx) continue;

      let minCost = integrationField[idx];
      let bestDx = 0;
      let bestDy = 0;

      // Find the neighbor that provides the steepest descent (lowest cost)
      for (const n of neighbors) {
        const nx = x + n.dx;
        const ny = y + n.dy;
        if (nx >= 0 && nx < COLS && ny >= 0 && ny < ROWS) {
          const nIdx = ny * COLS + nx;
          if (integrationField[nIdx] < minCost) {
            minCost = integrationField[nIdx];
            bestDx = n.dx;
            bestDy = n.dy;
          }
        }
      }

      if (bestDx !== 0 || bestDy !== 0) {
        vectorField[idx] = Math.atan2(bestDy, bestDx);
      }
    }
  }

  return vectorField;
}
