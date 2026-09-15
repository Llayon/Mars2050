import { describe, expect, it } from 'vitest'
import type { BattleInput, UnitDefinition } from '../src/contracts/index.js'
import { simulateCombat } from '../src/facade/combat-facade.js'

function def(id: string, over: Partial<UnitDefinition['baseStats']> = {}): UnitDefinition {
  return {
    id,
    name: id,
    baseStats: {
      hp: 10000, attack: 5, defense: 0, speed: 1, range: 1,
      attackType: 'single', actionCooldownMax: 10, turnSpeed: 5,
      size: 'M', combatTags: [], ...over,
    },
    squadSize: 1, squadSpacing: 20, formation: 'grid',
  }
}

const ARENA = { width: 600, height: 1200, tileSize: 40, obstacles: [] } as const

function farApart(seed: number, policy: BattleInput['rules']['timeoutPolicy'], maxTicks: number): ReturnType<typeof simulateCombat> {
  const a = def('a')
  const b = def('b')
  return simulateCombat({
    seed,
    arena: { ...ARENA, obstacles: [] },
    rules: { maxTicks, timeoutPolicy: policy, defenseResolutionMode: 'v9_snapshot' },
    definitions: { a, b },
    units: [
      { instanceId: 'a', definitionId: 'a', team: 'attacker', placement: { x: 300, y: 1100 }, rank: 1, upgradeIds: [] },
      { instanceId: 'b', definitionId: 'b', team: 'defender', placement: { x: 300, y: 100 }, rank: 1, upgradeIds: [] },
    ],
    scheduledEffects: [],
  })
}

describe('timeout and scheduled effects as data (ISO-03, ISO-04)', () => {
  it.each([
    ['draw', 'draw'],
    ['attacker_win', 'attacker'],
    ['defender_win', 'defender'],
  ] as const)('maps timeout policy %s to winner %s with exact reason and ticks', (policy, winner) => {
    const r = farApart(201, policy, 5)
    expect(r.winner).toBe(winner)
    expect(r.terminationReason).toBe('timeout')
    expect(r.elapsedTicks).toBe(5)
  })

  it('keeps terminal elimination instead of substituting timeout', () => {
    const glass = def('glass', { hp: 10, attack: 60, speed: 8, range: 6 })
    const victim = def('victim', { hp: 10, attack: 1, speed: 1, range: 1 })
    const r = simulateCombat({
      seed: 202,
      arena: { ...ARENA, obstacles: [] },
      rules: { maxTicks: 500, timeoutPolicy: 'attacker_win', defenseResolutionMode: 'v9_snapshot' },
      definitions: { glass, victim },
      units: [
        { instanceId: 'g', definitionId: 'glass', team: 'attacker', placement: { x: 300, y: 700 }, rank: 1, upgradeIds: [] },
        { instanceId: 'v', definitionId: 'victim', team: 'defender', placement: { x: 300, y: 650 }, rank: 1, upgradeIds: [] },
      ],
      scheduledEffects: [],
    })
    expect(r.winner).toBe('attacker')
    expect(r.terminationReason).toBe('elimination')
    expect(r.elapsedTicks).toBeLessThan(500)
  })

  it('fires a scheduled strike exactly at the given tick, never early or twice', () => {
    const a = def('a')
    const b = def('b')
    const r = simulateCombat({
      seed: 203,
      arena: { ...ARENA, obstacles: [] },
      rules: { maxTicks: 200, timeoutPolicy: 'draw', defenseResolutionMode: 'v9_snapshot' },
      definitions: { a, b },
      units: [
        { instanceId: 'a', definitionId: 'a', team: 'attacker', placement: { x: 300, y: 1100 }, rank: 1, upgradeIds: [] },
        { instanceId: 'b', definitionId: 'b', team: 'defender', placement: { x: 300, y: 100 }, rank: 1, upgradeIds: [] },
      ],
      scheduledEffects: [{ id: 'strike1', tick: 5, team: 'attacker', type: 'orbital_strike', value: 10 }],
    })
    const strikes = r.logs.filter(t => t.actions.some(x => x.type === 'hazard_spawn')).map(t => t.tick)
    expect(strikes).toEqual([5])
  })

  it('fires multiple effects sharing one tick, each with source attribution', () => {
    const a = def('a', { hp: 500 })
    const b = def('b', { hp: 500 })
    const r = simulateCombat({
      seed: 204,
      arena: { ...ARENA, obstacles: [] },
      rules: { maxTicks: 200, timeoutPolicy: 'draw', defenseResolutionMode: 'v9_snapshot' },
      definitions: { a, b },
      units: [
        { instanceId: 'a', definitionId: 'a', team: 'attacker', placement: { x: 300, y: 1100 }, rank: 1, upgradeIds: [], currentHp: 100 },
        { instanceId: 'b', definitionId: 'b', team: 'defender', placement: { x: 300, y: 100 }, rank: 1, upgradeIds: [] },
      ],
      scheduledEffects: [
        { id: 'emp1', tick: 1, team: 'attacker', type: 'global_emp', value: 3 },
        { id: 'heal1', tick: 5, team: 'attacker', type: 'mass_heal', value: 40 },
      ],
    })
    const tickOf = (pred: (x: { type?: string; statusType?: string }) => boolean): number[] =>
      r.logs.filter(t => t.actions.some(x => pred(x as { type?: string; statusType?: string }))).map(t => t.tick)
    expect(tickOf(x => x.type === 'status_apply' && x.statusType === 'emp')).toContain(1)
    expect(tickOf(x => x.type === 'heal')).toContain(5)
    expect(tickOf(x => x.type === 'heal')).not.toContain(4)
  })

  it('applies mass shields at tick 0', () => {
    const a = def('a')
    const b = def('b')
    const r = simulateCombat({
      seed: 205,
      arena: { ...ARENA, obstacles: [] },
      rules: { maxTicks: 50, timeoutPolicy: 'draw', defenseResolutionMode: 'v9_snapshot' },
      definitions: { a, b },
      units: [
        { instanceId: 'a', definitionId: 'a', team: 'attacker', placement: { x: 300, y: 1100 }, rank: 1, upgradeIds: [] },
        { instanceId: 'b', definitionId: 'b', team: 'defender', placement: { x: 300, y: 100 }, rank: 1, upgradeIds: [] },
      ],
      scheduledEffects: [{ id: 'shield1', tick: 0, team: 'attacker', type: 'mass_shield', value: 60 }],
    })
    const shielded = r.survivors.filter(u => (u.maxShield ?? 0) >= 60)
    expect(shielded.length).toBeGreaterThan(0)
  })

  it('rejects unknown scheduled effect kinds instead of no-op', () => {
    const a = def('a')
    const b = def('b')
    let code = ''
    try {
      simulateCombat({
        seed: 206,
        arena: { ...ARENA, obstacles: [] },
        rules: { maxTicks: 50, timeoutPolicy: 'draw', defenseResolutionMode: 'v9_snapshot' },
        definitions: { a, b },
        units: [
          { instanceId: 'a', definitionId: 'a', team: 'attacker', placement: { x: 300, y: 1100 }, rank: 1, upgradeIds: [] },
          { instanceId: 'b', definitionId: 'b', team: 'defender', placement: { x: 300, y: 100 }, rank: 1, upgradeIds: [] },
        ],
        scheduledEffects: [{ id: 'doom', tick: 5, team: 'attacker', type: 'doom_nova', value: 10 }],
      })
    } catch (err) {
      code = (err as { code?: string }).code ?? ''
    }
    expect(code).toBe('UNSUPPORTED_SCHEDULED_EFFECT')
  })
})
