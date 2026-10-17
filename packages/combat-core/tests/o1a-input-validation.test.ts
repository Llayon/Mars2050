import { describe, it, expect, vi } from 'vitest'
import { simulateCombat } from '../src/facade/combat-facade.js'
import { executeCombatSimulation } from '../src/combat.runner.js'
import * as inputValidator from '../src/combat.input-validator.js'
import * as inputBrand from '../src/combat.input-brand.js'
import * as ecsRuntime from '../src/ecs/combat-ecs-runtime.js'
import { CombatDefinitionError } from '../src/combat.definition-error.js'
import type { BattleInputSpec, BattleInput } from '../src/contracts/index.js'
const prngState = vi.hoisted(() => ({ created: 0 }))

vi.mock('../src/math/index.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/math/index.js')>()
  class CountingPRNG extends actual.PRNG {
    constructor(seed: number) {
      super(seed)
      prngState.created += 1
    }
  }
  return { ...actual, PRNG: CountingPRNG }
})
function deepFreeze<T>(obj: T): Readonly<T> {
  if (obj === null || typeof obj !== 'object') return obj
  Object.freeze(obj)
  for (const key of Object.keys(obj)) {
    const val = (obj as Record<string, unknown>)[key]
    if (typeof val === 'object' && val !== null && !Object.isFrozen(val)) deepFreeze(val)
  }
  return obj
}
function createBasicInput(overrides: Partial<BattleInputSpec> = {}): BattleInputSpec {
  return {
    seed: 4242,
    arena: { width: 600, height: 1200, tileSize: 40, obstacles: [] },
    rules: { maxTicks: 20, timeoutPolicy: 'draw', defenseResolutionMode: 'v9_snapshot' },
    definitions: {
      soldier: {
        id: 'soldier',
        name: 'Soldier',
        baseStats: {
          hp: 200,
          attack: 15,
          defense: 2,
          speed: 50,
          range: 30,
          attackType: 'single',
        },
      },
    },
    units: [
      { instanceId: 'a1', definitionId: 'soldier', team: 'attacker', placement: { x: 300, y: 800 }, rank: 1, upgradeIds: [] },
      { instanceId: 'd1', definitionId: 'soldier', team: 'defender', placement: { x: 300, y: 400 }, rank: 1, upgradeIds: [] },
    ],
    ...overrides,
  }
}

