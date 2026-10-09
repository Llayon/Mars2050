import { describe, it, expect } from 'vitest'
import {
  translateMarsBattleInput,
  buildMarsPreparedStats,
  buildMarsUnitDefinitions,
  buildMarsUpgrades,
} from '@/domains/combat/combat.input-translator'
import { createRuntimeSquad } from '@/domains/combat/combat.squad-factory'
import { PRNG } from '@/domains/combat/combat.utils'
import { simulateCombat } from '@mars2050/combat-core'
import type { UnitRow } from '@/domains/combat/combat.types'
import type { UnitsType } from '@/types/database'

function makeRow(id: string, unit_type: UnitsType = 'marine', overrides: Partial<UnitRow> = {}): UnitRow {
  return {
    id,
    colony_id: 'colony-1',
    unit_type,
    tier: 1,
    upgrade_path: [],
    grid_x: '300',
    grid_y: '700',
    hp_current: 100,
    ...overrides,
  }
}

describe('Mars Adapter: Prepared loadout emission and parity', () => {
  it('translateMarsBattleInput emits preparedStats for all units', () => {
    const attackers = [makeRow('a1', 'marine', { tier: 2, upgrade_path: ['heavy_armor'] })]
    const defenders = [makeRow('d1', 'marine', { tier: 1 })]

    const input = translateMarsBattleInput(attackers, defenders, 42, [], [], [], { maxTicks: 1 })

    expect(input.units).toHaveLength(2)
    for (const unit of input.units) {
      expect(unit.preparedStats).toBeDefined()
      expect(unit.preparedStats!.hp).toBeGreaterThan(0)
      expect(unit.preparedStats!.defense).toBeDefined()
      expect(unit.preparedStats!.speed).toBeDefined()
    }

    const a1 = input.units.find(u => u.instanceId === 'a1')!
    expect(a1.rank).toBe(2)
    expect(a1.upgradeIds).toEqual(['heavy_armor'])
    expect(a1.preparedStats!.defense).toBeGreaterThan(2) // heavy_armor grants extra defense
  })

  it('createRuntimeSquad and translateMarsBattleInput agree on range_enhancement range', () => {
    const rowWithUpgrade = makeRow('u1', 'marine', { upgrade_path: ['range_enhancement'] })
    const rng = new PRNG(123)

    const squad = createRuntimeSquad(rowWithUpgrade, 'attacker', rng)
    expect(squad).toHaveLength(8)
    expect(squad[0].range).toBe(240)

    const translated = translateMarsBattleInput([rowWithUpgrade], [makeRow('d1')], 123, [], [], [], { maxTicks: 1 })
    const translatedUnit = translated.units.find(u => u.instanceId === 'u1')!
    expect(translatedUnit.preparedStats!.range).toBe(240)
  })

  it('createRuntimeSquad and translateMarsBattleInput agree on sensor_suite reveal aura', () => {
    const rowWithSensor = makeRow('u1', 'scout_drone', { upgrade_path: ['sensor_suite'] })
    const rng = new PRNG(123)

    const squad = createRuntimeSquad(rowWithSensor, 'attacker', rng)
    expect(squad).toHaveLength(1)
    expect(squad[0].supportAuras?.some((a: { type?: string }) => a.type === 'reveal')).toBe(true)

    const translated = translateMarsBattleInput([rowWithSensor], [makeRow('d1')], 123, [], [], [], { maxTicks: 1 })
    const translatedUnit = translated.units.find(u => u.instanceId === 'u1')!
    expect(translatedUnit.upgradeIds).toContain('sensor_suite')
    expect(translatedUnit.preparedStats?.supportAuras?.some((a: { type?: string }) => a.type === 'reveal')).toBe(true)

    const detached = structuredClone(translated)
    detached.units[0].upgradeIds = []
    const simResult = simulateCombat(detached)
    const scout = simResult.initialState.find(u => u.id === 'u1')!
    expect(scout.supportAuras?.some((a: { type?: string }) => a.type === 'reveal')).toBe(true)
  })

  it('createRuntimeSquad normalizes legacy tier: 2 into rank: 2', () => {
    const rowTier2 = makeRow('u1', 'marine', { tier: 2 })
    const rng = new PRNG(123)

    const squad = createRuntimeSquad(rowTier2, 'attacker', rng)
    expect(squad).toHaveLength(8)
    expect(squad[0].rank).toBe(2)

    const translated = translateMarsBattleInput([rowTier2], [makeRow('d1')], 123, [], [], [], { maxTicks: 1 })
    const translatedUnit = translated.units.find(u => u.instanceId === 'u1')!
    expect(translatedUnit.rank).toBe(2)
  })

  it('preserves innate armorPierceRatio for explosive_drone and sapper in preparedStats and initialState', () => {
    const droneRow = makeRow('d1', 'explosive_drone')
    const sapperRow = makeRow('s1', 'sapper')
    const defender = makeRow('def', 'marine')

    const translated = translateMarsBattleInput([droneRow, sapperRow], [defender], 123, [], [], [], { maxTicks: 1 })
    const drone = translated.units.find(u => u.instanceId === 'd1')!
    const sapper = translated.units.find(u => u.instanceId === 's1')!

    expect(drone.preparedStats?.armorPierceRatio).toBe(0.8)
    expect(sapper.preparedStats?.armorPierceRatio).toBe(0.35)

    const simResult = simulateCombat(translated)
    const droneSquad = simResult.initialState.filter(u => u.type === 'explosive_drone')
    expect(droneSquad.length).toBeGreaterThan(0)
    for (const member of droneSquad) {
      expect(member.armorPierceRatio).toBe(0.8)
    }

    const sapperSquad = simResult.initialState.filter(u => u.type === 'sapper')
    expect(sapperSquad.length).toBeGreaterThan(0)
    for (const member of sapperSquad) {
      expect(member.armorPierceRatio).toBe(0.35)
    }
  })

  it('preserves drone_carrier periodic spawn interval (150 ticks, not 1500)', () => {
    const carrierRow = makeRow('c1', 'titan_mech', { upgrade_path: ['drone_carrier'] })
    const translated = translateMarsBattleInput([carrierRow], [makeRow('def', 'marine')], 123, [], [], [], { maxTicks: 301 })
    const carrier = translated.units.find(u => u.instanceId === 'c1')!

    expect(carrier.preparedStats?.spawnerConfig?.interval).toBe(150)
    expect(carrier.preparedStats?.spawnerConfig?.timer).toBe(150)
  })

  it('drone_carrier spawns scout drones on ticks 149 and 299 in a 301-tick battle', () => {
    const carrierRow = makeRow('c1', 'titan_mech', { upgrade_path: ['drone_carrier'], grid_y: '450' })
    const wallRow = makeRow('w1', 'wall', { grid_y: '200' })
    const translated = translateMarsBattleInput([carrierRow], [wallRow], 42, [], [], [], {
      maxTicks: 301,
      arena: { width: 600, height: 600, tileSize: 40, obstacles: [], deployment: { strategy: 'center' } },
    })
    translated.units[1].preparedStats!.hp = 100000
    translated.units[1].currentHp = 100000
    const result = simulateCombat(translated)
    const spawnActions = result.logs.flatMap(tick =>
      tick.actions.filter(a => a.type === 'spawn').map(a => ({ tick: tick.tick, ...a })),
    )
    expect(spawnActions).toHaveLength(2)
    expect(spawnActions[0].tick).toBe(149)
    expect(spawnActions[1].tick).toBe(299)
  })

  it('createRuntimeSquad and buildMarsPreparedStats respect custom catalog definition overrides', () => {
    const defs = buildMarsUnitDefinitions()
    const customCatalog = {
      unitTypes: {
        marine: {
          ...defs.marine,
          hireCost: { minerals: 100 },
          baseStats: { ...defs.marine.baseStats, hp: 300, attack: 70 },
        },
      },
      upgrades: buildMarsUpgrades(),
    }
    const prepared = buildMarsPreparedStats('marine', 1, [], customCatalog, defs)
    expect(prepared?.hp).toBe(300)
    expect(prepared?.attack).toBe(70)

    const squad = createRuntimeSquad(
      makeRow('m1', 'marine', { hp_current: 300 }),
      'attacker',
      new PRNG(42),
      customCatalog as unknown as import('@mars2050/combat-core').CombatCatalog,
    )
    expect(squad[0].hp).toBe(300)
    expect(squad[0].maxHp).toBe(300)
    expect(squad[0].attack).toBe(70)
  })

  it('buildMarsPreparedStats follows replacement semantics for rankScaling upgrades', () => {
    const customDefs = {
      fighter: {
        id: 'fighter',
        name: 'FIGHTER',
        squadSize: 1,
        squadSpacing: 20,
        formation: 'grid' as const,
        baseStats: {
          hp: 100, attack: 10, defense: 2, speed: 0, range: 150, attackType: 'single' as const,
          actionCooldownMax: 10, turnSpeed: 5, size: 'S' as const, combatTags: ['organic'],
          rankScaling: { attackMultPerRank: 0.5, hpMultPerRank: 0.1 },
        },
      },
    }
    const customCatalog = {
      unitTypes: customDefs,
      upgrades: {
        veteran: { id: 'veteran', modifiers: { rankScaling: { hpMultPerRank: 0.5 } } },
      },
    }
    const prepared = buildMarsPreparedStats('fighter', 2, ['veteran'], customCatalog, customDefs)
    expect(prepared?.hp).toBe(150)
    expect(prepared?.attack).toBe(10)
    expect(prepared?.rankScaling).toEqual({ hpMultPerRank: 0.5 })
  })

  it('preserves triggerEffects and onDeathSpawn ordering and QA upgrade detachment', () => {
    const customDefs = {
      fighter: {
        id: 'fighter',
        name: 'FIGHTER',
        squadSize: 1,
        squadSpacing: 20,
        formation: 'grid' as const,
        baseStats: {
          hp: 100, attack: 10, defense: 2, speed: 0, range: 150, attackType: 'single' as const,
          actionCooldownMax: 10, turnSpeed: 5, size: 'S' as const, combatTags: ['organic'],
        },
      },
      minion: {
        id: 'minion', name: 'MINION', squadSize: 1, squadSpacing: 20, formation: 'grid' as const,
        baseStats: { hp: 50, attack: 0, defense: 0, speed: 0, range: 10, attackType: 'single' as const, actionCooldownMax: 10, turnSpeed: 5, size: 'S' as const, combatTags: [] },
      },
    }
    const customCatalog = {
      unitTypes: customDefs,
      upgrades: {
        mixed: {
          id: 'mixed',
          modifiers: {
            onDeathSpawn: 'minion',
            triggerEffects: [{ id: 'first-death', event: 'death' as const, payload: { kind: 'damage' as const, target: 'killer' as const, amount: 10 } }],
          },
        },
      },
    }
    const prepared = buildMarsPreparedStats('fighter', 1, ['mixed'], customCatalog, customDefs)
    const triggerIds = prepared?.triggerEffects?.map(t => (t as { id: string }).id)
    expect(triggerIds).toEqual(['first-death', 'mixed-on-death-spawn'])

    const barrierRow = makeRow('b1', 'shield_emitter', { upgrade_path: ['qa_barrier_dome'] })
    const trans = translateMarsBattleInput([barrierRow], [makeRow('w', 'wall')], 42, [], [], [], { maxTicks: 2 })
    expect(trans.units[0].preparedStats?.fieldEffect).toBeDefined()
    const detached = structuredClone(trans)
    detached.units[0].upgradeIds = []
    const simRetained = simulateCombat(trans)
    const simDetached = simulateCombat(detached)
    expect(simDetached.initialState[0].fieldEffect).toEqual(simRetained.initialState[0].fieldEffect)
  })
})

