import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POPULATION_TIERS } from '@/domains/population/population.config'
import type { PopulationState } from '@/domains/population/population.types'

type DbError = { message: string }
type ColonyResult = { data: { id: string } | null; error: DbError | null }
type RpcResult = { data: unknown; error: DbError | null }

interface MockQueryBuilder {
  select: () => MockQueryBuilder
  eq: () => MockQueryBuilder
  single: () => Promise<ColonyResult>
}

const mockSingle = vi.fn<() => Promise<ColonyResult>>()
const mockRpc = vi.fn<(...args: unknown[]) => Promise<RpcResult>>()
const mockFrom = vi.fn((_table: string) => createQueryBuilder())

function createQueryBuilder(): MockQueryBuilder {
  const queryBuilder: MockQueryBuilder = {
    select: vi.fn(() => queryBuilder),
    eq: vi.fn(() => queryBuilder),
    single: mockSingle,
  }
  return queryBuilder
}

const mockSupabase = {
  from: mockFrom,
  rpc: mockRpc,
}

vi.mock('@/domains/resource/resource.server', () => ({
  getServerClient: () => mockSupabase
}))

import { upgradePopulation } from '@/domains/population/population.service'

const COLONY_ID = '550e8400-e29b-41d4-a716-446655440000'
const updatedPopulation: PopulationState = {
  id: 'pop-1',
  colony_id: COLONY_ID,
  workers: 0,
  technicians: 10,
  scientists: 0,
  directors: 0,
  happiness_workers: 90,
  happiness_technicians: 50,
  happiness_scientists: 50,
  happiness_directors: 50,
  growth_progress: 0,
  updated_at: '2026-01-01T00:00:00.000Z'
}

beforeEach(() => {
  vi.clearAllMocks()
  mockSingle.mockResolvedValue({ data: { id: COLONY_ID }, error: null })
  mockRpc.mockResolvedValue({
    data: { success: true, population: updatedPopulation },
    error: null
  })
})

describe('upgradePopulation service', () => {
  it('delegates resource deduction and population movement to the atomic RPC', async () => {
    const result = await upgradePopulation('user-1', COLONY_ID, 'worker', 10)

    expect(result.data).toEqual(updatedPopulation)
    expect(mockFrom).toHaveBeenCalledWith('colonies')
    expect(mockFrom).not.toHaveBeenCalledWith('resources')
    expect(mockFrom).not.toHaveBeenCalledWith('population')
    expect(mockRpc).toHaveBeenCalledWith('upgrade_population_transaction', {
      p_colony_id: COLONY_ID,
      p_from_tier: 'worker',
      p_count: 10,
      p_costs: POPULATION_TIERS.worker.upgradeCost,
      p_upgrade_building: POPULATION_TIERS.worker.upgradeBuilding,
      p_target_housing: POPULATION_TIERS.technician.housingPerBuilding,
      p_min_happiness: 80
    })
  })

  it('returns a bad request when the RPC rejects the upgrade contract', async () => {
    mockRpc.mockResolvedValue({
      data: { success: false, error: 'Not enough housing' },
      error: null
    })

    const result = await upgradePopulation('user-1', COLONY_ID, 'worker', 10)

    expect(result.data).toBeUndefined()
    expect(result.error).toBeDefined()
  })

  it('rejects unsupported source tiers before calling the RPC', async () => {
    const result = await upgradePopulation('user-1', COLONY_ID, 'director', 1)

    expect(result.data).toBeUndefined()
    expect(result.error).toBeDefined()
    expect(mockRpc).not.toHaveBeenCalled()
  })
})
