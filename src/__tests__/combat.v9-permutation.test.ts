import { describe, expect, it } from 'vitest'
import { simulateBattle } from '@/domains/combat/combat.engine'
import type { UnitRow } from '@/domains/combat/combat.types'
import { resolveDefenseBatch, type DamageClaim, type DefenseBatchSnapshot } from '@/domains/combat/ecs/defense-batch'

function nextRandom(state: { value: number }): number {
  state.value = (Math.imul(state.value, 1664525) + 1013904223) >>> 0
  return state.value / 0x1_0000_0000
}

function shuffle<T>(items: readonly T[], state: { value: number }): T[] {
  const result = [...items]
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(nextRandom(state) * (index + 1))
    const current = result[index]!
    result[index] = result[swap]!
    result[swap] = current
  }
  return result
}

function claim(source: string, ordinal: number, target = 'target:0'): DamageClaim {
  return {
    order: { originExternalId: `ability:${source}`, authoredOrdinal: ordinal, targetExternalId: target, sourceExternalId: source },
    originExternalId: `ability:${source}`,
    authoredOrdinal: ordinal,
    targetExternalId: target,
    sourceExternalId: source,
    rawDamage: 11 + ordinal,
    attackerModifiers: { shieldDamageMult: 1, summonCounterDamageMult: 1, lifestealMult: 0, executeThreshold: 0 },
    sourceAliveAtGroupStart: true,
  }
}

function frame(targetOrder: readonly string[]): DefenseBatchSnapshot {
  const targets = new Map(targetOrder.map(id => [id, {
    externalId: id,
    hp: 100,
    armor: 2,
    shield: id === 'target:0' ? 9 : 0,
    shieldHitBlockCharges: 1,
    reactiveArmorCharges: 1,
    reactiveArmorBlock: 2,
  }]))
  return {
    targetsByExternalId: targets,
    barriersByExternalId: new Map([['barrier:0', {
      externalId: 'barrier:0', capacity: 13, damageReduction: 0.2,
      coveredTargetExternalIds: ['target:0', 'target:1'],
    }]]),
  }
}

const integrationRows = (order: readonly string[]): UnitRow[] => order.map(id => {
  const index = Number(id.slice(2))
  const attacker = id.startsWith('a')
  return {
  id,
  colony_id: attacker ? 'a' : 'd',
  unit_type: 'turret',
  hp_current: 200,
  grid_x: String(index % 2 === 0 ? 100 + index * 20 : 100 + index * 20),
  grid_y: attacker ? '100' : '106',
  tier: 1,
  upgrade_path: [],
  }
})

function integrationFingerprint(order: readonly string[], mode: 'v8_sequential' | 'v9_snapshot'): string {
  const attackers = integrationRows(order.filter(id => id.startsWith('a')))
  const defenders = integrationRows(order.filter(id => id.startsWith('d')))
  const result = simulateBattle(attackers, defenders, 24680, [], [], [], { defenseResolutionMode: mode, maxTicks: 4 })
  const normalizeUnits = (units: readonly unknown[]) => [...units].sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)))
  const normalizeLogs = result.logs.map(tick => ({ ...tick, actions: [...tick.actions].sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right))) }))
  return JSON.stringify({
    winner: result.winner,
    logs: normalizeLogs,
    initialState: normalizeUnits(result.initialState),
    survivors: normalizeUnits(result.survivors),
    elapsedTicks: result.elapsedTicks,
    terminationReason: result.terminationReason,
  })
}

describe('V9 seeded permutation contracts', () => {
  it('keeps pure defense resolution stable across 100 seeded permutations', () => {
    const claims = Array.from({ length: 8 }, (_, index) => claim(`source:${index % 3}`, index))
    const baseline = resolveDefenseBatch(frame(['target:0', 'target:1']), claims)
    for (let permutation = 0; permutation < 100; permutation += 1) {
      const state = { value: 0x51f15e + permutation }
      const actual = resolveDefenseBatch(frame(shuffle(['target:0', 'target:1'], state)), shuffle(claims, state))
      expect({ seed: state.value, permutation, actual }).toEqual({ seed: state.value, permutation, actual: baseline })
    }
  })

  it('keeps integration replay stable across 25 seeded input permutations', () => {
    const ids = ['a:0', 'a:1', 'd:0', 'd:1']
    const baselineV8 = integrationFingerprint(ids, 'v8_sequential')
    const baselineV9 = integrationFingerprint(ids, 'v9_snapshot')
    for (let permutation = 0; permutation < 25; permutation += 1) {
      const state = { value: 0x7a11 + permutation }
      const order = shuffle(ids, state)
      expect({ seed: state.value, permutation, mode: 'v8' as const, fingerprint: integrationFingerprint(order, 'v8_sequential') }).toEqual({ seed: state.value, permutation, mode: 'v8' as const, fingerprint: baselineV8 })
      expect({ seed: state.value, permutation, mode: 'v9' as const, fingerprint: integrationFingerprint(order, 'v9_snapshot') }).toEqual({ seed: state.value, permutation, mode: 'v9' as const, fingerprint: baselineV9 })
    }
  }, 30_000)
})
