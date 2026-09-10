import { describe, expect, it } from 'vitest'
import { execSync } from 'node:child_process'
import { writeFileSync, unlinkSync, mkdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'

describe('architecture rules for combat-core', () => {
  it('detects uncommitted defense resource mutation in combat ecs path', () => {
    const ecsDir = join(process.cwd(), 'packages', 'combat-core', 'src', 'ecs')
    mkdirSync(ecsDir, { recursive: true })
    const badFile = join(ecsDir, 'bad-system.ts')

    try {
      writeFileSync(badFile, 'export function bad(entity: any) { entity.shield += 10 }\n', 'utf8')
      const output = execSync('npx tsx scripts/check-limits.ts --json', { encoding: 'utf8' })
      const parsed = JSON.parse(output)
      const hasViolation = parsed.violations.some((v: any) => v.rule === 'COMBAT_DEFENSE_MUTATION')
      expect(hasViolation).toBe(true)
    } catch (err: any) {
      const output = err.stdout?.toString() || ''
      const parsed = JSON.parse(output)
      const hasViolation = parsed.violations.some((v: any) => v.rule === 'COMBAT_DEFENSE_MUTATION')
      expect(hasViolation).toBe(true)
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
      const parsed = JSON.parse(output)
      const hasViolation = parsed.violations.some((v: any) => v.rule === 'IMPORT_RULES')
      expect(hasViolation).toBe(true)
    } catch (err: any) {
      const output = err.stdout?.toString() || ''
      const parsed = JSON.parse(output)
      const hasViolation = parsed.violations.some((v: any) => v.rule === 'IMPORT_RULES')
      expect(hasViolation).toBe(true)
    } finally {
      if (existsSync(badFile)) unlinkSync(badFile)
    }
  }, 25000)
})
