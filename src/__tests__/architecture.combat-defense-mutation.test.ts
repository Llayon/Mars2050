import { describe, expect, it } from 'vitest'
import { execSync } from 'node:child_process'
import { writeFileSync, unlinkSync, mkdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'

interface LimitsOutput {
  violations: Array<{ rule: string }>
}

function checkRuleInOutput(output: string, rule: string): boolean {
  try {
    const parsed = JSON.parse(output) as LimitsOutput
    return Array.isArray(parsed.violations) && parsed.violations.some(v => v.rule === rule)
  } catch {
    return false
  }
}

describe('architecture rules for combat-core', () => {
  it('detects uncommitted defense resource mutation in combat ecs path', () => {
    const ecsDir = join(process.cwd(), 'packages', 'combat-core', 'src', 'ecs')
    mkdirSync(ecsDir, { recursive: true })
    const badFile = join(ecsDir, 'bad-system.ts')

    try {
      writeFileSync(badFile, 'export function bad(entity: any) { entity.shield += 10 }\n', 'utf8')
      const output = execSync('npx tsx scripts/check-limits.ts --json', { encoding: 'utf8' })
      expect(checkRuleInOutput(output, 'COMBAT_DEFENSE_MUTATION')).toBe(true)
    } catch (err: unknown) {
      const output = (err as { stdout?: Buffer | string }).stdout?.toString() || ''
      expect(checkRuleInOutput(output, 'COMBAT_DEFENSE_MUTATION')).toBe(true)
    } finally {
      if (existsSync(badFile)) unlinkSync(badFile)
    }
  }, 25000)

  it('detects illegal application imports inside packages/combat-core', () => {
    const contractsDir = join(process.cwd(), 'packages', 'combat-core', 'src', 'contracts')
    const badFile = join(contractsDir, 'bad-import.ts')

    try {
      writeFileSync(badFile, "import { something } from '@/domains/resource'\nexport const x = 1\n", 'utf8')
      const output = execSync('npx tsx scripts/check-limits.ts --json', { encoding: 'utf8' })
      expect(checkRuleInOutput(output, 'IMPORT_RULES')).toBe(true)
    } catch (err: unknown) {
      const output = (err as { stdout?: Buffer | string }).stdout?.toString() || ''
      expect(checkRuleInOutput(output, 'IMPORT_RULES')).toBe(true)
    } finally {
      if (existsSync(badFile)) unlinkSync(badFile)
    }
  }, 25000)

  it('detects illegal framework cross-imports inside packages/combat-core', () => {
    const ecsDir = join(process.cwd(), 'packages', 'combat-core', 'src', 'ecs')
    const badFile = join(ecsDir, 'bad-framework-import.ts')

    try {
      writeFileSync(badFile, "import { useState } from 'react'\nexport const dummy = 1\n", 'utf8')
      const output = execSync('npx tsx scripts/check-limits.ts --json', { encoding: 'utf8' })
      expect(checkRuleInOutput(output, 'IMPORT_RULES')).toBe(true)
    } catch (err: unknown) {
      const output = (err as { stdout?: Buffer | string }).stdout?.toString() || ''
      expect(checkRuleInOutput(output, 'IMPORT_RULES')).toBe(true)
    } finally {
      if (existsSync(badFile)) unlinkSync(badFile)
    }
  }, 25000)

  it('detects uncommitted defense mutation in nested systems path', () => {
    const systemsDir = join(process.cwd(), 'packages', 'combat-core', 'src', 'ecs', 'systems')
    const badFile = join(systemsDir, 'bad-nested-defense.ts')

    try {
      writeFileSync(badFile, 'export function mutate(barrier: any) { barrier.duration -= 1 }\n', 'utf8')
      const output = execSync('npx tsx scripts/check-limits.ts --json', { encoding: 'utf8' })
      expect(checkRuleInOutput(output, 'COMBAT_DEFENSE_MUTATION')).toBe(true)
    } catch (err: unknown) {
      const output = (err as { stdout?: Buffer | string }).stdout?.toString() || ''
      expect(checkRuleInOutput(output, 'COMBAT_DEFENSE_MUTATION')).toBe(true)
    } finally {
      if (existsSync(badFile)) unlinkSync(badFile)
    }
  }, 25000)
})
