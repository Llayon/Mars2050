import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the persistence layer to capture what gets persisted.
const mockPersist = vi.fn()
const mockGetCooldown = vi.fn()
const { mockSimulateBattle } = vi.hoisted(() => ({
  mockSimulateBattle: vi.fn(() => ({
    winner: 'attacker',
    logs: [],
    initialState: [],
    obstacles: [],
    metrics: {
      firstAttackTick: 1,
      battleDurationTicks: 2,
      targetSwitches: 0,
      overlapSamples: 0,
      averageOverlap: 0,
      maxOverlap: 0,
      averageOverlapRatio: 0,
      maxOverlapRatio: 0,
      severeOverlapSamples: 0,
      averageTimeToEngage: 1,
      averageEngagementDistance: 100,
      meleeSlotWaitTicks: 0,
      stuckTicksByUnitType: {},
      targetSwitchesByUnitType: {},
      damageByUnitType: { marine: 10 },
      damageTakenByUnitType: { marine: 10 },
      healingDoneByUnitType: {},
      killsByUnitType: { marine: 1 },
      overkillDamage: 0,
    },
    survivors: [
      { id: 'u1_0', hp: 80, maxHp: 100, type: 'marine', team: 'attacker' as const },
      { id: 'u2', hp: 0, maxHp: 50, type: 'marine', team: 'defender' as const },
    ],
    seed: 12345,
    terminationReason: 'elimination',
    elapsedTicks: 2,
    simulationVersion: 2,
  })),
}))
vi.mock('@/domains/pvp/pvp.replay', async () => {
  const actual = await vi.importActual<typeof import('@/domains/pvp/pvp.replay')>('@/domains/pvp/pvp.replay')
  return {
    ...actual,
    persistBattleWithSnapshot: (...args: unknown[]) => mockPersist(...args),
    getAttackCooldownSeconds: (...args: unknown[]) => mockGetCooldown(...args),
  }
})

vi.mock('@/domains/combat/combat.engine', () => ({
  simulateBattle: mockSimulateBattle,
}))

vi.mock('@/domains/resource/resource.server', () => ({
  getServerClient: () => ({
    from: (table: string) => {
      const chain: Record<string, unknown> = {}
      chain.select = () => chain
      chain.eq = () => chain
      chain.order = () => chain
      chain.limit = () => chain
      chain.in = () => chain
      chain.single = () => Promise.resolve({ data: null, error: null })
      chain.delete = () => chain
      chain.update = () => chain
      chain.insert = () => chain
      if (table === 'units') {
        chain.then = (resolve: (v: unknown) => void) =>
          resolve({
            data: [
              {
                id: 'unit-1',
                colony_id: 'col-a',
                unit_type: 'marine',
                hp_current: 100,
                grid_x: '0',
                grid_y: '0',
                tier: 1,
                upgrade_path: [],
              },
            ],
            error: null,
          })
      } else {
        chain.then = (resolve: (v: unknown) => void) => resolve({ data: [], error: null })
      }
      return chain
    },
  }),
}))

import { executeAttack, ATTACK_COOLDOWN_SECONDS } from '@/domains/pvp/pvp.service'

const UUID = '550e8400-e29b-41d4-a716-446655440000'

function makeAuthClient(userId: string) {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    in: vi.fn(() => chain),
    single: vi.fn(() => Promise.resolve({ data: { id: 'col-a', user_id: userId }, error: null })),
    then: (resolve: (v: unknown) => void) => resolve({ data: [{ id: 'col-a', user_id: userId }], error: null }),
  }
  return { from: vi.fn(() => chain) } as never
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGetCooldown.mockResolvedValue(0)
})

