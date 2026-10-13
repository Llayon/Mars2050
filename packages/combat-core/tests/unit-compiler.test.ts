import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { compileUnit } from '../src/combat.unit-compiler.js'
import type { SpawnInheritance } from '../src/combat.unit-build.types.js'

const testCatalog = {
  unitTypes: {
    marine: {
      name: 'Marine',
      baseStats: {
        hp: 100,
        attack: 10,
        defense: 2,
        speed: 5,
        range: 40,
        attackType: 'single' as const,
        rankScaling: {
          attackMultPerRank: 0.15,
          hpMultPerRank: 0.15,
        },
      },
      hireCost: {},
    },
  },
  upgrades: {
    hollow_point: {
      id: 'hollow_point',
      name: 'Hollow Point',
      allowedUnits: ['all'],
      modifiers: { attackMult: 1.5 },
    },
  },
}

function compile(inheritance?: SpawnInheritance) {
  return compileUnit({
    definitionId: 'marine',
    identity: { id: `marine-${inheritance ?? 'squad'}`, team: 'attacker' },
    loadout: { rank: 3, upgradeIds: ['hollow_point'] },
    placement: { x: 100, y: 200, angle: 0 },
    spawn: inheritance ? { inheritance } : undefined,
    catalog: testCatalog,
  })!
}

describe('combat unit compiler', () => {
  it('applies squad loadout while base summons inherit neither rank nor upgrades', () => {
    const squad = compile()
    const summon = compile('base')

    expect(squad.components.identity.rank).toBe(3)
    expect(squad.components.combat.attack)
      .toBeGreaterThan(summon.components.combat.attack)
    expect(summon.components.identity.rank).toBeUndefined()
  })

  it('supports explicit owner loadout inheritance', () => {
    const squad = compile()
    const summon = compile('owner_loadout')

    expect(summon.components.identity.rank).toBe(3)
    expect(summon.components.combat.attack)
      .toBe(squad.components.combat.attack)
  })

  it('owns compiled runtime rules independently per entity', () => {
    const first = compile()
    const second = compile()
    first.runtimeRules.baseCombatTags.push('summoned')

    expect(second.runtimeRules.baseCombatTags).not.toContain('summoned')
  })

  it('keeps the ECS runtime independent from the design catalog', () => {
    const root = join(process.cwd(), 'packages', 'combat-core', 'src', 'ecs')
    const files = collectTypeScriptFiles(root)
    const violations = files.filter(file => {
      const source = readFileSync(file, 'utf8')
      return source.includes('UNIT_TYPES') ||
        source.includes('combat.config')
    })

    expect(violations).toEqual([])
  })
})

function collectTypeScriptFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return collectTypeScriptFiles(path)
    return entry.name.endsWith('.ts') ? [path] : []
  })
}
