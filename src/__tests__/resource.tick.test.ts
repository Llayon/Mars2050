import { describe, it, expect, vi, beforeEach } from 'vitest'
import { recalculateResources } from '@/domains/resource/resource.service'

const callOrder: string[] = []

type QueryResult = { data: unknown[]; error: null }

interface MockQueryBuilder {
  select: () => MockQueryBuilder
  update: () => MockQueryBuilder
  eq: () => MockQueryBuilder
  lte: () => Promise<{ data: unknown[]; error: null }>
  single: () => Promise<{ data: unknown; error: null }>
  then: (onfulfilled: (value: QueryResult) => unknown) => Promise<unknown>
}

const mockSupabase = {
  from: vi.fn().mockImplementation((table) => {
    const queryBuilder: MockQueryBuilder = {
      select: vi.fn().mockImplementation(() => queryBuilder),
      update: vi.fn().mockImplementation(() => {
        callOrder.push('update')
        return queryBuilder
      }),
      eq: vi.fn().mockImplementation(() => queryBuilder),
      lte: vi.fn().mockResolvedValue({ data: [], error: null }),
      single: vi.fn().mockImplementation(() => {
        if (table === 'colonies') return Promise.resolve({ data: { terrain_grid: [] }, error: null })
        if (table === 'population') return Promise.resolve({ data: { workers: 10 }, error: null })
        return Promise.resolve({ data: null, error: null })
      }),
      // The promise resolution for normal queries
      then: (onfulfilled: (value: QueryResult) => unknown) => {
        let result: unknown[] = []
        if (table === 'resources') {
          // Set production_rate to 999 so it differs from calculated 0 rate, triggering update
          result = [{ id: 'res-1', type: 'minerals', production_rate: 999, consumption_rate: 0, amount: 50 }]
        }
        return Promise.resolve({ data: result, error: null }).then(onfulfilled)
      }
    }
    return queryBuilder
  }),
  rpc: vi.fn().mockImplementation(() => {
    callOrder.push('rpc')
    return Promise.resolve({ 
      data: [{ type: 'minerals', amount: 100, production_rate: 10, consumption_rate: 5 }], 
      error: null 
    })
  })
}

vi.mock('@/domains/resource/resource.server', () => ({
  getServerClient: () => mockSupabase
}))

vi.mock('@/domains/events/events.service', () => ({
  getActiveEvents: vi.fn().mockResolvedValue([]),
  applyEventModifiers: vi.fn().mockImplementation((rates) => rates),
  processExpiredEvents: vi.fn().mockResolvedValue(null)
}))

vi.mock('@/domains/resource/resource.events', () => ({
  processCompletedEvents: vi.fn().mockResolvedValue(null)
}))

vi.mock('@/domains/events/events.generator', () => ({
  generateRandomEvent: vi.fn().mockResolvedValue(null)
}))

beforeEach(() => {
  callOrder.length = 0
  vi.clearAllMocks()
})

describe('Resource Recalculation Order', () => {
  it('updates rates in DB before calling recalculate_resources RPC', async () => {
    await recalculateResources('colony-1')
    expect(callOrder).toEqual(['update', 'update', 'rpc'])
  })
})
