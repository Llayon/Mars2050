import { describe, expect, it } from 'vitest'
import { mapCombatRunResultToBattleResult } from '@/domains/combat/combat.compat-mapper'
import type { CombatRunResult } from '@mars2050/combat-core/contracts'

describe('combat.compat-mapper DTO boundary', () => {
  it('maps CombatRunResult to BattleResult without casts or options bypass', () => {
    const rawResult: CombatRunResult = {
      winner: 'attacker',
      seed: 42,
      elapsedTicks: 15,
      terminationReason: 'elimination',
      initialState: [
        {
          id: 'u1',
          team: 'attacker',
          type: 'marine',
          x: 100,
          y: 200,
          hp: 50,
          maxHp: 50,
          _ecsInternalSentinel: 'DO_NOT_LEAK',
        },
      ],
      survivors: [
        {
          id: 'u1',
          team: 'attacker',
          type: 'marine',
          x: 120,
          y: 210,
          hp: 35,
          maxHp: 50,
          _ecsInternalSentinel: 'DO_NOT_LEAK',
        },
      ],
      logs: [
        {
          tick: 1,
          actions: [
            {
              unitId: 'u1',
              type: 'attack',
              targetId: 'u2',
              damage: 15,
              _actionInternalSentinel: 'DO_NOT_LEAK',
            },
          ],
        },
      ],
      engineVersion: 9,
      engineRevision: 'combat-ecs-v9',
      metrics: {
        totalDamageDealt: 15,
      },
    }

    const battleResult = mapCombatRunResultToBattleResult(rawResult, [])

    // Output is structured as BattleResult
    expect(battleResult.winner).toBe('attacker')
    expect(battleResult.seed).toBe(42)
    expect(battleResult.elapsedTicks).toBe(15)
    expect(battleResult.simulationVersion).toBe(9)
    expect(battleResult.simulationRevision).toBe('combat-ecs-v9')

    // InitialState and survivors are clean DTOs with sentinels stripped
    expect(battleResult.initialState.length).toBe(1)
    expect(battleResult.initialState[0].id).toBe('u1')
    expect('_ecsInternalSentinel' in (battleResult.initialState[0] as Record<string, unknown>)).toBe(false)

    expect(battleResult.survivors.length).toBe(1)
    expect(battleResult.survivors[0].hp).toBe(35)
    expect('_ecsInternalSentinel' in (battleResult.survivors[0] as Record<string, unknown>)).toBe(false)

    // Logs are clean BattleTicks with sentinels stripped
    expect(battleResult.logs[0].actions.length).toBe(1)
    expect(battleResult.logs[0].actions[0].type).toBe('attack')
    expect('_actionInternalSentinel' in (battleResult.logs[0].actions[0] as unknown as Record<string, unknown>)).toBe(false)

    // Metrics are populated from top-level metrics
    expect(battleResult.metrics).toBeDefined()
    expect((battleResult.metrics as unknown as Record<string, unknown>).totalDamageDealt).toBe(15)
  })
})
