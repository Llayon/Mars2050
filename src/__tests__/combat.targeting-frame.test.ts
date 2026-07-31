import { describe, expect, it } from 'vitest'
import type { SimUnit } from '@/domains/combat/combat.sim.types'
import { createRuntimeUnitFromConfig } from '@/domains/combat/combat.unit-factory'
import { FIELD_HEIGHT, FIELD_WIDTH, TILE_SIZE } from '@/domains/combat/combat.utils'
import { createEcsCombatRuntime } from '@/domains/combat/ecs/combat-ecs-runtime'
import {
  createEcsMeleeEngagementState,
  runTargetingSystem,
} from '@/domains/combat/ecs/systems'

function unit(
  id: string,
  team: 'attacker' | 'defender',
  x: number,
  y = 500,
): SimUnit {
  const result = createRuntimeUnitFromConfig({
    id,
    team,
    type: 'marine',
    x,
    y,
    currentAngle: team === 'attacker' ? 0 : Math.PI,
  })!
  result.range = 300
  return result
}

function createActiveFrame(units: SimUnit[]) {
  const runtime = createEcsCombatRuntime()
  runtime.world.queueUnitCreation(...units)
  runtime.flushStructuralCommands()
  runtime.world.resources.require('entitySpatial').ensureCurrent(runtime.world)
  runtime.world.resources.require('targetingRuntime').begin(runtime.world)
  return runtime
}

function target(runtime: ReturnType<typeof createEcsCombatRuntime>, sourceId: string) {
  const source = runtime.world.getEntityId(sourceId)!
  return runTargetingSystem(
    runtime.world,
    source,
    createEcsMeleeEngagementState(),
  )
}

describe('packed targeting frame live delta', () => {
  it('matches a brute-force oracle across cells and field edges', () => {
    const runtime = createActiveFrame([
      unit('a-origin', 'attacker', 0, 0),
      unit('a-cell-edge', 'attacker', TILE_SIZE, TILE_SIZE),
      unit('d-before-edge', 'defender', TILE_SIZE - 1, TILE_SIZE),
      unit('d-after-edge', 'defender', TILE_SIZE + 1, TILE_SIZE),
      unit('d-field-edge', 'defender', FIELD_WIDTH, FIELD_HEIGHT),
    ])
    const targeting = runtime.world.resources.require('targetingRuntime')
    const cases = [
      { x: 0, y: 0, radius: TILE_SIZE, team: 'all' as const },
      { x: TILE_SIZE, y: TILE_SIZE, radius: TILE_SIZE + 1, team: 'defender' as const },
      { x: FIELD_WIDTH, y: FIELD_HEIGHT, radius: TILE_SIZE, team: 'defender' as const },
    ]

    for (const query of cases) {
      const scratch = targeting.collect(
        runtime.world, query.x, query.y, query.radius, query.team,
      )
      for (let index = 0; index < scratch.length; index++) {
        const transform = runtime.world.stores.transform.require(
          scratch.entityIds[index],
        )
        expect(scratch.distances[index]).toBeCloseTo(
          Math.hypot(transform.x - query.x, transform.y - query.y),
          10,
        )
      }
      const actual = Array.from(scratch.entityIds.slice(0, scratch.length))
        .sort((left, right) => left - right)
      const expected = [...runtime.world.query(['identity', 'transform', 'vitality'])]
        .filter(entityId => {
          const identity = runtime.world.stores.identity.require(entityId)
          const transform = runtime.world.stores.transform.require(entityId)
          return (query.team === 'all' || identity.team === query.team) &&
            Math.hypot(transform.x - query.x, transform.y - query.y) <= query.radius
        })
      expect(actual).toEqual(expected)
    }
  })

  it('uses current positions after displacement inside actor phase', () => {
    const runtime = createActiveFrame([
      unit('source', 'attacker', 100),
      unit('moved-away', 'defender', 180),
      unit('moved-near', 'defender', 460),
    ])
    runtime.world.setEntityPosition(runtime.world.getEntityId('moved-away')!, 590, 500)
    runtime.world.setEntityPosition(runtime.world.getEntityId('moved-near')!, 180, 500)

    expect(target(runtime, 'source')).toBe(runtime.world.getEntityId('moved-near'))
  })

  it('includes a unit spawned after the immutable frame was built', () => {
    const runtime = createActiveFrame([
      unit('source', 'attacker', 100),
      unit('far', 'defender', 460),
    ])
    runtime.world.queueUnitCreation(unit('spawned-near', 'defender', 180))
    runtime.flushStructuralCommands()

    expect(target(runtime, 'source')).toBe(runtime.world.getEntityId('spawned-near'))
  })

  it('uses the current team after a control transition', () => {
    const runtime = createActiveFrame([
      unit('source', 'attacker', 100),
      unit('converted', 'attacker', 180),
      unit('enemy', 'defender', 460),
    ])
    runtime.world.setEntityTeam(
      runtime.world.getEntityId('converted')!,
      'defender',
    )

    expect(target(runtime, 'source')).toBe(runtime.world.getEntityId('converted'))
  })

  it('includes a unit resurrected after frame construction', () => {
    const resurrected = unit('resurrected', 'defender', 180)
    resurrected.isDead = true
    const runtime = createActiveFrame([
      unit('source', 'attacker', 100),
      resurrected,
      unit('far', 'defender', 460),
    ])
    runtime.world.setEntityDead(runtime.world.getEntityId('resurrected')!, false)

    expect(target(runtime, 'source')).toBe(runtime.world.getEntityId('resurrected'))
  })
})
