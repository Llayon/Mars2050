export const DEFAULT_FIELD_WIDTH = 600
export const DEFAULT_FIELD_HEIGHT = 1200
export const DEFAULT_TILE_SIZE = 40

export const COLS = Math.ceil(DEFAULT_FIELD_WIDTH / DEFAULT_TILE_SIZE)
export const ROWS = Math.ceil(DEFAULT_FIELD_HEIGHT / DEFAULT_TILE_SIZE)

export interface FlowFieldMap {
  costField: Uint8Array
  vectorFields: Map<number, Float32Array>
}

export function createPathfindingMap(obstacles: { x: number; y: number; radius: number }[]): FlowFieldMap {
  const costField = new Uint8Array(COLS * ROWS)
  costField.fill(1)

  for (const obs of obstacles) {
    const minX = Math.max(0, Math.floor((obs.x - obs.radius) / DEFAULT_TILE_SIZE))
    const maxX = Math.min(COLS - 1, Math.floor((obs.x + obs.radius) / DEFAULT_TILE_SIZE))
    const minY = Math.max(0, Math.floor((obs.y - obs.radius) / DEFAULT_TILE_SIZE))
    const maxY = Math.min(ROWS - 1, Math.floor((obs.y + obs.radius) / DEFAULT_TILE_SIZE))

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const cx = x * DEFAULT_TILE_SIZE + DEFAULT_TILE_SIZE / 2
        const cy = y * DEFAULT_TILE_SIZE + DEFAULT_TILE_SIZE / 2
        const dist = Math.hypot(cx - obs.x, cy - obs.y)
        if (dist <= obs.radius + DEFAULT_TILE_SIZE / 1.5) {
          costField[y * COLS + x] = 255
        }
      }
    }
  }

  return { costField, vectorFields: new Map() }
}

export function getFlowVector(map: FlowFieldMap, startX: number, startY: number, targetX: number, targetY: number): number | null {
  const tx = Math.max(0, Math.min(COLS - 1, Math.floor(targetX / DEFAULT_TILE_SIZE)))
  const ty = Math.max(0, Math.min(ROWS - 1, Math.floor(targetY / DEFAULT_TILE_SIZE)))
  const tIndex = ty * COLS + tx

  let vectorField = map.vectorFields.get(tIndex)
  if (!vectorField) {
    vectorField = generateVectorField(map.costField, tx, ty)
    map.vectorFields.set(tIndex, vectorField)
  }

  const sx = Math.max(0, Math.min(COLS - 1, Math.floor(startX / DEFAULT_TILE_SIZE)))
  const sy = Math.max(0, Math.min(ROWS - 1, Math.floor(startY / DEFAULT_TILE_SIZE)))

  if (sx === tx && sy === ty) {
    return Math.atan2(targetY - startY, targetX - startX)
  }

  const sIndex = sy * COLS + sx
  const angle = vectorField[sIndex]

  if (isNaN(angle)) {
    let bestAngle = Math.atan2(targetY - startY, targetX - startX)
    const neighbors = [
      { dx: 0, dy: -1 }, { dx: 1, dy: 0 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 },
      { dx: 1, dy: -1 }, { dx: 1, dy: 1 }, { dx: -1, dy: 1 }, { dx: -1, dy: -1 }
    ]
    const directAngle = bestAngle
    let bestDiff = Infinity

    for (const n of neighbors) {
      const nx = sx + n.dx
      const ny = sy + n.dy
      if (nx >= 0 && nx < COLS && ny >= 0 && ny < ROWS) {
        const nIdx = ny * COLS + nx
        const nCost = vectorField[nIdx]
        if (!isNaN(nCost)) {
          const angleToNeighbor = Math.atan2((sy + n.dy) * DEFAULT_TILE_SIZE + DEFAULT_TILE_SIZE / 2 - startY, (sx + n.dx) * DEFAULT_TILE_SIZE + DEFAULT_TILE_SIZE / 2 - startX)
          let diff = angleToNeighbor - directAngle
          while (diff > Math.PI) diff -= Math.PI * 2
          while (diff < -Math.PI) diff += Math.PI * 2
          diff = Math.abs(diff)
          if (diff < bestDiff) {
            bestDiff = diff
            bestAngle = angleToNeighbor
          }
        }
      }
    }
    return bestAngle
  }

  return angle
}

function generateVectorField(costField: Uint8Array, tx: number, ty: number): Float32Array {
  const size = COLS * ROWS
  const integrationField = new Uint32Array(size)
  integrationField.fill(0xFFFFFFFF)
  const targetIdx = ty * COLS + tx
  integrationField[targetIdx] = 0

  const queue: number[] = [targetIdx]
  let head = 0
  const neighbors = [
    { dx: 0, dy: -1 }, { dx: 1, dy: 0 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 },
    { dx: 1, dy: -1 }, { dx: 1, dy: 1 }, { dx: -1, dy: 1 }, { dx: -1, dy: -1 }
  ]

  while (head < queue.length) {
    const idx = queue[head++]
    const cx = idx % COLS
    const cy = Math.floor(idx / COLS)
    const currentCost = integrationField[idx]

    for (const n of neighbors) {
      const nx = cx + n.dx
      const ny = cy + n.dy
      if (nx >= 0 && nx < COLS && ny >= 0 && ny < ROWS) {
        const nIdx = ny * COLS + nx
        const cellCost = costField[nIdx]
        if (cellCost === 255) continue
        const moveCost = (n.dx !== 0 && n.dy !== 0) ? cellCost * 14 : cellCost * 10
        if (currentCost + moveCost < integrationField[nIdx]) {
          integrationField[nIdx] = currentCost + moveCost
          queue.push(nIdx)
        }
      }
    }
  }

  const vectorField = new Float32Array(size)
  vectorField.fill(NaN)

  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const idx = y * COLS + x
      if (costField[idx] === 255 && idx !== targetIdx) continue

      let minCost = integrationField[idx]
      let bestDx = 0
      let bestDy = 0

      for (const n of neighbors) {
        const nx = x + n.dx
        const ny = y + n.dy
        if (nx >= 0 && nx < COLS && ny >= 0 && ny < ROWS) {
          const nIdx = ny * COLS + nx
          if (integrationField[nIdx] < minCost) {
            minCost = integrationField[nIdx]
            bestDx = n.dx
            bestDy = n.dy
          }
        }
      }

      if (bestDx !== 0 || bestDy !== 0) {
        vectorField[idx] = Math.atan2(bestDy, bestDx)
      }
    }
  }

  return vectorField
}
