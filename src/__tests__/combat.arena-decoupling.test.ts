import { describe, expect, it } from 'vitest'
import { createPathfindingMap, getFlowVector } from '@mars2050/combat-core/math'
import { simulateBattle } from '../domains/combat/combat.engine'
import { executeCombatSimulation } from '../domains/combat/combat.runner'
import type { UnitRow } from '../domains/combat/combat.types'
import type { BattleInput } from '@mars2050/combat-core/contracts'

describe('Combat Arena Decoupling (Milestone E4)', () => {
  describe('Pathfinding Decoupling', () => {
    it('creates flow field matching custom arena dimensions', () => {
      const customArena = { width: 300, height: 500, tileSize: 50 }
      const expectedCols = Math.ceil(300 / 50)
      const expectedRows = Math.ceil(500 / 50)
      const obstacles = [{ x: 150, y: 250, radius: 40 }]

      const map = createPathfindingMap(obstacles, customArena)

      expect(map.cols).toBe(expectedCols)
      expect(map.rows).toBe(expectedRows)
      expect(map.tileSize).toBe(50)
      expect(map.costField.length).toBe(expectedCols * expectedRows)

      const angle = getFlowVector(map, 50, 50, 250, 450)
      expect(angle).not.toBeNull()
      expect(typeof angle).toBe('number')
      expect(Number.isFinite(angle)).toBe(true)
    })

    it('falls back gracefully to Martian default dimensions when arena is omitted', () => {
      const map = createPathfindingMap([])
      expect(map.cols).toBe(15)
      expect(map.rows).toBe(30)
      expect(map.tileSize).toBe(40)
      expect(map.costField.length).toBe(15 * 30)
    })
  })

  describe('Battle Simulation with Custom Arenas', () => {
    const attackers: UnitRow[] = [
      { colony_id: 'c1', hp_current: 100, id: 'att_1', unit_type: 'marine', grid_x: '100', grid_y: '400' },
    ]
    const defenders: UnitRow[] = [
      { colony_id: 'c1', hp_current: 100, id: 'def_1', unit_type: 'marine', grid_x: '100', grid_y: '100' },
    ]

    it('produces identical results when standard Mars arena is passed explicitly vs default', () => {
      const seed = 424242
      const defaultResult = simulateBattle(attackers, defenders, seed, [])
      const explicitResult = simulateBattle(attackers, defenders, seed, [], [], [], {
        arena: { width: 600, height: 1200, tileSize: 40, obstacles: [] },
      })

      expect(explicitResult.winner).toBe(defaultResult.winner)
      expect(explicitResult.elapsedTicks).toBe(defaultResult.elapsedTicks)
      expect(explicitResult.logs).toEqual(defaultResult.logs)
      expect(explicitResult.initialState).toEqual(defaultResult.initialState)
    })

    it('clamps unit positions and movement within a smaller custom arena', () => {
      const smallArena = { width: 250, height: 400, tileSize: 25, obstacles: [] }
      const customAttackers: UnitRow[] = [
        { colony_id: 'c1', hp_current: 100, id: 'att_small', unit_type: 'marine', grid_x: '120', grid_y: '300' },
      ]
      const customDefenders: UnitRow[] = [
        { colony_id: 'c1', hp_current: 100, id: 'def_small', unit_type: 'marine', grid_x: '120', grid_y: '80' },
      ]

      const result = simulateBattle(customAttackers, customDefenders, 99999, [], [], [], {
        arena: smallArena,
        maxTicks: 100,
      })

      expect(result.initialState.length).toBeGreaterThan(0)
      for (const unit of result.initialState) {
        expect(unit.x).toBeGreaterThanOrEqual(0)
        expect(unit.x).toBeLessThanOrEqual(smallArena.width)
        expect(unit.y).toBeGreaterThanOrEqual(0)
        expect(unit.y).toBeLessThanOrEqual(smallArena.height)
      }

      for (const tick of result.logs) {
        for (const action of tick.actions) {
          if (action.type === 'move' || action.type === 'knockback') {
            if (action.toX !== undefined) {
              expect(action.toX).toBeGreaterThanOrEqual(0)
              expect(action.toX).toBeLessThanOrEqual(smallArena.width)
            }
            if (action.toY !== undefined) {
              expect(action.toY).toBeGreaterThanOrEqual(0)
              expect(action.toY).toBeLessThanOrEqual(smallArena.height)
            }
          }
        }
      }
    })

    it('runs alternating arenas of different sizes without leaking state', () => {
      const arenaSmall = { width: 300, height: 500, tileSize: 25, obstacles: [] }
      const arenaLarge = { width: 900, height: 1500, tileSize: 50, obstacles: [] }
      const seed = 777123

      const unitsA: UnitRow[] = [
        { colony_id: 'c1', hp_current: 100, id: 'a1', unit_type: 'marine', grid_x: '150', grid_y: '350' },
      ]
      const unitsD: UnitRow[] = [
        { colony_id: 'c1', hp_current: 100, id: 'd1', unit_type: 'marine', grid_x: '150', grid_y: '100' },
      ]

      const run1Small = simulateBattle(unitsA, unitsD, seed, [], [], [], {
        arena: arenaSmall,
        maxTicks: 80,
      })
      const run1Large = simulateBattle(unitsA, unitsD, seed, [], [], [], {
        arena: arenaLarge,
        maxTicks: 80,
      })
      const run2Small = simulateBattle(unitsA, unitsD, seed, [], [], [], {
        arena: arenaSmall,
        maxTicks: 80,
      })
      const run2Large = simulateBattle(unitsA, unitsD, seed, [], [], [], {
        arena: arenaLarge,
        maxTicks: 80,
      })

      expect(run2Small.winner).toBe(run1Small.winner)
      expect(run2Small.elapsedTicks).toBe(run1Small.elapsedTicks)
      expect(run2Small.logs).toEqual(run1Small.logs)

      expect(run2Large.winner).toBe(run1Large.winner)
      expect(run2Large.elapsedTicks).toBe(run1Large.elapsedTicks)
      expect(run2Large.logs).toEqual(run1Large.logs)
    })

    it('executes simulation through combat runner with non-standard arena', () => {
      const battleInput: BattleInput = {
        seed: 12345,
        arena: {
          width: 400,
          height: 800,
          tileSize: 40,
          obstacles: [{ x: 200, y: 400, radius: 50 }],
        },
        rules: {
          maxTicks: 150,
          timeoutPolicy: 'draw',
          defenseResolutionMode: 'v9_snapshot',
        },
        scheduledEffects: [],
        definitions: {
          grunt: {
            id: 'grunt',
            name: 'Grunt',
            squadSize: 1,
            squadSpacing: 20,
            formation: 'grid',
            baseStats: {
              hp: 50,
              attack: 12,
              defense: 2,
              speed: 8,
              range: 2,
              attackType: 'single',
              actionCooldownMax: 8,
              turnSpeed: 5,
              size: 'M',
              combatTags: [],
            },
          },
        },
        units: [
          {
            instanceId: 'g_att',
            definitionId: 'grunt',
            team: 'attacker',
            rank: 1,
            upgradeIds: [],
            placement: { x: 200, y: 650 },
          },
          {
            instanceId: 'g_def',
            definitionId: 'grunt',
            team: 'defender',
            rank: 1,
            upgradeIds: [],
            placement: { x: 200, y: 150 },
          },
        ],
      }

      const result = executeCombatSimulation(battleInput)
      expect(result.seed).toBe(12345)
      expect(result.initialState.length).toBe(2)
      expect(result.initialState[0].x).toBe(200)
      expect(result.initialState[0].y).toBe(650)
      expect(result.initialState[1].x).toBe(200)
      expect(result.initialState[1].y).toBe(150)
      expect(result.logs.length).toBeGreaterThan(0)
    })
  })
})
