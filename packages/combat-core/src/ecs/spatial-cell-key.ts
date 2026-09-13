export type SpatialCellKey = number

const CELL_COORDINATE_BIAS = 32_768
const CELL_COORDINATE_SPAN = 65_536

export function encodeSpatialCellKey(cellX: number, cellY: number): SpatialCellKey {
  return getSpatialCellColumnBase(cellX) + cellY
}

export function getSpatialCellColumnBase(cellX: number): SpatialCellKey {
  return (cellX + CELL_COORDINATE_BIAS) * CELL_COORDINATE_SPAN + CELL_COORDINATE_BIAS
}

export function decodeSpatialCellKey(key: SpatialCellKey): { cellX: number; cellY: number } {
  const biasedX = Math.floor(key / CELL_COORDINATE_SPAN)
  return {
    cellX: biasedX - CELL_COORDINATE_BIAS,
    cellY: key - biasedX * CELL_COORDINATE_SPAN - CELL_COORDINATE_BIAS,
  }
}
