import { describe, expect, it } from 'vitest'
import type { BattleAction } from '@/domains/combat/combat.actions'
import { processSpawnAction } from '@/domains/combat/combat.systems.utils'
import type { SimHazard, SimUnit, Team } from '@/domains/combat/combat.types'
import { PRNG } from '@/domains/combat/combat.utils'
import { createEcsCombatRuntime } from '@/domains/combat/ecs/combat-ecs-runtime'

function makeUnit(overrides: Partial<SimUnit> & { id: string; team: Team }): SimUnit {
  return {
    type: 'marine',
    hp: 100,
    maxHp: 100,
    attack: 10,
    defense: 0,
    speed: 10,
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
    ...overrides,
  }
}

describe('combat decoys', () => {
  it('spawns hologram decoys as temporary zero-damage exosuit copies', () => {
    const projector = makeUnit({
      id: 'projector',
      team: 'attacker',
      type: 'hologram_projector',
      attackType: 'spawn',
      spawnType: 'exosuit',
    })
    const target = makeUnit({ id: 'target', team: 'defender', x: 80, y: 0 })
    const units = [projector, target]
    const actions: BattleAction[] = []
    const hazards: SimHazard[] = []

    const spawned = processSpawnAction(projector, target, units, actions, new PRNG(1))
    const decoy = units.find(unit => unit.id.startsWith('spawn_'))

    expect(spawned).toBe(true)
    expect(decoy).toMatchObject({
      type: 'exosuit',
      hp: 35,
      maxHp: 35,
      attack: 0,
      isTemporary: true,
      temporaryDuration: 80,
    })
    expect(hazards).toEqual([])
    expect(actions[0]).toMatchObject({ unitId: 'projector', type: 'spawn', spawnType: 'exosuit', spawnMaxHp: 35 })
  })

  it('expires temporary decoys deterministically', () => {
    const decoy = makeUnit({
      id: 'decoy',
      team: 'attacker',
      type: 'exosuit',
      isTemporary: true,
      temporaryDuration: 1,
    })
    const actions: BattleAction[] = []
    const runtime = createEcsCombatRuntime()
    runtime.world.roster.push(decoy)
    runtime.flushStructuralCommands()

    runtime.tickModifiers(0, 0.1, actions, new PRNG(1))

    expect(runtime.world.stores.vitality.require(0).isDead).toBe(true)
    expect(actions).toEqual([{ unitId: 'decoy', type: 'die', cause: 'expiration' }])
  })
})
