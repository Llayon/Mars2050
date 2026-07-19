import { describe, expect, it } from 'vitest'
import type { SimUnit } from '@/domains/combat/combat.sim.types'
import { createRuntimeUnitFromConfig } from '@/domains/combat/combat.unit-factory'
import { createEcsCombatRuntime } from '@/domains/combat/ecs/combat-ecs-runtime'

function unit(id: string): SimUnit {
  return createRuntimeUnitFromConfig({
    id,
    team: 'attacker',
    type: 'marine',
    x: 100,
    y: 500,
    currentAngle: 0,
  })!
}

describe('combat ECS serialization boundary', () => {
  it('serializes snapshots and survivors from canonical components', () => {
    const alive = unit('canonical-alive')
    alive.hp -= 10
    const temporary = unit('canonical-temporary')
    temporary.isTemporary = true
    temporary.temporaryDuration = 20
    const dead = unit('canonical-dead')
    dead.hp = 0
    dead.isDead = true
    const runtime = createEcsCombatRuntime()
    runtime.units.push(alive, temporary, dead)
    runtime.flushStructuralCommands()
    const canonicalAliveHp = alive.hp

    alive.hp = 0
    alive.isDead = true
    alive.isTemporary = true
    temporary.isTemporary = false
    dead.hp = dead.maxHp
    dead.isDead = false

    const snapshot = runtime.snapshotUnits()
    const survivors = runtime.getSurvivors()

    expect(snapshot).toHaveLength(3)
    expect(snapshot[0]).toMatchObject({
      id: 'canonical-alive',
      hp: canonicalAliveHp,
      isDead: false,
      isTemporary: undefined,
    })
    expect(snapshot[1]).toMatchObject({
      id: 'canonical-temporary',
      isTemporary: true,
      temporaryDuration: 20,
    })
    expect(snapshot[2]).toMatchObject({
      id: 'canonical-dead',
      hp: 0,
      isDead: true,
    })
    expect(survivors.map(candidate => candidate.id))
      .toEqual(['canonical-alive'])
  })
})
