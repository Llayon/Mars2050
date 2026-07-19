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
  periodicAbilities: 'combat.ecs-periodic-ability-phase.test.ts',
  triggerEffects: 'combat.ecs-post-hit-triggers.test.ts',
  transformMode: 'combat.ecs-transform-mode-phase.test.ts',
  controlBeam: 'combat.ecs-control-beam-phase.test.ts',
  fieldEffect: 'combat.ecs-field-effect-phase.test.ts',
  formationModifiers: 'combat.ecs-formation-bonus-phase.test.ts',
  statGrowth: 'combat.ecs-growth-charge-phase.test.ts',
  attackCharge: 'combat.ecs-growth-charge-phase.test.ts',
  reassembly: 'combat.ecs-reassembly-phase.test.ts',
  rankScaling: 'combat.rank-scaling.test.ts',
  conditionalRange: 'combat.ecs-conditional-range.test.ts',
  flatDamageBlock: 'combat.flat-block-armor.test.ts',
  shieldHitBlock: 'combat.shield-hit-block.test.ts',
  targetPriorityProfile: 'combat.ecs-targeting-boundary.test.ts',
  conditionalAttackMode: 'combat.ecs-conditional-attack.test.ts',
  sweepAttack: 'combat.ecs-sweep-attack.test.ts',
  stealthWhileMoving: 'combat.ecs-stealth-action.test.ts',
  linePierce: 'combat.ecs-directional-geometry.test.ts',
  coneAttack: 'combat.ecs-directional-geometry.test.ts',
  beamAttack: 'combat.ecs-directional-geometry.test.ts',
  barrageAttack: 'combat.ecs-barrage-attack.test.ts',
  chainAttack: 'combat.ecs-chain-attack.test.ts',
  splitFire: 'combat.ecs-split-fire.test.ts',
  sideWeapon: 'combat.ecs-side-weapon.test.ts',
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
      'combat.ecs-barrage-attack.test.ts',
      'combat.ecs-chain-attack.test.ts',
      'combat.ecs-conditional-attack.test.ts',
      'combat.ecs-conditional-range.test.ts',
      'combat.ecs-control-beam-phase.test.ts',
      'combat.ecs-directional-geometry.test.ts',
      'combat.ecs-directional-geometry.test.ts',
      'combat.ecs-directional-geometry.test.ts',
      'combat.ecs-field-effect-phase.test.ts',
      'combat.ecs-formation-bonus-phase.test.ts',
      'combat.ecs-growth-charge-phase.test.ts',
      'combat.ecs-growth-charge-phase.test.ts',
      'combat.ecs-periodic-ability-phase.test.ts',
      'combat.ecs-post-hit-triggers.test.ts',
      'combat.ecs-reassembly-phase.test.ts',
      'combat.ecs-side-weapon.test.ts',
      'combat.ecs-split-fire.test.ts',
      'combat.ecs-stealth-action.test.ts',
      'combat.ecs-sweep-attack.test.ts',
      'combat.ecs-targeting-boundary.test.ts',
      'combat.ecs-transform-mode-phase.test.ts',
      'combat.flat-block-armor.test.ts',
      'combat.rank-scaling.test.ts',
      'combat.shield-hit-block.test.ts',
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
