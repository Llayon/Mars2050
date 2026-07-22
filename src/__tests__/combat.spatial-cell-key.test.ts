import { describe, expect, it } from 'vitest'
import { encodeSpatialCellKey } from '@/domains/combat/ecs/spatial-cell-key'

describe('combat spatial cell key', () => {
  it('keeps signed 16-bit cell coordinates collision-free', () => {
    const keys = new Set<number>()
    for (const x of [-32_768, -1, 0, 1, 32_767]) {
      for (const y of [-32_768, -1, 0, 1, 32_767]) {
        keys.add(encodeSpatialCellKey(x, y))
      }
    }

    expect(keys.size).toBe(25)
  })
})