describe('O1-A: Input Validation & Single-Pass Normalization', () => {
  it('calls validateBattleInput exactly once on the public simulateCombat path', () => {
    const spy = vi.spyOn(inputValidator, 'validateBattleInput')
    try {
      const input = createBasicInput()
      const result = simulateCombat(input)
      expect(result).toBeDefined()
      expect(result.elapsedTicks).toBeGreaterThan(0)
      expect(spy).toHaveBeenCalledTimes(1)
    } finally {
      spy.mockRestore()
    }
  })

  it('skips duplicate validation in executeCombatSimulation when input is already normalized', () => {
    const spy = vi.spyOn(inputValidator, 'validateBattleInput')
    try {
      const input = createBasicInput()
      const normalized = inputValidator.validateBattleInput(input)
      expect(spy).toHaveBeenCalledTimes(1)
      expect(inputBrand.isNormalizedBattleInput(normalized)).toBe(true)

      const result = executeCombatSimulation(normalized)
      expect(result).toBeDefined()
      // Still only 1 call from our explicit call, executeCombatSimulation did NOT call it again
      expect(spy).toHaveBeenCalledTimes(1)
    } finally {
      spy.mockRestore()
    }
  })

  it('validates unbranded raw input when executeCombatSimulation is called directly', () => {
    const spy = vi.spyOn(inputValidator, 'validateBattleInput')
    try {
      const rawInput = createBasicInput()
      expect(inputBrand.isNormalizedBattleInput(rawInput)).toBe(false)

      const result = executeCombatSimulation(rawInput as unknown as import('../src/contracts/index.js').BattleInput)
      expect(result).toBeDefined()
      expect(spy).toHaveBeenCalledTimes(1)
    } finally {
      spy.mockRestore()
    }
  })

  it('preserves normalization of defaults across definitions, arena, and rules', () => {
    const minimalInput: BattleInputSpec = {
      seed: 1234,
      definitions: {
        soldier: {
          id: 'soldier',
          name: 'Soldier',
          baseStats: {
            hp: 200,
            attack: 15,
            defense: 2,
            speed: 50,
            range: 30,
            attackType: 'single',
          },
        },
      },
      units: [
        { instanceId: 'a1', definitionId: 'soldier', team: 'attacker', placement: { x: 300, y: 800 }, rank: 1, upgradeIds: [] },
        { instanceId: 'd1', definitionId: 'soldier', team: 'defender', placement: { x: 300, y: 400 }, rank: 1, upgradeIds: [] },
      ],
    }

    const validated = inputValidator.validateBattleInput(minimalInput)
    // Arena defaults applied
    expect(validated.arena.width).toBe(600)
    expect(validated.arena.height).toBe(1200)
    // Rules defaults applied
    expect(validated.rules.maxTicks).toBe(2000)
    expect(validated.rules.timeoutPolicy).toBe('draw')
    // Definition normalization applied
    expect(validated.definitions.soldier.baseStats.actionCooldownMax).toBe(10)
    expect(validated.definitions.soldier.baseStats.turnSpeed).toBe(5)
    expect(validated.definitions.soldier.baseStats.size).toBe('M')
    expect(validated.definitions.soldier.baseStats.combatTags).toEqual([])

    // simulateCombat output runs successfully with minimal input
    const result = simulateCombat(minimalInput)
    expect(result.initialState).toHaveLength(2)
  })

  it('preserves exact errors for damaged and invalid inputs', () => {
    expect(() => simulateCombat(createBasicInput({ seed: 'bad-seed' as unknown as number }))).toThrowError(CombatDefinitionError)
    expect(() => simulateCombat(createBasicInput({
      units: [
        { instanceId: 'u1', definitionId: 'unknown_def', team: 'attacker', placement: { x: 300, y: 800 }, rank: 1, upgradeIds: [] },
      ],
    }))).toThrowError(/references unknown definitionId 'unknown_def'/)

    expect(() => simulateCombat(createBasicInput({
      units: [
        { instanceId: 'dup', definitionId: 'soldier', team: 'attacker', placement: { x: 300, y: 800 }, rank: 1, upgradeIds: [] },
        { instanceId: 'dup', definitionId: 'soldier', team: 'defender', placement: { x: 300, y: 400 }, rank: 1, upgradeIds: [] },
      ],
    }))).toThrowError(/duplicate unit instanceId 'dup'/)
  })

  it('does not mutate deeply frozen inputs', () => {
    const input = createBasicInput({
      catalog: {
        unitTypes: {
          cat_soldier: {
            id: 'cat_soldier',
            name: 'Catalog Soldier',
            baseStats: { hp: 300, attack: 20, defense: 5, speed: 40, range: 25, attackType: 'single' },
          },
        },
      },
      scheduledEffects: [
        { id: 'eff_1', tick: 5, team: 'attacker', type: 'orbital_strike', value: 50 },
      ],
    })

    deepFreeze(input)
    expect(Object.isFrozen(input)).toBe(true)
    expect(Object.isFrozen(input.definitions.soldier)).toBe(true)
    expect(Object.isFrozen(input.definitions.soldier.baseStats)).toBe(true)
    expect(Object.isFrozen(input.units[0])).toBe(true)

    expect(() => simulateCombat(input)).not.toThrow()
  })

  it('rejects invalid inputs before any PRNG construction or world creation', () => {
    const runtimeSpy = vi.spyOn(ecsRuntime, 'createEcsCombatRuntime')
    try {
      // Instrumentation control: valid input must be observed, otherwise the test is blind.
      prngState.created = 0
      simulateCombat(createBasicInput())
      expect(prngState.created).toBeGreaterThan(0)
      expect(runtimeSpy).toHaveBeenCalled()

      prngState.created = 0
      runtimeSpy.mockClear()

      const badInput = createBasicInput({
        units: [
          { instanceId: 'u1', definitionId: 'nonexistent', team: 'attacker', placement: { x: 300, y: 800 }, rank: 1, upgradeIds: [] },
        ],
      })

      expect(() => simulateCombat(badInput)).toThrow(CombatDefinitionError)
      expect(prngState.created).toBe(0)
      expect(runtimeSpy).not.toHaveBeenCalled()
    } finally {
      runtimeSpy.mockRestore()
    }
  })

  it('rejects invalid input even when it carries a forged global-registry brand', () => {
    const badInput = createBasicInput({
      units: [
        { instanceId: 'u1', definitionId: 'nonexistent', team: 'attacker', placement: { x: 300, y: 800 }, rank: 1, upgradeIds: [] },
      ],
    })
    Object.defineProperty(badInput, Symbol.for('@mars2050/combat-core.normalized-input'), {
      value: true,
      enumerable: false,
      configurable: true,
    })
    expect(() => simulateCombat(badInput)).toThrow(/references unknown definitionId 'nonexistent'/)
  })

  it('treats a forged global-registry brand as unnormalized inside the runner', () => {
    const forgedRaw = createBasicInput()
    Object.defineProperty(forgedRaw, Symbol.for('@mars2050/combat-core.normalized-input'), {
      value: true,
      enumerable: false,
      configurable: true,
    })
    expect(inputBrand.isNormalizedBattleInput(forgedRaw)).toBe(false)

    const spy = vi.spyOn(inputValidator, 'validateBattleInput')
    try {
      const result = executeCombatSimulation(forgedRaw as unknown as BattleInput)
      expect(result.elapsedTicks).toBeGreaterThan(0)
      expect(spy).toHaveBeenCalledTimes(1)
    } finally {
      spy.mockRestore()
    }
  })

  it('re-validates normalized input that was mutated before the public entry point', () => {
    const normalized = inputValidator.validateBattleInput(createBasicInput())
    const mutableUnit = normalized.units[0] as unknown as { definitionId: string }
    mutableUnit.definitionId = 'nonexistent'
    expect(() => simulateCombat(normalized)).toThrow(/references unknown definitionId 'nonexistent'/)
  })
})
