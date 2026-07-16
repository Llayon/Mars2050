import { describe, expect, it } from 'vitest'
import { MAX_TICKS } from '@/domains/combat/combat.config'
import { simulateBattle } from '@/domains/combat/combat.engine'
import { getTerminalBattleWinner } from '@/domains/combat/combat.outcome'
import { getCombatTurnOrder } from '@/domains/combat/combat.turn-order'
import type { SimUnit, Team, UnitRow } from '@/domains/combat/combat.types'

function makeUnit(id: string, team: Team, speed: number): SimUnit {
  return {
    id,
    team,
    type: 'marine',
    hp: 100,
    maxHp: 100,
    attack: 10,
    defense: 0,
    speed,
    range: 120,
    attackType: 'single',
    actionCooldownMax: 10,
    actionCooldown: 0,
    isFlying: false,
    canTargetAir: false,
    x: 0,
    y: 0,
    isDead: false,
    turnSpeed: 10,
    currentAngle: 0,
    size: 'S',
    shield: 0,
    maxShield: 0,
    statusEffects: [],
    aggroLockTicks: 0,
    velocity: { x: 0, y: 0 },
  }
}

describe('combat turn order', () => {
  it('keeps speed priority while alternating equal-speed initiative', () => {
    const units = [
      makeUnit('a0', 'attacker', 20),
      makeUnit('a1', 'attacker', 20),
      makeUnit('a2', 'attacker', 20),
      makeUnit('d0', 'defender', 20),
      makeUnit('d1', 'defender', 20),
      makeUnit('d2', 'defender', 20),
      makeUnit('a-slow', 'attacker', 10),
      makeUnit('d-slow', 'defender', 10),
    ]

    expect(getCombatTurnOrder(units).map(unit => unit.id)).toEqual([
      'a0', 'd0', 'd1', 'a1', 'a2', 'd2', 'a-slow', 'd-slow',
    ])
  })

  it('bounds first-strike residue in a mirrored six-squad rifle battle', () => {
    const result = simulateBattle(makeMarineRows('attacker'), makeMarineRows('defender'), 12345, [], [], [], { trackMetrics: true })
    const attackerSurvivors = result.survivors.filter(unit => unit.team === 'attacker').length
    const defenderSurvivors = result.survivors.filter(unit => unit.team === 'defender').length

    expect(attackerSurvivors + defenderSurvivors).toBeLessThanOrEqual(4)
    expect(result.metrics?.battleDurationTicks ?? MAX_TICKS).toBeLessThan(MAX_TICKS)
  })

  it('resolves an unreachable zero-damage support stalemate by offensive power', () => {
    const marine = makeUnit('marine', 'attacker', 10)
    const scout = makeUnit('scout', 'defender', 20)
    scout.attack = 0
    scout.isFlying = true
    scout.markOnHit = { duration: 20, damageMultiplier: 1.25, sharedDamage: true }

    expect(getTerminalBattleWinner([marine, scout], [], false, false)).toBe('attacker')
    marine.canTargetAir = true
    expect(getTerminalBattleWinner([marine, scout], [], false, false)).toBeNull()

    const alliedScout = { ...scout, id: 'allied-scout', team: 'attacker' as const }
    expect(getTerminalBattleWinner([alliedScout, scout], [], false, false)).toBe('draw')
  })
})

function makeMarineRows(team: Team): UnitRow[] {
  const y = team === 'attacker' ? [930, 1050] : [270, 150]
  return Array.from({ length: 6 }, (_, index) => ({
    id: `${team}-${index}`,
    colony_id: team,
    unit_type: 'marine',
    hp_current: 35,
    tier: 1,
    upgrade_path: [],
    grid_x: String([90, 210, 330, 450, 570][index % 5]),
    grid_y: String(y[Math.floor(index / 5)]),
  }))
}
