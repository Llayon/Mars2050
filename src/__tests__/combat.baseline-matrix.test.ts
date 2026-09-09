import { describe, expect, it } from 'vitest'
import { simulateBattle } from '@/domains/combat/combat.engine'
import type { UnitRow } from '@/domains/combat/combat.types'
import { generateObstacles } from '@/domains/combat/combat.utils'

function makeUnit(id: string, team: 'attacker' | 'defender', unitType: string, gridX?: number, gridY?: number): UnitRow {
  return {
    id,
    colony_id: 'colony_1',
    unit_type: unitType,
    hp_current: 100,
    tier: 1,
    upgrade_path: [],
    grid_x: gridX !== undefined ? String(gridX) : undefined,
    grid_y: gridY !== undefined ? String(gridY) : undefined,
  } as UnitRow
}

describe('combat baseline matrix', () => {
  it('handles missing X only deterministically', () => {
    const attackers = [makeUnit('att-1', 'attacker', 'marine', undefined, 1000)]
    const defenders = [makeUnit('def-1', 'defender', 'marine', 300, 100)]
    const res1 = simulateBattle(attackers, defenders, 4242)
    const res2 = simulateBattle(
      [makeUnit('att-1', 'attacker', 'marine', undefined, 1000)],
      [makeUnit('def-1', 'defender', 'marine', 300, 100)],
      4242
    )

    expect(res1.winner).toBe(res2.winner)
    expect(res1.elapsedTicks).toBe(res2.elapsedTicks)
    expect(res1.logs).toEqual(res2.logs)
    expect(res1.initialState[0].x).toBe(res2.initialState[0].x)
  })

  it('handles missing Y only deterministically', () => {
    const attackers = [makeUnit('att-1', 'attacker', 'marine', 250, undefined)]
    const defenders = [makeUnit('def-1', 'defender', 'marine', 250, undefined)]
    const res1 = simulateBattle(attackers, defenders, 5555)
    const res2 = simulateBattle(
      [makeUnit('att-1', 'attacker', 'marine', 250, undefined)],
      [makeUnit('def-1', 'defender', 'marine', 250, undefined)],
      5555
    )

    expect(res1.winner).toBe(res2.winner)
    expect(res1.elapsedTicks).toBe(res2.elapsedTicks)
    expect(res1.logs).toEqual(res2.logs)
    expect(res1.initialState[0].y).toBe(res2.initialState[0].y)
    expect(res1.initialState[1].y).toBe(res2.initialState[1].y)
  })

  it('handles missing both coordinates deterministically', () => {
    const attackers = [makeUnit('att-1', 'attacker', 'marine')]
    const defenders = [makeUnit('def-1', 'defender', 'marine')]
    const res1 = simulateBattle(attackers, defenders, 9999)
    const res2 = simulateBattle(
      [makeUnit('att-1', 'attacker', 'marine')],
      [makeUnit('def-1', 'defender', 'marine')],
      9999
    )

    expect(res1.winner).toBe(res2.winner)
    expect(res1.elapsedTicks).toBe(res2.elapsedTicks)
    expect(res1.logs).toEqual(res2.logs)
    expect(res1.initialState[0].x).toBe(res2.initialState[0].x)
    expect(res1.initialState[0].y).toBe(res2.initialState[0].y)
  })

  it('handles provided vs generated obstacles deterministically', () => {
    const seed = 12345
    const generated = generateObstacles(seed)
    const attackers = [makeUnit('att-1', 'attacker', 'sniper', 200, 950)]
    const defenders = [makeUnit('def-1', 'defender', 'sniper', 400, 150)]

    const resGenerated = simulateBattle(attackers, defenders, seed)
    const resProvided = simulateBattle(
      [makeUnit('att-1', 'attacker', 'sniper', 200, 950)],
      [makeUnit('def-1', 'defender', 'sniper', 400, 150)],
      seed,
      generated
    )

    expect(resGenerated.winner).toBe(resProvided.winner)
    expect(resGenerated.elapsedTicks).toBe(resProvided.elapsedTicks)
    expect(resGenerated.obstacles).toEqual(resProvided.obstacles)
    expect(resGenerated.logs).toEqual(resProvided.logs)
  })

  it('handles global effects deterministically', () => {
    const attackers = [makeUnit('att-1', 'attacker', 'marine', 300, 900)]
    const defenders = [makeUnit('def-1', 'defender', 'marine', 300, 100)]
    const seed = 7777

    const res1 = simulateBattle(
      attackers,
      defenders,
      seed,
      [],
      ['orbital_strike', 'mass_shield'],
      ['global_emp', 'mass_heal']
    )
    const res2 = simulateBattle(
      [makeUnit('att-1', 'attacker', 'marine', 300, 900)],
      [makeUnit('def-1', 'defender', 'marine', 300, 100)],
      seed,
      [],
      ['orbital_strike', 'mass_shield'],
      ['global_emp', 'mass_heal']
    )

    expect(res1.winner).toBe(res2.winner)
    expect(res1.elapsedTicks).toBe(res2.elapsedTicks)
    expect(res1.logs).toEqual(res2.logs)
  })

  it('handles combat with drone carrier summon deterministically', () => {
    const attackers = [makeUnit('att-carrier', 'attacker', 'drone_carrier', 300, 900)]
    const defenders = [makeUnit('def-target', 'defender', 'marine', 300, 200)]
    const seed = 8888

    const res1 = simulateBattle(attackers, defenders, seed)
    const res2 = simulateBattle(
      [makeUnit('att-carrier', 'attacker', 'drone_carrier', 300, 900)],
      [makeUnit('def-target', 'defender', 'marine', 300, 200)],
      seed
    )

    expect(res1.winner).toBe(res2.winner)
    expect(res1.elapsedTicks).toBe(res2.elapsedTicks)
    expect(res1.logs).toEqual(res2.logs)
    const summonAction = res1.logs.flatMap(l => l.actions).find(a => a.type === 'spawn')
    expect(summonAction).toBeDefined()
  })
})
