import { describe, expect, it } from 'vitest'
import type { SimUnit } from '@/domains/combat/combat.sim.types'
import { createRuntimeUnitFromConfig } from '@/domains/combat/combat.unit-factory'
import { PRNG } from '@/domains/combat/combat.utils'
import { CombatWorld } from '@/domains/combat/ecs/combat-world'
import { EntitySpatialIndex } from '@/domains/combat/ecs/entity-spatial-index'
import { applyEcsSingleDamage } from '@/domains/combat/ecs/systems/damage-system'
import { resolveEcsDeath } from '@/domains/combat/ecs/systems/death-system'

type Mode = 'v8_sequential' | 'v9_snapshot'
type ScenarioPatch = Partial<SimUnit> & { rawDamage: number; options?: Parameters<typeof applyEcsSingleDamage>[5]; sourcePatch?: Partial<SimUnit> }

function unit(id: string, team: 'attacker' | 'defender'): SimUnit {
  return createRuntimeUnitFromConfig({ id, team, type: 'marine', x: 100, y: team === 'attacker' ? 100 : 106, currentAngle: 0 })!
}

function runSameSingletonScenario(mode: Mode, patch: ScenarioPatch): unknown {
  const { rawDamage, options, sourcePatch, ...targetPatch } = patch
  const attacker = unit('attacker', 'attacker')
  const target = unit('target', 'defender')
  Object.assign(attacker, sourcePatch)
  Object.assign(target, targetPatch)
  const world = new CombatWorld([attacker, target])
  const spatial = new EntitySpatialIndex()
  spatial.rebuild(world)
  world.resources.set('entitySpatial', spatial)
  world.resources.set('defenseResolutionMode', mode)
  const actions: Parameters<typeof applyEcsSingleDamage>[4] = []
  const attackerId = world.getEntityId('attacker')!
  const targetId = world.getEntityId('target')!
  applyEcsSingleDamage(world, attackerId, targetId, rawDamage, actions, {
    allowPercentHpDamage: false,
    interceptable: false,
    ...options,
  })
  if (mode === 'v8_sequential') resolveEcsDeath(world, targetId, attackerId, actions)
  const targetVitality = world.stores.vitality.require(targetId)
  const targetDefense = world.stores.defense.require(targetId)
  return {
    hp: Math.max(0, targetVitality.hp),
    dead: targetVitality.isDead,
    shield: targetVitality.shield,
    maxShield: targetVitality.maxShield,
    shieldHitBlockCharges: targetDefense.shieldHitBlockCharges ?? 0,
    reactiveArmorCharges: targetDefense.reactiveArmorCharges ?? 0,
    statuses: world.stores.statusControl.require(targetId).statusEffects,
    targetMark: world.stores.statusControl.require(targetId).targetMark,
    actions: actions.map(action => ({
      type: action.type,
      unitId: action.unitId,
      targetId: action.targetId,
      damage: action.damage,
      bonusDamage: action.bonusDamage,
    })).sort((left, right) => JSON.stringify(left) < JSON.stringify(right) ? -1 : JSON.stringify(left) > JSON.stringify(right) ? 1 : 0),
    attackerHp: world.stores.vitality.require(attackerId).hp,
  }
}

describe('V8/V9 singleton differential contracts', () => {
  it('matches normalized defense outcomes across the required modifier matrix', () => {
    const cases: ScenarioPatch[] = [
      { rawDamage: 20 },
      { rawDamage: 20, shield: 8, maxShield: 8 },
      { rawDamage: 20, defense: 4 },
      { rawDamage: 20, defense: 10, statusEffects: [{ type: 'armor_broken', duration: 3, value: 0.5, tickInterval: 0, nextTickIn: 0 }] },
      { rawDamage: 0, options: { allowMinimumDamage: false } },
      { rawDamage: 20, statusEffects: [{ type: 'vulnerable', duration: 3, value: 0.5, tickInterval: 0, nextTickIn: 0 }] },
      { rawDamage: 20, statusEffects: [{ type: 'damage_reduction', duration: 3, value: 0.5, tickInterval: 0, nextTickIn: 0 }] },
      { rawDamage: 20, statusEffects: [{ type: 'revealed', duration: 3, tickInterval: 0, nextTickIn: 0 }], isBurrowed: true, burrowConfig: { damageReduction: 0.5 } },
      { rawDamage: 20, targetMark: { sourceUnitId: 'attacker', duration: 3, damageMultiplier: 0.5 } },
      { rawDamage: 20, isMoving: true, damageReductionWhileMoving: 0.5 },
      { rawDamage: 20, isBurrowed: true, burrowConfig: { damageReduction: 0.5 } },
      { rawDamage: 20, flatDamageBlock: { amount: 3 } },
      { rawDamage: 20, reactiveArmorCharges: 1, reactiveArmorBlock: 5 },
      { rawDamage: 20, shield: 8, maxShield: 8, shieldHitBlockCharges: 1 },
      { rawDamage: 20, sourcePatch: { shieldDamageMult: 2 } },
      { rawDamage: 20, sourcePatch: { statusEffects: [{ type: 'output_suppressed', duration: 3, value: 0.5, tickInterval: 0, nextTickIn: 0 }] } },
      { rawDamage: 20, sourcePatch: { statusEffects: [{ type: 'accuracy_reduced', duration: 3, value: 0.5, tickInterval: 0, nextTickIn: 0 }] } },
      { rawDamage: 20, sourcePatch: { armorPierceRatio: 1 }, defense: 10 },
      { rawDamage: 20, sourcePatch: { antiAirDamageMult: 2 }, isFlying: true },
      { rawDamage: 20, sourcePatch: { groundDamageMult: 2 } },
      { rawDamage: 20, sourcePatch: { rank: 2, rankScaling: { damageModifiers: [{ relation: 'lower_rank', multiplier: 1.5 }] } }, rank: 1 },
      { rawDamage: 20, sourcePatch: { summonCounterDamageMult: 2 }, isTemporary: true },
      { rawDamage: 20, hp: 10, maxHp: 100, sourcePatch: { executeThreshold: 20 } },
      { rawDamage: 20, hp: 50, maxHp: 100, sourcePatch: { hp: 10, maxHp: 100, lifestealMult: 0.5 } },
      { rawDamage: 20, hp: 40, maxHp: 100 },
    ]
    for (const [index, scenario] of cases.entries()) {
      const v8 = runSameSingletonScenario('v8_sequential', scenario)
      const v9 = runSameSingletonScenario('v9_snapshot', scenario)
      expect({ index, v9 }).toEqual({ index, v9: v8 })
    }
  })

  it('keeps the seeded singleton replay stable for repeated runs', () => {
    const seeds = Array.from({ length: 25 }, (_, index) => index + 1)
    for (const seed of seeds) {
      const rng = new PRNG(seed)
      const rawDamage = 5 + Math.floor(rng.next() * 40)
      const scenario = { rawDamage, shield: Math.floor(rng.next() * 10), maxShield: 10 }
      expect(runSameSingletonScenario('v9_snapshot', scenario)).toEqual(runSameSingletonScenario('v9_snapshot', scenario))
    }
  })
})
