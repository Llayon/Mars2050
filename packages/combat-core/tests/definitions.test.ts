import { describe, expect, it } from 'vitest'
import type { BattleInput, UnitDefinition } from '../src/contracts/index.js'
import { mapDefinitionToUnitTypeConfig } from '../src/combat.definition-mapper.js'
import { simulateCombat } from '../src/facade/combat-facade.js'

function def(id: string, over: Partial<UnitDefinition['baseStats']> = {}): UnitDefinition {
  return {
    id,
    name: id,
    baseStats: {
      hp: 5000, attack: 0, defense: 0, speed: 1, range: 1,
      attackType: 'single', actionCooldownMax: 10, turnSpeed: 5,
      size: 'M', combatTags: [], ...over,
    },
    squadSize: 1, squadSpacing: 20, formation: 'grid',
  }
}

function battle(seed: number, definitions: Record<string, UnitDefinition>, units: BattleInput['units'], maxTicks: number): ReturnType<typeof simulateCombat> {
  return simulateCombat({
    seed,
    arena: { width: 600, height: 1200, tileSize: 40, obstacles: [] },
    rules: { maxTicks, timeoutPolicy: 'draw', defenseResolutionMode: 'v9_snapshot' },
    definitions,
    units,
    scheduledEffects: [],
  })
}

