import { describe, it, expect } from 'vitest'
import { isDeepStrictEqual } from 'node:util'
import { simulateCombat, type BattleInput, type UnitDefinition } from '@mars2050/combat-core'
import { buildMarsPreparedStats } from '../domains/combat/combat.input-translator'

function makeDef(id: string): UnitDefinition {
  return {
    id,
    name: id.toUpperCase(),
    squadSize: 1,
    squadSpacing: 20,
    formation: 'grid',
    baseStats: {
      hp: 100,
      attack: 10,
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

const fixtures: Record<string, unknown> = {
  periodicAbilities: [{ id: 'heal', intervalTicks: 30, targetPolicy: 'self', payload: { kind: 'heal', amount: 10 } }],
  triggerEffects: [{ id: 'heal-hit', event: 'damage_taken', payload: { kind: 'heal', target: 'self', amount: 5 } }],
  transformMode: [{ id: 'assault', mode: 'assault', trigger: 'battle_start', attackMult: 1.2 }],
  fieldEffect: [{ id: 'barrier', kind: 'barrier_dome', radius: 120, intervalTicks: 40, duration: 50, capacity: 100 }],
  controlBeam: { range: 120, progressPerTick: 10, conversionThreshold: 60 },
  formationModifiers: { spacingMultiplier: 1.2, adjacencyBonus: { radius: 60, maxStacks: 2, damageReductionPerAlly: 0.1 } },
  statGrowth: { intervalTicks: 10, maxStacks: 3, attackMultPerStack: 0.1 },
  attackCharge: { intervalTicks: 10, maxStacks: 3, attackMultPerStack: 0.1 },
  reassembly: { delayTicks: 10, hpPercent: 0.5, maxTriggers: 1 },
  rankScaling: { hpMultPerRank: 0.2, damageModifiers: [{ relation: 'same_rank', multiplier: 1.2 }] },
  conditionalRange: [{ target: 'air', rangeAdd: 25 }],
  flatDamageBlock: { amount: 3, perRank: 1, minimumDamage: 1 },
  shieldHitBlock: { charges: 2 },
  targetPriorityProfile: 'highest_max_hp',
  conditionalAttackMode: { minTargets: 2, radius: 30, damageMultiplier: 0.5 },
  sweepAttack: { width: 20, damageMultiplier: 0.5, maxTargets: 3 },
  linePierce: { width: 20, damageMultiplier: 0.5, maxTargets: 3 },
  coneAttack: { angleDeg: 45, damageMultiplier: 0.5, maxTargets: 3 },
  beamAttack: { width: 18, damageMultiplier: 0.5, maxTargets: 2 },
  barrageAttack: { impacts: 2, radius: 20, spreadRadius: 10, damageMultiplier: 0.5 },
  chainAttack: { jumps: 2, radius: 60, damageMultiplier: 0.5, falloff: 0.1 },
  splitFire: { maxTargets: 2, damageMultiplier: 0.5, range: 150 },
  sideWeapon: { damage: 7, range: 160, maxTargets: 1 },
  stealthWhileMoving: true,
}

function makeBattle(key: string, value: unknown): BattleInput {
  const defs = { fighter: makeDef('fighter'), target: makeDef('target') }
  return {
    seed: 42,
    definitions: defs,
    catalog: {
      unitTypes: defs,
      upgrades: {
        modifier: { id: 'modifier', modifiers: { [key]: value } as Record<string, unknown> },
      },
    },
    arena: { width: 600, height: 1200, tileSize: 40, obstacles: [] },
    rules: { maxTicks: 2, timeoutPolicy: 'draw', defenseResolutionMode: 'v9_snapshot' },
    units: [
      { instanceId: 'a', definitionId: 'fighter', team: 'attacker', rank: 2, upgradeIds: ['modifier'], placement: { x: 300, y: 900, angle: 0 } },
      { instanceId: 'd', definitionId: 'target', team: 'defender', rank: 1, upgradeIds: [], placement: { x: 300, y: 300, angle: 0 } },
    ],
    scheduledEffects: [],
  }
}

describe('R5a Pass 11: 24 modifier families detachment parity', () => {
  for (const [key, value] of Object.entries(fixtures)) {
    it(`prepares and survives detachment for modifier: ${key}`, () => {
      const battle = makeBattle(key, value)
      const raw = simulateCombat(battle)

      const prepared = buildMarsPreparedStats('fighter', 2, ['modifier'], battle.catalog, battle.definitions)
      expect(prepared).toBeDefined()
      if (!prepared) throw new Error('prepared is undefined')
      expect(prepared[key as keyof typeof prepared]).toBeDefined()

      const preparedBattle = structuredClone(battle)
      preparedBattle.units[0].preparedStats = prepared
      const retained = simulateCombat(preparedBattle)

      // Retained upgradeId simulation matches raw simulation
      expect(retained.winner).toEqual(raw.winner)
      expect(retained.elapsedTicks).toEqual(raw.elapsedTicks)
      expect(retained.initialState).toEqual(raw.initialState)

      // Detached simulation matches retained simulation
      preparedBattle.units[0].upgradeIds = []
      const detached = simulateCombat(preparedBattle)
      expect(isDeepStrictEqual(detached.initialState, retained.initialState)).toBe(true)
      expect(isDeepStrictEqual(detached.logs, retained.logs)).toBe(true)
    })
  }
})
