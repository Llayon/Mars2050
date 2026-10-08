import { describe, it, expect } from 'vitest'
import { simulateCombat, type BattleInput, type UnitDefinition } from '../src/index.js'
import { validateBattleInput } from '../src/combat.input-validator.js'
import { CombatWorld } from '../src/ecs/combat-world.js'
import { PRNG } from '../src/combat.utils.js'

function makeDef(id: string): UnitDefinition {
  return {
    id,
    name: id.toUpperCase(),
    squadSize: 1,
    squadSpacing: 20,
    formation: 'grid',
    baseStats: {
      hp: 100,
      attack: 0,
      defense: 2,
      speed: 0,
      range: 150,
      attackType: 'single',
      actionCooldownMax: 10,
      turnSpeed: 5,
      size: 'S',
      combatTags: ['organic'],
    },
  }
}

const validPrimitives = {
  fieldEffect: [{
    id: 'barrier',
    kind: 'barrier_dome' as const,
    radius: 170,
    intervalTicks: 40,
    initialDelayTicks: 0,
    duration: 50,
    capacity: 260,
  }],
  controlBeam: {
    range: 120,
    progressPerTick: 60,
    conversionThreshold: 60,
    healConvertedToMax: true,
  },
  rankScaling: {
    hpMultPerRank: 0.5,
    damageModifiers: [{ relation: 'same_rank' as const, multiplier: 1.2 }],
  },
}

function createInput(patch: Record<string, unknown>, location: 'instance' | 'definition' | 'late'): BattleInput {
  const input: BattleInput = {
    seed: 42,
    arena: { width: 600, height: 1200, tileSize: 40, obstacles: [] },
    rules: { maxTicks: 2, timeoutPolicy: 'draw', defenseResolutionMode: 'v9_snapshot' },
    definitions: {
      fighter: makeDef('fighter'),
      target: makeDef('target'),
      minion: makeDef('minion'),
    },
    units: [
      { instanceId: 'a', definitionId: 'fighter', team: 'attacker', placement: { x: 300, y: 900, angle: 0 }, rank: 1, upgradeIds: [] },
      { instanceId: 'd', definitionId: 'target', team: 'defender', placement: { x: 300, y: 300, angle: 0 }, rank: 1, upgradeIds: [] },
    ],
    scheduledEffects: [],
  }

  if (location === 'instance') {
    input.units[0].preparedStats = patch as unknown as BattleInput['units'][0]['preparedStats']
  } else if (location === 'definition') {
    input.definitions.fighter.preparedStats = patch as unknown as NonNullable<BattleInput['definitions']['fighter']['preparedStats']>
  } else {
    input.definitions.minion.preparedStats = patch as unknown as NonNullable<BattleInput['definitions']['minion']['preparedStats']>
    input.definitions.fighter.baseStats.periodicAbilities = [{
      id: 'summon',
      intervalTicks: 1,
      initialDelayTicks: 0,
      targetPolicy: 'self',
      payload: { kind: 'spawn', unitType: 'minion', cap: 1 },
    }]
  }

  return input
}

function countOperations(input: BattleInput) {
  const counts = { rng: 0, queueUnitCreation: 0, queueCompiledUnitCreation: 0 }
  const origNext = PRNG.prototype.next
  const origQueueUnit = CombatWorld.prototype.queueUnitCreation
  const origQueueCompiled = CombatWorld.prototype.queueCompiledUnitCreation

  PRNG.prototype.next = function () {
    counts.rng++
    return origNext.apply(this)
  }
  CombatWorld.prototype.queueUnitCreation = function (...args: unknown[]) {
    counts.queueUnitCreation++
    return origQueueUnit.apply(this, args as Parameters<typeof origQueueUnit>)
  }
  CombatWorld.prototype.queueCompiledUnitCreation = function (...args: unknown[]) {
    counts.queueCompiledUnitCreation++
    return origQueueCompiled.apply(this, args as Parameters<typeof origQueueCompiled>)
  }

  let error: unknown = null
  try {
    simulateCombat(input)
  } catch (err) {
    error = err
  } finally {
    PRNG.prototype.next = origNext
    CombatWorld.prototype.queueUnitCreation = origQueueUnit
    CombatWorld.prototype.queueCompiledUnitCreation = origQueueCompiled
  }

  return { counts, error }
}

