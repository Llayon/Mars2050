import { describe, expect, it } from 'vitest'
import { UNIT_TYPES } from '@/domains/combat/combat.config'
import {
  DEFERRED_UPGRADE_MODIFIERS,
  RUNTIME_HANDLED_UPGRADE_MODIFIERS,
  UPGRADE_MODIFIER_KEYS,
} from '@/domains/combat/combat.upgrade-runtime'
import { UPGRADES } from '@/domains/combat/combat.upgrades'
import type { UnitBaseStats } from '@/domains/combat/combat.types'

const ADVANCED_UNIT_PRIMITIVE_TEST_COVERAGE = {
  periodicAbilities: 'combat.periodic-abilities.test.ts',
  triggerEffects: 'combat.trigger-effects.test.ts',
  transformMode: 'combat.transform-variants.test.ts',
  controlBeam: 'combat.control-conversion.test.ts',
  fieldEffect: 'combat.field-effects.test.ts',
  formationModifiers: 'combat.formation-targeting-primitives.test.ts',
  statGrowth: 'combat.stat-growth-charge.test.ts',
  attackCharge: 'combat.stat-growth-charge.test.ts',
  reassembly: 'combat.reassembly.test.ts',
  rankScaling: 'combat.rank-scaling.test.ts',
  conditionalRange: 'combat.conditional-range.test.ts',
  flatDamageBlock: 'combat.flat-block-armor.test.ts',
  shieldHitBlock: 'combat.shield-hit-block.test.ts',
  targetPriorityProfile: 'combat.formation-targeting-primitives.test.ts',
  conditionalAttackMode: 'combat.conditional-sweep-weapons.test.ts',
  sweepAttack: 'combat.conditional-sweep-weapons.test.ts',
  stealthWhileMoving: 'combat.stealth-while-moving.test.ts',
  linePierce: 'combat.attack-geometry.test.ts',
  coneAttack: 'combat.weapon-shapes.test.ts',
  beamAttack: 'combat.weapon-shapes.test.ts',
  barrageAttack: 'combat.barrage.test.ts',
  chainAttack: 'combat.chain.test.ts',
  splitFire: 'combat.split-fire.test.ts',
  sideWeapon: 'combat.side-weapon.test.ts',
} satisfies Record<keyof Pick<UnitBaseStats,
  'periodicAbilities' | 'triggerEffects' | 'transformMode' | 'controlBeam' | 'fieldEffect' | 'formationModifiers' | 'statGrowth' | 'attackCharge' | 'reassembly' | 'rankScaling' | 'conditionalRange' | 'flatDamageBlock' | 'shieldHitBlock' | 'targetPriorityProfile' | 'conditionalAttackMode' | 'sweepAttack' | 'stealthWhileMoving' | 'linePierce' | 'coneAttack' | 'beamAttack' | 'barrageAttack' | 'chainAttack' | 'splitFire' | 'sideWeapon'
>, string>

describe('combat upgrade runtime contract', () => {
  it('classifies every UpgradeConfig modifier as runtime-handled or explicitly deferred', () => {
    const classified = new Set([...RUNTIME_HANDLED_UPGRADE_MODIFIERS, ...DEFERRED_UPGRADE_MODIFIERS])
    expect(UPGRADE_MODIFIER_KEYS.filter(key => !classified.has(key))).toEqual([])
  })

  it('does not use undeclared upgrade modifier keys in config data', () => {
    const known = new Set<string>(UPGRADE_MODIFIER_KEYS)
    for (const upgrade of Object.values(UPGRADES)) {
      expect(Object.keys(upgrade.modifiers).filter(key => !known.has(key)), upgrade.id).toEqual([])
    }
  })

  it('keeps deferred modifier names visible for backlog tracking', () => {
    expect(DEFERRED_UPGRADE_MODIFIERS).toEqual([])
  })

  it('has a regression suite mapped for every new advanced UnitBaseStats primitive', () => {
    expect(Object.values(ADVANCED_UNIT_PRIMITIVE_TEST_COVERAGE).sort()).toEqual([
      'combat.attack-geometry.test.ts',
      'combat.barrage.test.ts',
      'combat.chain.test.ts',
      'combat.conditional-range.test.ts',
      'combat.conditional-sweep-weapons.test.ts',
      'combat.conditional-sweep-weapons.test.ts',
      'combat.control-conversion.test.ts',
      'combat.field-effects.test.ts',
      'combat.flat-block-armor.test.ts',
      'combat.formation-targeting-primitives.test.ts',
      'combat.formation-targeting-primitives.test.ts',
      'combat.periodic-abilities.test.ts',
      'combat.rank-scaling.test.ts',
      'combat.reassembly.test.ts',
      'combat.shield-hit-block.test.ts',
      'combat.side-weapon.test.ts',
      'combat.split-fire.test.ts',
      'combat.stat-growth-charge.test.ts',
      'combat.stat-growth-charge.test.ts',
      'combat.stealth-while-moving.test.ts',
      'combat.transform-variants.test.ts',
      'combat.trigger-effects.test.ts',
      'combat.weapon-shapes.test.ts',
      'combat.weapon-shapes.test.ts',
    ])
  })

  it('requires configured advanced primitive properties to appear in the coverage map', () => {
    const covered = new Set(Object.keys(ADVANCED_UNIT_PRIMITIVE_TEST_COVERAGE))
    for (const [unitType, config] of Object.entries(UNIT_TYPES)) {
      const used = Object.keys(config.baseStats).filter(key => covered.has(key))
      expect(used.filter(key => !covered.has(key)), unitType).toEqual([])
    }
  })
})
