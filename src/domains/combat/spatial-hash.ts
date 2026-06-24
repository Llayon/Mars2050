import type { SimUnit } from './combat.sim.types'
import { TILE_SIZE } from './combat.utils'

export class SpatialHash {
  private readonly cells = new Map<string, SimUnit[]>()
  private readonly order = new Map<SimUnit, number>()
  private nextOrder = 0

  constructor(private readonly cellSize = TILE_SIZE) {}

  clear(): void {
    this.cells.clear()
    this.order.clear()
    this.nextOrder = 0
  }

  insert(unit: SimUnit): void {
    const key = this.getCellKey(unit.x, unit.y)
    const bucket = this.cells.get(key)
    if (bucket) bucket.push(unit)
    else this.cells.set(key, [unit])

    this.order.set(unit, this.nextOrder)
    this.nextOrder++
  }

  query(x: number, y: number, radius: number): SimUnit[] {
    const minCellX = Math.floor((x - radius) / this.cellSize)
    const maxCellX = Math.floor((x + radius) / this.cellSize)
    const minCellY = Math.floor((y - radius) / this.cellSize)
    const maxCellY = Math.floor((y + radius) / this.cellSize)
    const radiusSq = radius * radius
    const found: SimUnit[] = []

    for (let cellY = minCellY; cellY <= maxCellY; cellY++) {
      for (let cellX = minCellX; cellX <= maxCellX; cellX++) {
        const bucket = this.cells.get(`${cellX}:${cellY}`)
        if (!bucket) continue

        for (const unit of bucket) {
          const dx = unit.x - x
          const dy = unit.y - y
          if (dx * dx + dy * dy <= radiusSq) found.push(unit)
        }
      }
    }

    return found.sort((a, b) => (this.order.get(a) ?? 0) - (this.order.get(b) ?? 0))
  }

  private getCellKey(x: number, y: number): string {
    return `${Math.floor(x / this.cellSize)}:${Math.floor(y / this.cellSize)}`
  }
}
