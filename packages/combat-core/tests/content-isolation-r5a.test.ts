import { describe, it, expect } from 'vitest'
import {
  simulateCombat,
  type BattleInput,
  type UnitDefinition,
} from '../src/index.js'
import { compileUnitSnapshot } from '../src/combat.unit-compiler.js'
import { mapDefinitionToUnitTypeConfig } from '../src/combat.definition-mapper.js'

function makeDef(id: string, overrides: Partial<UnitDefinition['baseStats']> = {}, extra: Partial<UnitDefinition> = {}): UnitDefinition {
  return {
    id,
    name: id.toUpperCase(),
    squadSize: 2,
    squadSpacing: 20,
    formation: 'grid',
    baseStats: {
      hp: 100,
      attack: 10,
      defense: 2,
      speed: 60,
      range: 40,
      attackType: 'single',
      actionCooldownMax: 10,
      turnSpeed: 5,
      size: 'S',
      combatTags: ['organic', 'light'],
      ...overrides,
    },
    ...extra,
  }
}

describe('R5a (ISO-09): Game content and trait extraction from core', () => {
  it('does not infer alien traits solely from definitionId prefix', () => {
    // Both units have identical declared baseStats with no explicit alien traits
    const alienSpec = {
      definitionId: 'alien_unconfigured',
      identity: { id: 'u1', team: 'attacker' as const },
      loadout: { rank: 1, upgradeIds: [] },
      placement: { x: 300, y: 1000, angle: 0 },
      catalog: {
        unitTypes: {
          alien_unconfigured: mapDefinitionToUnitTypeConfig(makeDef('alien_unconfigured')),
        },
      },
    }
    const genericSpec = {
      definitionId: 'generic_unconfigured',
      identity: { id: 'u2', team: 'attacker' as const },
      loadout: { rank: 1, upgradeIds: [] },
      placement: { x: 300, y: 1000, angle: 0 },
      catalog: {
        unitTypes: {
          generic_unconfigured: mapDefinitionToUnitTypeConfig(makeDef('generic_unconfigured')),
        },
      },
    }

    const alienCompiled = compileUnitSnapshot(alienSpec)
    const genericCompiled = compileUnitSnapshot(genericSpec)

    expect(alienCompiled).not.toBeNull()
    expect(genericCompiled).not.toBeNull()

    // Core must NOT give special alien traits to alien_unconfigured
    expect(alienCompiled!.runtimeRules?.stationaryAlignment).toBeUndefined()
    expect(alienCompiled!.runtimeRules?.formationAnchorMode).toBe('leader')

    // Both must match in all movement/anchor traits
    expect(alienCompiled!.runtimeRules?.stationaryAlignment).toBe(genericCompiled!.runtimeRules?.stationaryAlignment)
    expect(alienCompiled!.runtimeRules?.formationAnchorMode).toBe(genericCompiled!.runtimeRules?.formationAnchorMode)
    expect(alienCompiled!.runtimeRules?.velocityDamping).toBe(genericCompiled!.runtimeRules?.velocityDamping)
  })

  it('produces identical simulation outcome for renamed definitions with identical explicit traits', () => {
    const traits = {
      stationaryAlignment: true,
      formationAnchorMode: 'centroid' as const,
      velocityDamping: true,
    }

    const inputAlien: BattleInput = {
      seed: 98765,
      arena: { width: 600, height: 1200, tileSize: 40, obstacles: [] },
      rules: { maxTicks: 200, timeoutPolicy: 'draw', defenseResolutionMode: 'v9_snapshot' },
      definitions: {
        alien_crawler: makeDef('alien_crawler', { ...traits, rankScaling: { hpMultPerRank: 0.2 } }, { squadSize: 2 }),
        alien_minion: makeDef('alien_minion', { ...traits, hp: 50, attack: 5 }, { squadSize: 1 }),
        alien_defender: makeDef('alien_defender', { ...traits, hp: 150, attackType: 'spawn', spawnType: 'alien_minion' }, { squadSize: 1 }),
      },
      catalog: {
        upgrades: {
          alien_upg: { modifiers: { hpMult: 1.1, grantRevealAura: { radius: 30, duration: 10 } } },
        },
      },
      units: [
        { instanceId: 'a1', definitionId: 'alien_crawler', team: 'attacker', placement: { x: 300, y: 700 }, rank: 2, upgradeIds: ['alien_upg'] },
        { instanceId: 'd1', definitionId: 'alien_defender', team: 'defender', placement: { x: 300, y: 500 }, rank: 1, upgradeIds: [] },
      ],
      scheduledEffects: [],
    }

    const inputFantasy: BattleInput = {
      seed: 98765,
      arena: { width: 600, height: 1200, tileSize: 40, obstacles: [] },
      rules: { maxTicks: 200, timeoutPolicy: 'draw', defenseResolutionMode: 'v9_snapshot' },
      definitions: {
        fantasy_spider: makeDef('fantasy_spider', { ...traits, rankScaling: { hpMultPerRank: 0.2 } }, { squadSize: 2 }),
        fantasy_minion: makeDef('fantasy_minion', { ...traits, hp: 50, attack: 5 }, { squadSize: 1 }),
        fantasy_golem: makeDef('fantasy_golem', { ...traits, hp: 150, attackType: 'spawn', spawnType: 'fantasy_minion' }, { squadSize: 1 }),
      },
      catalog: {
        upgrades: {
          fantasy_upg: { modifiers: { hpMult: 1.1, grantRevealAura: { radius: 30, duration: 10 } } },
        },
      },
      units: [
        { instanceId: 'a1', definitionId: 'fantasy_spider', team: 'attacker', placement: { x: 300, y: 700 }, rank: 2, upgradeIds: ['fantasy_upg'] },
        { instanceId: 'd1', definitionId: 'fantasy_golem', team: 'defender', placement: { x: 300, y: 500 }, rank: 1, upgradeIds: [] },
      ],
      scheduledEffects: [],
    }

    const resAlien = simulateCombat(inputAlien)
    const resFantasy = simulateCombat(inputFantasy)

    expect(resAlien.winner).toBe(resFantasy.winner)
    expect(resAlien.elapsedTicks).toBe(resFantasy.elapsedTicks)
    expect(resAlien.terminationReason).toBe(resFantasy.terminationReason)

    // Normalize only definition & upgrade references in alien replay output
    const normalizeAlien = <T>(data: T): T => {
      const json = JSON.stringify(data)
      return JSON.parse(
        json
          .replace(/alien_crawler/g, 'fantasy_spider')
          .replace(/alien_defender/g, 'fantasy_golem')
          .replace(/alien_minion/g, 'fantasy_minion')
          .replace(/alien_upg/g, 'fantasy_upg'),
      )
    }

    // Full mechanical differential comparisons covering amounts, coords, and attribution
    expect(normalizeAlien(resAlien.initialState)).toEqual(resFantasy.initialState)
    expect(normalizeAlien(resAlien.survivors)).toEqual(resFantasy.survivors)
    expect(normalizeAlien(resAlien.logs)).toEqual(resFantasy.logs)

    // Negative control 1: perturbing attacker base attack by 1 breaks log equivalence
    const perturbedAttackInput = structuredClone(inputAlien)
    perturbedAttackInput.definitions.alien_crawler.baseStats.attack += 1
    const resAttackPerturbed = simulateCombat(perturbedAttackInput)
    expect(normalizeAlien(resAttackPerturbed.logs)).not.toEqual(resFantasy.logs)

    // Negative control 2: omitting explicit stationaryAlignment trait causes mechanical divergence
    const perturbedTraitInput = structuredClone(inputAlien)
    delete perturbedTraitInput.definitions.alien_crawler.baseStats.stationaryAlignment
    const resTraitPerturbed = simulateCombat(perturbedTraitInput)
    expect(normalizeAlien(resTraitPerturbed.logs)).not.toEqual(resFantasy.logs)
  }, 20_000)
})