describe('R5a Pass 11: Typed primitive preflight rejection', () => {
  const locations = ['instance', 'definition', 'late'] as const

  for (const location of locations) {
    describe(`at location: ${location}`, () => {
      it('valid fieldEffect passes and executes', () => {
        const input = createInput({ fieldEffect: validPrimitives.fieldEffect }, location)
        expect(() => validateBattleInput(structuredClone(input))).not.toThrow()
        const result = simulateCombat(input)
        expect(result.initialState.length).toBeGreaterThan(0)
      })

      it('malformed fieldEffect is rejected before world creation', () => {
        const malformed = [{ ...validPrimitives.fieldEffect[0], radius: 'bad' }]
        const input = createInput({ fieldEffect: malformed }, location)

        expect(() => validateBattleInput(structuredClone(input))).toThrow()
        const { counts, error } = countOperations(input)
        expect(error).not.toBeNull()
        expect(counts.rng).toBe(0)
        expect(counts.queueUnitCreation).toBe(0)
        expect(counts.queueCompiledUnitCreation).toBe(0)
      })

      it('valid controlBeam passes and executes', () => {
        const input = createInput({ controlBeam: validPrimitives.controlBeam }, location)
        expect(() => validateBattleInput(structuredClone(input))).not.toThrow()
        const result = simulateCombat(input)
        expect(result.initialState.length).toBeGreaterThan(0)
      })

      it('malformed controlBeam is rejected before world creation', () => {
        const malformed = { ...validPrimitives.controlBeam, progressPerTick: 'bad' }
        const input = createInput({ controlBeam: malformed }, location)

        expect(() => validateBattleInput(structuredClone(input))).toThrow()
        const { counts, error } = countOperations(input)
        expect(error).not.toBeNull()
        expect(counts.rng).toBe(0)
        expect(counts.queueUnitCreation).toBe(0)
        expect(counts.queueCompiledUnitCreation).toBe(0)
      })

      it('valid rankScaling passes and executes', () => {
        const input = createInput({ rankScaling: validPrimitives.rankScaling }, location)
        expect(() => validateBattleInput(structuredClone(input))).not.toThrow()
        const result = simulateCombat(input)
        expect(result.initialState.length).toBeGreaterThan(0)
      })

      it('malformed rankScaling is rejected before world creation', () => {
        const malformed = { ...validPrimitives.rankScaling, hpMultPerRank: 'bad' }
        const input = createInput({ rankScaling: malformed }, location)

        expect(() => validateBattleInput(structuredClone(input))).toThrow()
        const { counts, error } = countOperations(input)
        expect(error).not.toBeNull()
        expect(counts.rng).toBe(0)
        expect(counts.queueUnitCreation).toBe(0)
        expect(counts.queueCompiledUnitCreation).toBe(0)
      })
    })
  }

  it('handles multiple overlapping barrage impacts on the same target without duplicate damage order key', () => {
    const barrageAttack = { impacts: 2, radius: 40, spreadRadius: 10, damageMultiplier: 0.5 }
    const input: BattleInput = {
      seed: 81,
      arena: { width: 600, height: 1200, tileSize: 40, obstacles: [] },
      rules: { maxTicks: 10, timeoutPolicy: 'draw', defenseResolutionMode: 'v9_snapshot' },
      definitions: {
        fighter: {
          ...makeDef('fighter'),
          baseStats: { ...makeDef('fighter').baseStats, attack: 10, barrageAttack },
        },
        target: {
          ...makeDef('target'),
          baseStats: { ...makeDef('target').baseStats, hp: 1000, defense: 0 },
        },
      },
      units: [
        { instanceId: 'a', definitionId: 'fighter', team: 'attacker', placement: { x: 300, y: 650, angle: -Math.PI / 2 }, rank: 1, upgradeIds: [] },
        { instanceId: 'd', definitionId: 'target', team: 'defender', placement: { x: 300, y: 550, angle: Math.PI / 2 }, rank: 1, upgradeIds: [] },
      ],
      scheduledEffects: [],
    }

    expect(() => simulateCombat(input)).not.toThrow()
    const result = simulateCombat(input)
    const damageActions = result.logs.flatMap(tick => tick.actions).filter(a => a.type === 'damage' && a.targetId === 'd')
    expect(damageActions.length).toBeGreaterThanOrEqual(2)
  })
})

