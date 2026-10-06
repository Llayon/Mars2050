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
      speed: 5,
      range: 1,
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
        alien_crawler: makeDef('alien_crawler', traits),
        alien_defender: makeDef('alien_defender', { ...traits, hp: 120 }),
      },
      units: [
        { instanceId: 'a1', definitionId: 'alien_crawler', team: 'attacker', placement: { x: 300, y: 800 }, rank: 1, upgradeIds: [] },
        { instanceId: 'd1', definitionId: 'alien_defender', team: 'defender', placement: { x: 300, y: 400 }, rank: 1, upgradeIds: [] },
      ],
      scheduledEffects: [],
    }

    const inputFantasy: BattleInput = {
      seed: 98765,
      arena: { width: 600, height: 1200, tileSize: 40, obstacles: [] },
      rules: { maxTicks: 200, timeoutPolicy: 'draw', defenseResolutionMode: 'v9_snapshot' },
      definitions: {
        fantasy_spider: makeDef('fantasy_spider', traits),
        fantasy_golem: makeDef('fantasy_golem', { ...traits, hp: 120 }),
      },
      units: [
        { instanceId: 'a1', definitionId: 'fantasy_spider', team: 'attacker', placement: { x: 300, y: 800 }, rank: 1, upgradeIds: [] },
        { instanceId: 'd1', definitionId: 'fantasy_golem', team: 'defender', placement: { x: 300, y: 400 }, rank: 1, upgradeIds: [] },
      ],
      scheduledEffects: [],
    }

    const resAlien = simulateCombat(inputAlien)
    const resFantasy = simulateCombat(inputFantasy)

    expect(resAlien.winner).toBe(resFantasy.winner)
    expect(resAlien.elapsedTicks).toBe(resFantasy.elapsedTicks)
    expect(resAlien.terminationReason).toBe(resFantasy.terminationReason)

    // Verify survivors have identical state (modulo unit definitionId)
    expect(resAlien.survivors.length).toBe(resFantasy.survivors.length)
    for (let i = 0; i < resAlien.survivors.length; i++) {
      const sA = resAlien.survivors[i]
      const sF = resFantasy.survivors[i]
      expect(sA.id).toBe(sF.id)
      expect(sA.team).toBe(sF.team)
      expect(sA.hp).toBe(sF.hp)
      expect(sA.x).toBe(sF.x)
      expect(sA.y).toBe(sF.y)
    }

    // Verify actions sequence is identical in every tick (modulo definition ID in strings)
    expect(resAlien.logs.length).toBe(resFantasy.logs.length)
    for (let t = 0; t < resAlien.logs.length; t++) {
      const logA = resAlien.logs[t]
      const logF = resFantasy.logs[t]
      expect(logA.tick).toBe(logF.tick)
      expect(logA.actions.length).toBe(logF.actions.length)
      for (let a = 0; a < logA.actions.length; a++) {
        expect(logA.actions[a].type).toBe(logF.actions[a].type)
      }
    }
  })
})
