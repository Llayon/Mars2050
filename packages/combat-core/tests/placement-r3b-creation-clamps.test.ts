import { describe, it, expect, vi } from 'vitest'
import { simulateCombat, type BattleInputSpec, type UnitDefinition } from '../src/index.js'
import { CombatWorld } from '../src/ecs/combat-world.js'

function makeDef(id: string, overrides: Partial<UnitDefinition['baseStats']> = {}, extra: Partial<UnitDefinition> = {}): UnitDefinition {
  return {
    id, name: id.toUpperCase(), squadSize: 1, squadSpacing: 20, formation: 'grid',
    baseStats: {
      hp: 100, attack: 10, defense: 5, speed: 3, range: 4, attackType: 'single',
      actionCooldownMax: 10, turnSpeed: 5, size: 'M', combatTags: [], ...overrides,
    },
    ...extra,
  }
}

function baseInput(overrides: Partial<BattleInputSpec> = {}): BattleInputSpec {
  return {
    seed: 42,
    arena: { width: 100, height: 100, tileSize: 20, obstacles: [] },
    rules: { maxTicks: 50, timeoutPolicy: 'draw', defenseResolutionMode: 'v9_snapshot' },
    definitions: { marine: makeDef('marine'), target: makeDef('target') },
    units: [
      { instanceId: 'u1', definitionId: 'marine', team: 'attacker', placement: {}, rank: 1, upgradeIds: [] },
      { instanceId: 'u2', definitionId: 'target', team: 'defender', placement: {}, rank: 1, upgradeIds: [] },
    ],
    scheduledEffects: [],
    ...overrides,
  }
}

