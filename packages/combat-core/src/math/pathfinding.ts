export const DEFAULT_FIELD_WIDTH = 600
export const DEFAULT_FIELD_HEIGHT = 1200
export const DEFAULT_TILE_SIZE = 40

export const COLS = Math.ceil(DEFAULT_FIELD_WIDTH / DEFAULT_TILE_SIZE)
export const ROWS = Math.ceil(DEFAULT_FIELD_HEIGHT / DEFAULT_TILE_SIZE)

export interface PathfindingArenaOptions {
  width?: number
  height?: number
  tileSize?: number
}

export interface FlowFieldMap {
  costField: Uint8Array
  vectorFields: Map<number, Float32Array>
  cols?: number
  rows?: number
  tileSize?: number
}

export function createPathfindingMap(
  obstacles: { x: number; y: number; radius: number }[],
  arena?: PathfindingArenaOptions,
): FlowFieldMap {
  const width = arena?.width ?? DEFAULT_FIELD_WIDTH
  const height = arena?.height ?? DEFAULT_FIELD_HEIGHT
  const tileSize = arena?.tileSize ?? DEFAULT_TILE_SIZE
  const cols = Math.ceil(width / tileSize)
  const rows = Math.ceil(height / tileSize)

  const costField = new Uint8Array(cols * rows)
  costField.fill(1)

  for (const obs of obstacles) {
    const minX = Math.max(0, Math.floor((obs.x - obs.radius) / tileSize))
    const maxX = Math.min(cols - 1, Math.floor((obs.x + obs.radius) / tileSize))
    const minY = Math.max(0, Math.floor((obs.y - obs.radius) / tileSize))
    const maxY = Math.min(rows - 1, Math.floor((obs.y + obs.radius) / tileSize))

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const cx = x * tileSize + tileSize / 2
        const cy = y * tileSize + tileSize / 2
        const dist = Math.hypot(cx - obs.x, cy - obs.y)
        if (dist <= obs.radius + tileSize / 1.5) {
          costField[y * cols + x] = 255
        }
      }
    }
  }

  return { costField, vectorFields: new Map(), cols, rows, tileSize }
}

export function getFlowVector(map: FlowFieldMap, startX: number, startY: number, targetX: number, targetY: number): number | null {
  const cols = map.cols ?? COLS
  const rows = map.rows ?? ROWS
  const tileSize = map.tileSize ?? DEFAULT_TILE_SIZE

  const tx = Math.max(0, Math.min(cols - 1, Math.floor(targetX / tileSize)))
  const ty = Math.max(0, Math.min(rows - 1, Math.floor(targetY / tileSize)))
  const tIndex = ty * cols + tx

  let vectorField = map.vectorFields.get(tIndex)
  if (!vectorField) {
    vectorField = generateVectorField(map.costField, tx, ty, cols, rows)
    map.vectorFields.set(tIndex, vectorField)
  }

  const sx = Math.max(0, Math.min(cols - 1, Math.floor(startX / tileSize)))
  const sy = Math.max(0, Math.min(rows - 1, Math.floor(startY / tileSize)))

  if (sx === tx && sy === ty) {
    return Math.atan2(targetY - startY, targetX - startX)
  }

  const sIndex = sy * cols + sx
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
      if (nx >= 0 && nx < cols && ny >= 0 && ny < rows) {
        const nIdx = ny * cols + nx
        const nCost = vectorField[nIdx]
        if (!isNaN(nCost)) {
          const angleToNeighbor = Math.atan2((sy + n.dy) * tileSize + tileSize / 2 - startY, (sx + n.dx) * tileSize + tileSize / 2 - startX)
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

function generateVectorField(costField: Uint8Array, tx: number, ty: number, cols: number = COLS, rows: number = ROWS): Float32Array {
  const size = cols * rows
  const integrationField = new Uint32Array(size)
  integrationField.fill(0xFFFFFFFF)
  const targetIdx = ty * cols + tx
  integrationField[targetIdx] = 0

  const queue: number[] = [targetIdx]
  let head = 0
  const neighbors = [
    { dx: 0, dy: -1 }, { dx: 1, dy: 0 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 },
    { dx: 1, dy: -1 }, { dx: 1, dy: 1 }, { dx: -1, dy: 1 }, { dx: -1, dy: -1 }
  ]

  while (head < queue.length) {
    const idx = queue[head++]
    const cx = idx % cols
    const cy = Math.floor(idx / cols)
    const currentCost = integrationField[idx]

    for (const n of neighbors) {
      const nx = cx + n.dx
      const ny = cy + n.dy
      if (nx >= 0 && nx < cols && ny >= 0 && ny < rows) {
        const nIdx = ny * cols + nx
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

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const idx = y * cols + x
      if (costField[idx] === 255 && idx !== targetIdx) continue

      let minCost = integrationField[idx]
      let bestDx = 0
      let bestDy = 0

      for (const n of neighbors) {
        const nx = x + n.dx
        const ny = y + n.dy
        if (nx >= 0 && nx < cols && ny >= 0 && ny < rows) {
          const nIdx = ny * cols + nx
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