describe('public definitions execute (ISO-01, ISO-02)', () => {
  it('passes statusOnHit through the mapper without sharing references', () => {
    const burn = { type: 'burn', duration: 25, value: 5 } as const
    const mapped = mapDefinitionToUnitTypeConfig(def('mage', { statusOnHit: [{ ...burn }] }))
    expect(mapped.baseStats.statusOnHit).toEqual([{ ...burn }])
    expect(mapped.baseStats.statusOnHit).not.toBeUndefined()
  })

  it('passes healTargetTags through the mapper as a copy', () => {
    const mapped = mapDefinitionToUnitTypeConfig(def('healer', { healTargetTags: ['organic'] }))
    expect(mapped.baseStats.healTargetTags).toEqual(['organic'])
  })

  it('rejects beam and spread explicitly instead of coercing to single', () => {
    for (const attackType of ['beam', 'spread'] as const) {
      let code = ''
      try {
        mapDefinitionToUnitTypeConfig(def(`u_${attackType}`, { attackType }))
      } catch (err) {
        code = (err as { code?: string }).code ?? ''
      }
      expect(code).toBe('UNSUPPORTED_ATTACK_TYPE')
    }
  })

  it('keeps every executable attack type mapped 1:1 (no silent coercion)', () => {
    for (const attackType of ['single', 'aoe', 'spawn', 'heal'] as const) {
      expect(mapDefinitionToUnitTypeConfig(def(`u_${attackType}`, { attackType })).baseStats.attackType).toBe(attackType)
    }
  })

  it('applies burn on hit and deals follow-up status damage (control stays clean)', () => {
    const mage = def('mage', { hp: 300, attack: 30, speed: 4, range: 6, combatTags: ['magic'], statusOnHit: [{ type: 'burn', duration: 25, value: 10 }] })
    const plain = def('plain', { hp: 300, attack: 30, speed: 4, range: 6, combatTags: ['magic'] })
    const tank = def('tank', { hp: 5000 })
    const units = (id: string): BattleInput['units'] => [
      { instanceId: 'att', definitionId: id, team: 'attacker', placement: { x: 300, y: 1000 }, rank: 1, upgradeIds: [] },
      { instanceId: 'def', definitionId: 'tank', team: 'defender', placement: { x: 300, y: 800 }, rank: 1, upgradeIds: [] },
    ]
    const burnBattle = battle(101, { mage, tank }, units('mage'), 250)
    const controlBattle = battle(101, { plain, tank }, units('plain'), 250)

    const isBurnApply = (a: { type?: string; statusType?: string }) => a.type === 'status_apply' && a.statusType === 'burn'
    const isBurnTick = (a: { type?: string; statusType?: string }) => a.type === 'status_tick' && a.statusType === 'burn'
    const isBurnDamage = (a: { type?: string; statusType?: string }) => a.type === 'damage' && a.statusType === 'burn'

    const burnApplies = burnBattle.logs.flatMap(t => t.actions).filter(a => isBurnApply(a as { type?: string; statusType?: string }))
    const burnTicks = burnBattle.logs.flatMap(t => t.actions).filter(a => isBurnTick(a as { type?: string; statusType?: string }))
    const burnDamages = burnBattle.logs.flatMap(t => t.actions).filter(a => isBurnDamage(a as { type?: string; statusType?: string }))

    // 1. Separate assertions for status_apply, status_tick, and positive burn damage
    expect(burnApplies.length).toBeGreaterThan(0)
    expect(burnTicks.length).toBeGreaterThan(0)
    expect(burnDamages.length).toBeGreaterThan(0)

    // 2. Verified target entity and attribution
    for (const a of burnApplies) {
      expect((a as { unitId?: string }).unitId).toBe('def')
    }
    for (const a of burnTicks) {
      expect((a as { targetId?: string }).targetId).toBe('def')
      expect(((a as { value?: number }).value ?? 0)).toBeGreaterThan(0)
    }
    let totalBurnDamage = 0
    for (const a of burnDamages) {
      expect((a as { targetId?: string }).targetId).toBe('def')
      const dmg = (a as { damage?: number }).damage ?? 0
      expect(dmg).toBeGreaterThan(0)
      totalBurnDamage += dmg
    }
    expect(totalBurnDamage).toBeGreaterThan(0)

    // 3. Proper HP loss on defender: burn battle defender lost more HP than control
    const burnDef = burnBattle.survivors.find(u => u.id === 'def')!
    const controlDef = controlBattle.survivors.find(u => u.id === 'def')!
    const burnHpLoss = 5000 - burnDef.hp
    const controlHpLoss = 5000 - controlDef.hp
    expect(burnHpLoss).toBeGreaterThan(controlHpLoss)

    // 4. Control battle stays clean: 0 status_apply, 0 status_tick, 0 burn damage
    const controlApplies = controlBattle.logs.flatMap(t => t.actions).filter(a => isBurnApply(a as { type?: string; statusType?: string }))
    const controlTicks = controlBattle.logs.flatMap(t => t.actions).filter(a => isBurnTick(a as { type?: string; statusType?: string }))
    const controlDamages = controlBattle.logs.flatMap(t => t.actions).filter(a => isBurnDamage(a as { type?: string; statusType?: string }))
    expect(controlApplies.length).toBe(0)
    expect(controlTicks.length).toBe(0)
    expect(controlDamages.length).toBe(0)
  })

  it('heals allowed allies only and never exceeds max HP', () => {
    const healer = def('healer', { hp: 300, attack: 20, speed: 4, range: 4, attackType: 'heal', healTargetTags: ['organic'], combatTags: ['healer'] })
    const organic = def('ally_org', { hp: 120, combatTags: ['organic'] })
    const mech = def('ally_mech', { hp: 120, combatTags: ['mechanical'] })
    const foe = def('foe', { attack: 5 })
    const result = battle(102, { healer, ally_org: organic, ally_mech: mech, foe }, [
      { instanceId: 'healer', definitionId: 'healer', team: 'attacker', placement: { x: 300, y: 1000 }, rank: 1, upgradeIds: [] },
      { instanceId: 'org', definitionId: 'ally_org', team: 'attacker', placement: { x: 300, y: 950 }, rank: 1, upgradeIds: [], currentHp: 30 },
      { instanceId: 'mech', definitionId: 'ally_mech', team: 'attacker', placement: { x: 350, y: 1000 }, rank: 1, upgradeIds: [], currentHp: 30 },
      { instanceId: 'foe', definitionId: 'foe', team: 'defender', placement: { x: 300, y: 200 }, rank: 1, upgradeIds: [] },
    ], 300)
    const heals = result.logs.flatMap(t => t.actions).filter(a => a.type === 'heal')
    const orgN = heals.filter(a => (a as { targetId?: string }).targetId === 'org').length
    const mechN = heals.filter(a => (a as { targetId?: string }).targetId === 'mech').length
    expect(orgN).toBeGreaterThan(0)
    expect(mechN).toBe(0)
    for (const u of result.survivors) {
      expect(u.hp).toBeLessThanOrEqual(u.maxHp)
    }
  })

  it('rejects beam/spread battles before simulation with a typed error', () => {
    for (const attackType of ['beam', 'spread'] as const) {
      const u = def(`u_${attackType}`, { hp: 100, attack: 10, range: 3, attackType })
      const foe = def('foe', { hp: 100, attack: 10, range: 3 })
      let code = ''
      try {
        battle(103, { [`u_${attackType}`]: u, foe }, [
          { instanceId: 'a', definitionId: `u_${attackType}`, team: 'attacker', placement: { x: 300, y: 900 }, rank: 1, upgradeIds: [] },
          { instanceId: 'b', definitionId: 'foe', team: 'defender', placement: { x: 300, y: 700 }, rank: 1, upgradeIds: [] },
        ], 50)
      } catch (err) {
        code = (err as { code?: string }).code ?? ''
      }
      expect(code).toBe('UNSUPPORTED_ATTACK_TYPE')
    }
  })
})
