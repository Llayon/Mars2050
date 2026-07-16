import type { SimUnit } from './combat.sim.types'
import { TILE_SIZE } from './combat.utils'

export interface SpatialQueryProfile {
  queryCount: number
  candidateCount: number
  maxCandidates: number
}

export class SpatialHash {
  private readonly cells = new Map<string, SimUnit[]>()
  private readonly order = new Map<SimUnit, number>()
  private readonly unitCells = new Map<SimUnit, string>()
  private nextOrder = 0
  private readonly profile: SpatialQueryProfile = { queryCount: 0, candidateCount: 0, maxCandidates: 0 }

  constructor(private readonly cellSize = TILE_SIZE) {}

  clear(): void {
    this.cells.clear()
    this.order.clear()
    this.unitCells.clear()
    this.nextOrder = 0
  }

  insert(unit: SimUnit): void {
    if (this.unitCells.has(unit)) {
      this.update(unit)
      return
    }

    const key = this.getCellKey(unit.x, unit.y)
    this.addToCell(key, unit)
    this.unitCells.set(unit, key)
    this.order.set(unit, this.nextOrder)
    this.nextOrder++
  }

  update(unit: SimUnit): void {
    const oldKey = this.unitCells.get(unit)
    if (!oldKey) {
      this.insert(unit)
      return
    }

    const newKey = this.getCellKey(unit.x, unit.y)
    if (oldKey === newKey) return

    this.removeFromCell(oldKey, unit)
    this.addToCell(newKey, unit)
    this.unitCells.set(unit, newKey)
  }

  remove(unit: SimUnit): void {
    const key = this.unitCells.get(unit)
    if (!key) return

    this.removeFromCell(key, unit)
    this.unitCells.delete(unit)
    this.order.delete(unit)
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

    this.profile.queryCount++
    this.profile.candidateCount += found.length
    this.profile.maxCandidates = Math.max(this.profile.maxCandidates, found.length)
    return found.sort((a, b) => (this.order.get(a) ?? 0) - (this.order.get(b) ?? 0))
  }

  getProfile(): SpatialQueryProfile {
    return { ...this.profile }
  }

  private getCellKey(x: number, y: number): string {
    return `${Math.floor(x / this.cellSize)}:${Math.floor(y / this.cellSize)}`
  }

  private addToCell(key: string, unit: SimUnit): void {
    const bucket = this.cells.get(key)
    if (bucket) bucket.push(unit)
    else this.cells.set(key, [unit])
  }

  private removeFromCell(key: string, unit: SimUnit): void {
    const bucket = this.cells.get(key)
    if (!bucket) return

    const index = bucket.indexOf(unit)
    if (index !== -1) bucket.splice(index, 1)
    if (bucket.length === 0) this.cells.delete(key)
  }
}
