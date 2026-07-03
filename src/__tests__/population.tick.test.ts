import { describe, it, expect, vi, beforeEach } from 'vitest'
import { processPopulationTick } from '@/domains/population/population.tick'

const mockUpdate = vi.fn()

type MockBuildingRow = { type: string; level: number; is_active: boolean }
type MockResourceRow = { type: string; amount: number }
type QueryResult = { data: MockBuildingRow[] | MockResourceRow[]; error: null }

interface MockQueryBuilder {
  select: () => MockQueryBuilder
  eq: () => MockQueryBuilder
  single: () => Promise<{ data: typeof mockPopulationData | null; error: null }>
  update: () => { eq: () => Promise<{ error: null }> }
  then: (onfulfilled: (value: QueryResult) => unknown) => Promise<unknown>
}

let mockPopulationData = {
  workers: 10,
  technicians: 0,
  scientists: 0,
  directors: 0,
  growth_progress: 50,
  happiness_workers: 50,
}

let mockBuildingsData: MockBuildingRow[] = []
let mockResourcesData: MockResourceRow[] = []

const mockSupabase = {
  from: vi.fn().mockImplementation((table) => {
    const queryBuilder: MockQueryBuilder = {
      select: vi.fn().mockImplementation(() => queryBuilder),
      eq: vi.fn().mockImplementation(() => queryBuilder),
      single: vi.fn().mockImplementation(() => {
        if (table === 'population') {
          return Promise.resolve({ data: mockPopulationData, error: null })
        }
        return Promise.resolve({ data: null, error: null })
      }),
      update: mockUpdate.mockImplementation(() => {
        return { eq: vi.fn().mockResolvedValue({ error: null }) }
      }),
      then: (onfulfilled: (value: QueryResult) => unknown) => {
        let result: MockBuildingRow[] | MockResourceRow[] = []
        if (table === 'buildings') {
          result = mockBuildingsData
        } else if (table === 'resources') {
          result = mockResourcesData
        }
        return Promise.resolve({ data: result, error: null }).then(onfulfilled)
      }
    }
    return queryBuilder
  })
}

vi.mock('@/domains/resource/resource.server', () => ({
  getServerClient: () => mockSupabase
}))

beforeEach(() => {
  vi.clearAllMocks()
  mockPopulationData = {
    workers: 10,
    technicians: 0,
    scientists: 0,
    directors: 0,
    growth_progress: 50,
    happiness_workers: 50,
  }
  mockBuildingsData = [{ type: 'habitat', level: 1, is_active: true }]
  mockResourcesData = [
    { type: 'water', amount: 100 },
    { type: 'oxygen', amount: 100 },
    { type: 'food', amount: 100 }
  ]
})

describe('Population Tick Logic', () => {
  it('updates happiness when food/water/oxygen is missing', async () => {
    // Empty resources
    mockResourcesData = [
      { type: 'water', amount: 0 },
      { type: 'oxygen', amount: 0 },
      { type: 'food', amount: 0 }
    ]

    await processPopulationTick('colony-1', 1)

    expect(mockUpdate).toHaveBeenCalled()
    const updatePayload = mockUpdate.mock.calls[0][0]
    expect(updatePayload.happiness_workers).toBe(0)
    expect(updatePayload.workers).toBe(9)
  })

  it('grows workers when there is free housing and happiness is >= 70', async () => {
    // 5 workers, 10 housing cap -> 5 free housing. Happiness is 80 (since needs are met)
    mockPopulationData.workers = 5
    
    // Process 1 hour tick with delta 1.0
    // newGrowthProgress = 50 + 1.0 * 1 * 100 = 150
    // Reaches 100, so +1 worker, progress becomes 50
    await processPopulationTick('colony-1', 1)

    expect(mockUpdate).toHaveBeenCalled()
    const updatePayload = mockUpdate.mock.calls[0][0]
    expect(updatePayload.workers).toBe(6)
    expect(updatePayload.growth_progress).toBe(50)
  })

  it('does not grow workers when there is no free housing', async () => {
    // 10 workers, 10 housing cap -> 0 free housing
    mockPopulationData.workers = 10

    await processPopulationTick('colony-1', 1)

    expect(mockUpdate).toHaveBeenCalled()
    const updatePayload = mockUpdate.mock.calls[0][0]
    expect(updatePayload.workers).toBe(10)
  })

  it('declines workers when survival needs are missing and there is no housing', async () => {
    mockResourcesData = []
    mockBuildingsData = []

    await processPopulationTick('colony-1', 1)

    expect(mockUpdate).toHaveBeenCalled()
    const updatePayload = mockUpdate.mock.calls[0][0]
    expect(updatePayload.happiness_workers).toBe(0)
    expect(updatePayload.workers).toBe(9)
  })
})