describe('R3b: Runtime Unit Creation Boundary Clamps', () => {
  it('clamps late summons near the boundary so they never escape the arena', () => {
    const input = baseInput({
      definitions: {
        spawner: makeDef('spawner', { hp: 500, size: 'M' }, {
          periodicAbilities: [{ id: 'sum', intervalTicks: 5, targetPolicy: 'self', payload: { kind: 'spawn', unitType: 'minion' } }],
        } as unknown as Partial<UnitDefinition>),
        minion: makeDef('minion', { hp: 10, size: 'M' }),
        target: makeDef('target', { hp: 1000 }),
      },
      units: [
        { instanceId: 's', definitionId: 'spawner', team: 'attacker', placement: { x: 20, y: 20 }, rank: 1, upgradeIds: [] },
        { instanceId: 't', definitionId: 'target', team: 'defender', placement: { x: 80, y: 80 }, rank: 1, upgradeIds: [] },
      ],
    })
    const result = simulateCombat(input)
    const spawnActions = result.logs
      .flatMap(tick => tick.actions)
      .filter(a => a.type === 'spawn')
    expect(spawnActions.length).toBeGreaterThan(0)
    for (const sa of spawnActions) {
      const x = (sa as Record<string, unknown>).toX as number
      const y = (sa as Record<string, unknown>).toY as number
      expect(x).toBeGreaterThanOrEqual(18)
      expect(x).toBeLessThanOrEqual(82)
      expect(y).toBeGreaterThanOrEqual(18)
      expect(y).toBeLessThanOrEqual(82)
    }
  })

  it('clamps spawn action units near the boundary so XL bodies stay strictly inside arena', () => {
    const queueCreationSpy = vi.spyOn(CombatWorld.prototype, 'queueCompiledUnitCreation')
    const input = baseInput({
      definitions: {
        spawner: makeDef('spawner', { hp: 500, size: 'M', attackType: 'spawn', spawnType: 'giant', range: 30, actionCooldownMax: 5 }),
        giant: makeDef('giant', { hp: 100, size: 'XL', speed: 0 }),
        target: makeDef('target', { hp: 1000 }),
      },
      catalog: {
        unitTypes: {
          spawner: makeDef('spawner', { hp: 500, size: 'M', attackType: 'spawn', spawnType: 'giant', range: 30, actionCooldownMax: 5 }) as unknown as Record<string, unknown>,
          giant: makeDef('giant', { hp: 100, size: 'XL', speed: 0 }) as unknown as Record<string, unknown>,
          target: makeDef('target', { hp: 1000 }) as unknown as Record<string, unknown>,
        },
        upgrades: {},
      },
      units: [
        { instanceId: 's', definitionId: 'spawner', team: 'attacker', placement: { x: 20, y: 50 }, rank: 1, upgradeIds: [] },
        { instanceId: 't', definitionId: 'target', team: 'defender', placement: { x: 20, y: 60 }, rank: 1, upgradeIds: [] },
      ],
    })
    const result = simulateCombat(input)
    const spawnActions = result.logs
      .flatMap(tick => tick.actions)
      .filter(a => a.type === 'spawn' && a.unitId === 's')
    expect(spawnActions.length).toBeGreaterThan(0)
    for (const sa of spawnActions) {
      const toX = (sa as Record<string, unknown>).toX as number
      const toY = (sa as Record<string, unknown>).toY as number
      // XL creature bodyRadius = 45 -> allowed range on 100x100 is [45, 55]
      expect(toX).toBeGreaterThanOrEqual(45)
      expect(toX).toBeLessThanOrEqual(55)
      expect(toY).toBeGreaterThanOrEqual(45)
      expect(toY).toBeLessThanOrEqual(55)

      const targetId = (sa as Record<string, unknown>).targetId as string
      const giantEntity = result.survivors.find(u => u.id === targetId)
      if (giantEntity) {
        expect(giantEntity.x).toBeGreaterThanOrEqual(45)
        expect(giantEntity.x).toBeLessThanOrEqual(55)
        expect(giantEntity.y).toBeGreaterThanOrEqual(45)
        expect(giantEntity.y).toBeLessThanOrEqual(55)
      }
    }
    // Verify created ECS entity bundles passed into world
    const createdGiantBundles = queueCreationSpy.mock.calls
      .flatMap(call => call)
      .filter(bundle => (bundle.components.identity as { type?: string }).type === 'giant')
    expect(createdGiantBundles.length).toBeGreaterThan(0)
    for (const b of createdGiantBundles) {
      const tx = b.components.transform.x
      const ty = b.components.transform.y
      expect(tx).toBeGreaterThanOrEqual(45)
      expect(tx).toBeLessThanOrEqual(55)
      expect(ty).toBeGreaterThanOrEqual(45)
      expect(ty).toBeLessThanOrEqual(55)
    }
    queueCreationSpy.mockRestore()
  })

  it('clamps replicateOnKill clones near boundary so XL killer clone stays strictly inside arena', () => {
    const queueCloneSpy = vi.spyOn(CombatWorld.prototype, 'queueUnitClone')

    // 1. Lower-bound clamp test (victim near bottom-left 10, 20)
    const inputLower = baseInput({
      definitions: {
        killer: makeDef('killer', { hp: 500, attack: 100, size: 'XL', range: 100, speed: 0 }),
        victim: makeDef('victim', { hp: 10, size: 'S' }),
      },
      catalog: {
        unitTypes: {
          killer: makeDef('killer', { hp: 500, attack: 100, size: 'XL', range: 100, speed: 0 }) as unknown as Record<string, unknown>,
          victim: makeDef('victim', { hp: 10, size: 'S' }) as unknown as Record<string, unknown>,
        },
        upgrades: {
          rep: { id: 'rep', name: 'REP', modifiers: { replicateOnKill: true } },
        },
      },
      units: [
        { instanceId: 'k', definitionId: 'killer', team: 'attacker', placement: { x: 50, y: 50 }, rank: 1, upgradeIds: ['rep'] },
        { instanceId: 'v', definitionId: 'victim', team: 'defender', placement: { x: 10, y: 20 }, rank: 1, upgradeIds: [] },
      ],
    })
    const resultLower = simulateCombat(inputLower)
    const cloneSpawnLower = resultLower.logs
      .flatMap(tick => tick.actions)
      .find(a => a.type === 'spawn' && a.unitId === 'k')
    expect(cloneSpawnLower).toBeDefined()
    const lowerX = (cloneSpawnLower as Record<string, unknown>).toX as number
    const lowerY = (cloneSpawnLower as Record<string, unknown>).toY as number
    // XL killer has bodyRadius = 45 -> allowed range on 100x100 is [45, 55]
    expect(lowerX).toBeGreaterThanOrEqual(45)
    expect(lowerX).toBeLessThanOrEqual(55)
    expect(lowerY).toBeGreaterThanOrEqual(45)
    expect(lowerY).toBeLessThanOrEqual(55)

    const cloneSurvivorLower = resultLower.survivors.find(u => u.id === (cloneSpawnLower as Record<string, unknown>).targetId)
    expect(cloneSurvivorLower).toBeDefined()
    expect(cloneSurvivorLower?.x).toBeGreaterThanOrEqual(45)
    expect(cloneSurvivorLower?.x).toBeLessThanOrEqual(55)
    expect(cloneSurvivorLower?.y).toBeGreaterThanOrEqual(45)
    expect(cloneSurvivorLower?.y).toBeLessThanOrEqual(55)

    expect(queueCloneSpy).toHaveBeenCalledWith(
      expect.any(Number),
      (cloneSpawnLower as Record<string, unknown>).targetId,
      45,
      45,
    )

    // 2. Upper-bound clamp test (victim near top-right 95, 90)
    queueCloneSpy.mockClear()
    const inputUpper = baseInput({
      definitions: {
        killer: makeDef('killer', { hp: 500, attack: 100, size: 'XL', range: 100, speed: 0 }),
        victim: makeDef('victim', { hp: 10, size: 'S' }),
      },
      catalog: {
        unitTypes: {
          killer: makeDef('killer', { hp: 500, attack: 100, size: 'XL', range: 100, speed: 0 }) as unknown as Record<string, unknown>,
          victim: makeDef('victim', { hp: 10, size: 'S' }) as unknown as Record<string, unknown>,
        },
        upgrades: {
          rep: { id: 'rep', name: 'REP', modifiers: { replicateOnKill: true } },
        },
      },
      units: [
        { instanceId: 'k', definitionId: 'killer', team: 'attacker', placement: { x: 50, y: 50 }, rank: 1, upgradeIds: ['rep'] },
        { instanceId: 'v', definitionId: 'victim', team: 'defender', placement: { x: 90, y: 90 }, rank: 1, upgradeIds: [] },
      ],
    })
    const resultUpper = simulateCombat(inputUpper)
    const cloneSpawnUpper = resultUpper.logs
      .flatMap(tick => tick.actions)
      .find(a => a.type === 'spawn' && a.unitId === 'k')
    expect(cloneSpawnUpper).toBeDefined()
    const upperX = (cloneSpawnUpper as Record<string, unknown>).toX as number
    const upperY = (cloneSpawnUpper as Record<string, unknown>).toY as number
    expect(upperX).toBeGreaterThanOrEqual(45)
    expect(upperX).toBeLessThanOrEqual(55)
    expect(upperY).toBeGreaterThanOrEqual(45)
    expect(upperY).toBeLessThanOrEqual(55)

    const cloneSurvivorUpper = resultUpper.survivors.find(u => u.id === (cloneSpawnUpper as Record<string, unknown>).targetId)
    expect(cloneSurvivorUpper).toBeDefined()
    expect(cloneSurvivorUpper?.x).toBeGreaterThanOrEqual(45)
    expect(cloneSurvivorUpper?.x).toBeLessThanOrEqual(55)
    expect(cloneSurvivorUpper?.y).toBeGreaterThanOrEqual(45)
    expect(cloneSurvivorUpper?.y).toBeLessThanOrEqual(55)

    expect(queueCloneSpy).toHaveBeenCalledWith(
      expect.any(Number),
      (cloneSpawnUpper as Record<string, unknown>).targetId,
      55,
      55,
    )

    queueCloneSpy.mockRestore()
  })
})
