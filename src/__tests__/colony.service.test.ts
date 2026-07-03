import { describe, it, expect, vi, beforeEach } from 'vitest'
import { STARTING_RESOURCES } from '@/domains/building/building.config'
import type { TerrainGrid } from '@/domains/colony/colony-terrain.types'

type SelectResult = { data: { type: string }[] | null; error: { message: string } | null }
type InsertResult = { error: { message: string } | null }
type SingleResult = { data: { terrain_grid: unknown } | null; error: { message: string } | null }

const mockResourceEq = vi.fn<(_column: string, _value: string) => Promise<SelectResult>>()
const mockSingle = vi.fn<() => Promise<SingleResult>>()
const mockColonyEq = vi.fn<(_column: string, _value: string) => { single: typeof mockSingle }>()
const mockUpdateEq = vi.fn<(_column: string, _value: string) => Promise<{ error: { message: string } | null }>>()
const mockInsert = vi.fn<(_rows: Record<string, unknown>[]) => Promise<InsertResult>>()
const mockUpdate = vi.fn<(_values: Record<string, unknown>) => { eq: typeof mockUpdateEq }>()
const mockFrom = vi.fn((table: string) => {
  if (table === 'resources') {
    return {
      select: vi.fn(() => ({ eq: mockResourceEq })),
      insert: mockInsert,
    }
  }
  return {
    select: vi.fn(() => ({ eq: mockColonyEq })),
    update: mockUpdate,
  }
})

vi.mock('@/domains/resource/resource.server', () => ({
  getServerClient: () => ({ from: mockFrom }),
}))

import { ensureColonyTerrain, initColonyResources } from '@/domains/colony/colony.service'

const COLONY_ID = '550e8400-e29b-41d4-a716-446655440000'

beforeEach(() => {
  vi.clearAllMocks()
  mockColonyEq.mockReturnValue({ single: mockSingle })
  mockUpdate.mockReturnValue({ eq: mockUpdateEq })
  mockInsert.mockResolvedValue({ error: null })
  mockUpdateEq.mockResolvedValue({ error: null })
})

describe('initColonyResources', () => {
  it('inserts only missing starting resources for partially initialized colonies', async () => {
    mockResourceEq.mockResolvedValue({
      data: [{ type: 'oxygen' }, { type: 'consumer_goods' }],
      error: null,
    })

    const result = await initColonyResources(COLONY_ID)
    const insertedRows = mockInsert.mock.calls[0][0]

    expect(result).toEqual({ success: true, count: Object.keys(STARTING_RESOURCES).length - 2 })
    expect(insertedRows).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'oxygen' }),
      expect.objectContaining({ type: 'consumer_goods' }),
    ]))
    expect(insertedRows).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'water', amount: STARTING_RESOURCES.water }),
      expect.objectContaining({ type: 'research_points', amount: STARTING_RESOURCES.research_points }),
    ]))
  })

  it('does not insert rows when all starting resources already exist', async () => {
    mockResourceEq.mockResolvedValue({
      data: Object.keys(STARTING_RESOURCES).map(type => ({ type })),
      error: null,
    })

    const result = await initColonyResources(COLONY_ID)

    expect(result).toEqual({ success: true, error: undefined, count: 0 })
    expect(mockInsert).not.toHaveBeenCalled()
  })
})

describe('ensureColonyTerrain', () => {
  it('generates and persists deterministic terrain for empty colony grids', async () => {
    mockSingle.mockResolvedValue({ data: { terrain_grid: [] }, error: null })

    const result = await ensureColonyTerrain(COLONY_ID)
    const terrainGrid = result.terrainGrid as TerrainGrid

    expect(result.success).toBe(true)
    expect(result.updated).toBe(true)
    expect(terrainGrid.length).toBe(1600)
    expect(mockUpdate).toHaveBeenCalledWith({ terrain_grid: terrainGrid })
    expect(mockUpdateEq).toHaveBeenCalledWith('id', COLONY_ID)
  })

  it('keeps existing non-empty terrain grids unchanged', async () => {
    const existingTerrain = [{ x: 0, y: 0, t: 'regolith' }]
    mockSingle.mockResolvedValue({ data: { terrain_grid: existingTerrain }, error: null })

    const result = await ensureColonyTerrain(COLONY_ID)

    expect(result).toEqual({ success: true, terrainGrid: existingTerrain, updated: false })
    expect(mockUpdate).not.toHaveBeenCalled()
  })
})