describe('executeAttack — contract: simulationVersion in snapshot', () => {
  it('passes SNAPSHOT_VERSION into persistBattleWithSnapshot', async () => {
    mockPersist.mockResolvedValue('battle-1')

    const result = await executeAttack(
      makeAuthClient('user-1'),
      'user-1',
      UUID,
      '550e8400-e29b-41d4-a716-446655440001',
      12345
    )

    expect(result.success).toBe(true)
    expect(mockPersist).toHaveBeenCalledTimes(1)
    const snapshotArg = mockPersist.mock.calls[0]![1] as { simulationVersion: number; terminationReason: string; elapsedTicks: number }
    expect(typeof snapshotArg.simulationVersion).toBe('number')
    expect(snapshotArg.simulationVersion).toBeGreaterThanOrEqual(1)
    expect(snapshotArg.terminationReason).toBe('elimination')
    expect(snapshotArg.elapsedTicks).toBe(2)
  })

  it('returns simulationVersion in the response', async () => {
    mockPersist.mockResolvedValue('battle-1')
    const result = await executeAttack(
      makeAuthClient('user-1'), 'user-1', UUID, '550e8400-e29b-41d4-a716-446655440001', 42
    )
    expect(result.simulationVersion).toBeDefined()
    expect(result.simulationVersion).toBeGreaterThanOrEqual(1)
    expect(result.terminationReason).toBe('elimination')
    expect(result.elapsedTicks).toBe(2)
  })

  it('persists and returns combat metrics with the battle snapshot', async () => {
    mockPersist.mockResolvedValue('battle-1')
    const result = await executeAttack(
      makeAuthClient('user-1'), 'user-1', UUID, '550e8400-e29b-41d4-a716-446655440001', 42
    )

    const snapshotArg = mockPersist.mock.calls[0]![1] as { metrics: Record<string, unknown> }
    expect(snapshotArg.metrics.firstAttackTick).toBe(1)
    expect(snapshotArg.metrics.damageByUnitType).toEqual({ marine: 10 })
    expect(result.metrics?.firstAttackTick).toBe(1)
  })

  it('runs PvP simulation with metrics tracking enabled', async () => {
    mockPersist.mockResolvedValue('battle-1')
    await executeAttack(
      makeAuthClient('user-1'), 'user-1', UUID, '550e8400-e29b-41d4-a716-446655440001', 42
    )

    expect(mockSimulateBattle).toHaveBeenCalledWith(
      expect.any(Array),
      expect.any(Array),
      42,
      [],
      [],
      [],
      expect.objectContaining({
        engine: 'ecs',
        maxTicks: 1000,
        profile: true,
        timeoutPolicy: 'defender_holds',
        trackMetrics: true,
      })
    )
  })
})

describe('executeAttack — contract: cooldown enforcement', () => {
  it('first attack proceeds when no prior battle exists', async () => {
    mockGetCooldown.mockResolvedValue(0)
    mockPersist.mockResolvedValue('battle-1')

    const result = await executeAttack(
      makeAuthClient('user-1'), 'user-1', UUID, '550e8400-e29b-41d4-a716-446655440001', 1
    )
    expect(result.success).toBe(true)
    expect(result.cooldownRemaining).toBeUndefined()
  })

  it('second attack within cooldown is rejected', async () => {
    mockGetCooldown.mockResolvedValue(20)

    const result = await executeAttack(
      makeAuthClient('user-1'), 'user-1', UUID, '550e8400-e29b-41d4-a716-446655440001', 1
    )
    expect(result.success).toBe(false)
    expect(result.cooldownRemaining).toBe(20)
    expect(result.error).toContain('cooldown')
    expect(mockPersist).not.toHaveBeenCalled()
  })

  it('cooldown query is scoped to the attacker colony (not defender)', async () => {
    mockGetCooldown.mockResolvedValue(0)
    mockPersist.mockResolvedValue('battle-1')

    await executeAttack(
      makeAuthClient('user-1'), 'user-1', UUID, '550e8400-e29b-41d4-a716-446655440001', 1
    )
    expect(mockGetCooldown).toHaveBeenCalledWith(UUID, ATTACK_COOLDOWN_SECONDS)
  })
})

describe('executeAttack — contract: ownership/placement', () => {
  it('rejects placement ids that are not in the attacker units', async () => {
    mockGetCooldown.mockResolvedValue(0)
    mockPersist.mockResolvedValue('battle-1')

    const result = await executeAttack(
      makeAuthClient('user-1'), 'user-1', UUID, '550e8400-e29b-41d4-a716-446655440001', 1,
      [{ unitId: '00000000-0000-0000-0000-000000000099', x: 0, y: 16 }]
    )
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/do not own/i)
  })
})
