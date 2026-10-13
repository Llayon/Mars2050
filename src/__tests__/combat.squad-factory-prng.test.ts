import { describe, it, expect } from 'vitest'
import { createRuntimeSquad } from '@/domains/combat/combat.squad-factory'
import { PRNG } from '@/domains/combat/combat.utils'
import type { UnitRow } from '@/domains/combat/combat.types'

function makeRow(id: string, overrides: Partial<UnitRow> = {}): UnitRow {
  return {
    id,
    colony_id: 'colony-1',
    unit_type: 'marine',
    tier: 1,
    upgrade_path: [],
    hp_current: 100,
    ...overrides,
  }
}

describe('createRuntimeSquad PRNG and sequential placement', () => {
  it('advances PRNG deterministically when coordinates are omitted', () => {
    const rng = new PRNG(42)
    const row1 = makeRow('u1')
    const row2 = makeRow('u2')

    const squad1 = createRuntimeSquad(row1, 'attacker', rng)
    const squad2 = createRuntimeSquad(row2, 'attacker', rng)

    expect(squad1).toHaveLength(8)
    expect(squad2).toHaveLength(8)

    // Baseline reproduction: (507, 1121) -> (551, 1106)
    expect(squad1[0].x).toBe(507)
    expect(squad1[0].y).toBe(1121)
    expect(squad2[0].x).toBe(551)
    expect(squad2[0].y).toBe(1106)

    // Squads do not overlap
    expect(squad1[0].x).not.toBe(squad2[0].x)
    expect(squad1[0].y).not.toBe(squad2[0].y)

    // PRNG advanced 4 times (2 for squad1, 2 for squad2)
    const referenceRng = new PRNG(42)
    referenceRng.next()
    referenceRng.next()
    referenceRng.next()
    referenceRng.next()

    expect(rng.next()).toBe(referenceRng.next())
  })

  it('advances PRNG exactly once when only grid_x is provided', () => {
    const rng = new PRNG(42)
    const row1 = makeRow('u1', { grid_x: '300' })
    const row2 = makeRow('u2', { grid_x: '300' })

    const squad1 = createRuntimeSquad(row1, 'attacker', rng)
    const squad2 = createRuntimeSquad(row2, 'attacker', rng)

    // Marine 0 offset is (-24, -24); with centerX = 300, x = 276
    expect(squad1[0].x).toBe(276)
    expect(squad2[0].x).toBe(276)
    expect(squad1[0].y).not.toBe(squad2[0].y)

    // PRNG advanced 2 times (1 for squad1 y, 1 for squad2 y)
    const referenceRng = new PRNG(42)
    referenceRng.next()
    referenceRng.next()
    expect(rng.next()).toBe(referenceRng.next())
  })

  it('advances PRNG exactly once when only grid_y is provided', () => {
    const rng = new PRNG(42)
    const row1 = makeRow('u1', { grid_y: '1000' })
    const row2 = makeRow('u2', { grid_y: '1000' })

    const squad1 = createRuntimeSquad(row1, 'attacker', rng)
    const squad2 = createRuntimeSquad(row2, 'attacker', rng)

    // Marine 0 offset is (-24, -24); with centerY = 1000, y = 976
    expect(squad1[0].y).toBe(976)
    expect(squad2[0].y).toBe(976)
    expect(squad1[0].x).not.toBe(squad2[0].x)

    // PRNG advanced 2 times (1 for squad1 x, 1 for squad2 x)
    const referenceRng = new PRNG(42)
    referenceRng.next()
    referenceRng.next()
    expect(rng.next()).toBe(referenceRng.next())
  })

  it('does NOT advance PRNG when both grid_x and grid_y are provided', () => {
    const rng = new PRNG(42)
    const row1 = makeRow('u1', { grid_x: '300', grid_y: '700' })
    const row2 = makeRow('u2', { grid_x: '300', grid_y: '700' })

    const squad1 = createRuntimeSquad(row1, 'attacker', rng)
    const squad2 = createRuntimeSquad(row2, 'attacker', rng)

    expect(squad1[0].x).toBe(276)
    expect(squad1[0].y).toBe(676)
    expect(squad2[0].x).toBe(276)
    expect(squad2[0].y).toBe(676)

    // PRNG was not touched; next value matches fresh PRNG(42)
    const referenceRng = new PRNG(42)
    expect(rng.next()).toBe(referenceRng.next())
  })

  it('places defender squads within defender deployment zone and advances PRNG', () => {
    const rng = new PRNG(42)
    const row1 = makeRow('d1')
    const row2 = makeRow('d2')

    const squad1 = createRuntimeSquad(row1, 'defender', rng)
    const squad2 = createRuntimeSquad(row2, 'defender', rng)

    // Defender zone Y is [0, 300]
    expect(squad1[0].y).toBeGreaterThanOrEqual(-30)
    expect(squad1[0].y).toBeLessThanOrEqual(350)
    expect(squad2[0].y).toBeGreaterThanOrEqual(-30)
    expect(squad2[0].y).toBeLessThanOrEqual(350)

    expect(squad1[0].x).not.toBe(squad2[0].x)
    expect(squad1[0].y).not.toBe(squad2[0].y)

    const referenceRng = new PRNG(42)
    referenceRng.next()
    referenceRng.next()
    referenceRng.next()
    referenceRng.next()
    expect(rng.next()).toBe(referenceRng.next())
  })
})
