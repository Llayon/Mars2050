export type SpatialCellKey = number

const CELL_COORDINATE_BIAS = 32_768
const CELL_COORDINATE_SPAN = 65_536

export function encodeSpatialCellKey(cellX: number, cellY: number): SpatialCellKey {
  return (cellX + CELL_COORDINATE_BIAS) * CELL_COORDINATE_SPAN + cellY + CELL_COORDINATE_BIAS
}
