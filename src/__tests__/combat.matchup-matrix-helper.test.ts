import { describe, expect, it } from 'vitest'
import type { BattleResult } from '@/domains/combat/combat.types'
import type { SimUnit } from '@/domains/combat/combat.sim.types'
import { aggregateMatchupSamples, type MatchupSample } from './helpers/combat-matchup-matrix'
import { evaluateTier1MatchupAcrossSeeds } from './helpers/combat-tier1-matchup'
import type { CombatBalanceScenario } from '@/domains/combat/combat.tier1-scenarios'

describe('combat matchup matrix helpers', () => {
  it('classifies role-team wins, losses, and draws', () => {
    const matrix = aggregateMatchupSamples([
      sample('mirrored', 2, 'defender', 'defender'),
      sample('normal', 1, 'attacker', 'defender'),
      sample('normal', 2, 'attacker', 'draw'),
      sample('mirrored', 1, 'defender', 'attacker'),
    ])

    expect(matrix.normal).toMatchObject({ runs: 2, wins: 0, losses: 1, draws: 1 })
    expect(matrix.mirrored).toMatchObject({ runs: 2, wins: 1, losses: 1, draws: 0 })
    expect(matrix.combined).toMatchObject({ runs: 4, wins: 1, losses: 2, draws: 1 })
  })

  it('uses standard medians for new metrics and upper-middle for winning ratios', () => {
    const samples = [
      sampleWithStats('normal', 1, 'attacker', 'attacker', 1, 0.1, 10),
      sampleWithStats('normal', 2, 'attacker', 'attacker', 2, 0.3, 20),
      sampleWithStats('normal', 3, 'attacker', 'attacker', 3, 0.5, 30),
      sampleWithStats('normal', 4, 'attacker', 'defender', 4, 0.7, 40),
    ]
    const summary = aggregateMatchupSamples(samples).normal

    expect(summary.medianRoleRemainingPower).toBe(2.5)
    expect(summary.medianRoleRemainingHpRatio).toBe(0.4)
    expect(summary.medianWinningRemainingHpRatio).toBe(0.3)
    expect(summary.medianDurationTicks).toBe(25)
  })

  it('uses the middle value for an odd duration median', () => {
    const summary = aggregateMatchupSamples([
      sampleWithStats('normal', 1, 'attacker', 'attacker', 1, 0.1, 9),
      sampleWithStats('normal', 2, 'attacker', 'attacker', 2, 0.2, 3),
      sampleWithStats('normal', 3, 'attacker', 'attacker', 3, 0.3, 7),
    ]).normal

    expect(summary.medianDurationTicks).toBe(7)
  })

  it('returns null for a matrix with zero wins', () => {
    const summary = aggregateMatchupSamples([
      sampleWithStats('normal', 1, 'attacker', 'defender', 1, 0.2),
      sampleWithStats('normal', 2, 'attacker', 'draw', 2, 0.4),
    ]).normal

    expect(summary.wins).toBe(0)
    expect(summary.medianWinningRemainingHpRatio).toBeNull()
  })

  it('handles an all-draw matrix', () => {
    const summary = aggregateMatchupSamples([
      sample('normal', 1, 'attacker', 'draw', 8),
      sample('normal', 2, 'attacker', 'draw', 12),
      sample('mirrored', 1, 'defender', 'draw', 10),
    ]).combined

    expect(summary).toMatchObject({
      runs: 3,
      wins: 0,
      losses: 0,
      draws: 3,
      winRate: 0,
      medianWinningRemainingHpRatio: null,
      medianDurationTicks: 10,
    })
  })

  it('calculates a signed normal-minus-mirrored orientation delta', () => {
    const matrix = aggregateMatchupSamples([
      sample('normal', 1, 'attacker', 'attacker'),
      sample('normal', 2, 'attacker', 'attacker'),
      sample('mirrored', 1, 'defender', 'defender'),
      sample('mirrored', 2, 'defender', 'attacker'),
    ])

    expect(matrix.orientationWinRateDelta).toBe(0.5)
  })

  it('keeps canonical ordering and Tier 1 adapter contracts independent of callback order', () => {
    const scenario = syntheticScenario()
    const calls: Array<{ attackers: string; defenders: string; seed: number; obstacles: number }> = []
    const matrix = evaluateTier1MatchupAcrossSeeds({
      scenario,
      seeds: [202, 101],
      runBattle: (attackers, defenders, seed, obstacles) => {
        calls.push({ attackers: attackers[0]?.id ?? '', defenders: defenders[0]?.id ?? '', seed, obstacles: obstacles.length })
        return result(seed === 101 ? 'attacker' : 'draw', seed)
      },
    })

    expect(matrix.samples.map(sample => `${sample.seed}:${sample.orientation}`)).toEqual([
      '101:normal', '101:mirrored', '202:normal', '202:mirrored',
    ])
    expect(calls).toEqual([
      { attackers: 'a', defenders: 'd', seed: 202, obstacles: 0 },
      { attackers: 'mirror-d', defenders: 'mirror-a', seed: 202, obstacles: 0 },
      { attackers: 'a', defenders: 'd', seed: 101, obstacles: 0 },
      { attackers: 'mirror-d', defenders: 'mirror-a', seed: 101, obstacles: 0 },
    ])
  })
})

function sample(orientation: 'normal' | 'mirrored', seed: number, roleTeam: 'attacker' | 'defender', winner: BattleResult['winner'], durationTicks = 1): MatchupSample {
  return { orientation, seed, roleTeam, winner, durationTicks, roleRemainingPower: 0, roleRemainingHpRatio: 0 }
}

function sampleWithStats(orientation: 'normal' | 'mirrored', seed: number, roleTeam: 'attacker' | 'defender', winner: BattleResult['winner'], power: number, hpRatio: number, durationTicks = 1): MatchupSample {
  return {
    orientation,
    seed,
    roleTeam,
    winner,
    durationTicks,
    roleRemainingPower: power,
    roleRemainingHpRatio: hpRatio,
  }
}

function result(winner: BattleResult['winner'], seed: number, power = 0, hpRatio = 0): BattleResult {
  const survivor = power === 0 && hpRatio === 0
    ? []
    : [{ team: 'attacker', hp: power, maxHp: 1 } as unknown as SimUnit]
  const initialMaxHp = power === 0 ? 0 : power / hpRatio
  const initialState = initialMaxHp === 0
    ? []
    : [{ team: 'attacker', maxHp: initialMaxHp } as unknown as SimUnit]
  return {
    winner,
    logs: [],
    seed,
    survivors: survivor,
    initialState,
    terminationReason: 'elimination',
    elapsedTicks: 1,
    simulationVersion: 9,
    simulationRevision: 'synthetic',
  }
}

function syntheticScenario(): CombatBalanceScenario {
  const row = (id: string, team: 'attacker' | 'defender') => ({
    id,
    colony_id: team,
    unit_type: 'marine' as const,
    hp_current: 1,
    tier: 1,
    upgrade_path: [],
    grid_x: '1',
    grid_y: '1',
  })
  return { id: 'synthetic', name: 'Synthetic', attackers: [row('a', 'attacker')], defenders: [row('d', 'defender')] }
}
