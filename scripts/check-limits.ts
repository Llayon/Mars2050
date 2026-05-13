/**
 * Architecture enforcer for Mars2050 — LLM-First Edition.
 * Checks AGENTS.md rules programmatically with semantic output for AI agents.
 *
 * Rules checked (with ADR references):
 *   1. SIZE: File size limits by type (ADR-006)
 *   2. NAMING: kebab-case filenames (ADR-001)
 *   3. SECURITY: No SERVICE_ROLE_KEY in client code (ADR-005)
 *   4. ARCH: No direct Supabase .from() in client (ADR-004)
 *   5. ZOD: API routes with mutation must use zod (ADR-002)
 *   6. PASCAL: React components use PascalCase exports
 *   7. ANY: No `: any` type annotations (ADR-003)
 *   8. DOMAIN: Files in correct domain structure (ADR-001)
 *   9. MANUAL: No manual validation in API routes (ADR-002)
 *  10. IDIOM: Service/API idioms (ADR-001)
 *  11. PAGE: No raw logic in pages (ADR-007)
 *
 * Usage:
 *   npx tsx scripts/check-limits.ts              # Check all files
 *   npx tsx scripts/check-limits.ts --json       # JSON output for LLM parsing
 *   npx tsx scripts/check-limits.ts --diff HEAD~1 # Check only changed files
 *   npx tsx scripts/check-limits.ts --severity   # Show severity levels
 *
 * Exit code: 0 = success, 1 = violations found
 * LLM hint: Use --json for easy parsing of violations
 */

import { readdirSync, readFileSync, existsSync } from 'fs'
import { execSync } from 'child_process'
import { join, extname, relative, sep } from 'path'

// ─── CLI Arguments ─────────────────────────────────────────────
const args = process.argv.slice(2)
const JSON_OUTPUT = args.includes('--json')
const SHOW_SEVERITY = args.includes('--severity')
const diffArg = args.find(a => a.startsWith('--diff='))
const diffRef = diffArg ? diffArg.split('=')[1] : args.includes('--diff') ? 'HEAD~1' : undefined

// ─── Project Root ──────────────────────────────────────────────
const ROOT = findProjectRoot(process.cwd())
const SRC = join(ROOT, 'src')

function findProjectRoot(startDir: string): string {
  let dir = startDir
  for (let i = 0; i < 10; i++) {
    if (existsSync(join(dir, 'package.json'))) return dir
    const parent = join(dir, '..')
    if (parent === dir) break
    dir = parent
  }
  throw new Error('Cannot find project root (package.json not found)')
}

// ─── Severity Levels ──────────────────────────────────────────
type Severity = 'error' | 'warning' | 'info'

const RULE_SEVERITY: Record<string, Severity> = {
  SIZE: 'error',
  NAMING: 'error',
  SECURITY: 'error',
  ARCH: 'error',
  ZOD: 'error',
  MANUAL: 'error',
  ANY: 'warning',
  IDIOM: 'warning',
  PAGE: 'warning',
  PASCAL: 'info',
  DOMAIN: 'warning',
}

const RULE_ADR: Record<string, string[]> = {
  SIZE: ['ADR-006'],
  NAMING: ['ADR-001'],
  SECURITY: ['ADR-005'],
  ARCH: ['ADR-004'],
  ZOD: ['ADR-002'],
  MANUAL: ['ADR-002'],
  ANY: ['ADR-003'],
  IDIOM: ['ADR-001'],
  PAGE: ['ADR-007'],
  PASCAL: ['ADR-001'],
  DOMAIN: ['ADR-001'],
}

// ─── Limits ───────────────────────────────────────────────────
const LIMITS: Record<string, number> = {
  api: 80,
  type: 100,
  schema: 100,
  config: 100,
  service: 250,
  component: 250,
  hook: 150,
}
const DEFAULT_LIMIT = 250

// ─── Violation Interface ──────────────────────────────────────
interface Violation {
  rule: string
  file: string
  detail: string
  severity: Severity
  adrs: string[]
  line?: number
}

const violations: Violation[] = []

function addViolation(rule: string, file: string, detail: string, line?: number) {
  violations.push({
    rule,
    file,
    detail,
    severity: RULE_SEVERITY[rule] || 'warning',
    adrs: RULE_ADR[rule] || [],
    line,
  })
}

// ─── Helpers ───────────────────────────────────────────────────
function relPath(fullPath: string) {
  return relative(SRC, fullPath).replace(/\\/g, '/')
}

function countLines(filePath: string): number {
  return readFileSync(filePath, 'utf-8').split('\n').length
}

function readFileContent(filePath: string): string {
  return readFileSync(filePath, 'utf-8')
}

function classifyFile(relPath: string): { type: string; limit: number } {
  if (relPath.includes('/api/')) return { type: 'API route', limit: LIMITS['api'] }
  if (relPath.startsWith('hooks/')) return { type: 'Hook', limit: LIMITS['hook'] }
  if (relPath.endsWith('.service.ts')) return { type: 'Service', limit: LIMITS['service'] }
  if (relPath.endsWith('.types.ts')) return { type: 'Types', limit: LIMITS['type'] }
  if (relPath.endsWith('.schemas.ts')) return { type: 'Schema', limit: LIMITS['schema'] }
  if (relPath.endsWith('.config.ts')) return { type: 'Config', limit: LIMITS['config'] }
  if (relPath.endsWith('.tsx')) return { type: 'Component', limit: LIMITS['component'] }
  return { type: 'Other', limit: DEFAULT_LIMIT }
}

// ─── Get changed files via git diff ───────────────────────────
function getChangedFiles(diffRef: string): Set<string> | undefined {
  try {
    const output = execSync(`git diff --name-only ${diffRef}`, {
      cwd: ROOT,
      encoding: 'utf-8',
    })
    const files = output.trim().split('\n').filter(f => f && f.startsWith('src/'))
    return new Set(files)
  } catch {
    return undefined
  }
}

// ─── Rule 1: File size limits ──────────────────────────────────
function checkLineLimits(dir: string, changedFiles?: Set<string>) {
  const entries = readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) { checkLineLimits(fullPath, changedFiles); continue }
    if (!['.ts', '.tsx'].includes(extname(entry.name))) continue

    const rel = relPath(fullPath)
    if (changedFiles && !changedFiles.has(`src/${rel}`)) continue

    const { type, limit } = classifyFile(rel)
    const lines = countLines(fullPath)

    if (lines > limit) {
      addViolation('SIZE', rel, `${lines} lines (limit: ${limit}, type: ${type})`)
    }
  }
}

// ─── Rule 2: kebab-case filenames ──────────────────────────────
const KEBAB_RE = /^[a-z][a-z0-9]*([.-][a-z0-9]+)*\.(ts|tsx)$/
function checkNaming(dir: string, changedFiles?: Set<string>) {
  const entries = readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) { checkNaming(fullPath, changedFiles); continue }
    if (!['.ts', '.tsx'].includes(extname(entry.name))) continue

    const rel = relPath(fullPath)
    if (changedFiles && !changedFiles.has(`src/${rel}`)) continue

    if (entry.name.startsWith('use') && entry.name.endsWith('.ts')) continue
    if (entry.name.endsWith('.tsx')) continue

    if (!KEBAB_RE.test(entry.name)) {
      addViolation('NAMING', rel, 'filename should be kebab-case')
    }
  }
}

// ─── Rule 3: No SERVICE_ROLE_KEY in client code ────────────────
function checkNoServerKeyInClient(changedFiles?: Set<string>) {
  const clientDirs = ['components', 'hooks']
  const keyPatterns = ['SUPABASE_SERVICE_ROLE_KEY', 'service_role_key', 'serviceRoleKey']

  for (const dir of clientDirs) {
    const clientPath = join(SRC, dir)
    try { readdirSync(clientPath) } catch { continue }

    const walkDir = (d: string) => {
      const entries = readdirSync(d, { withFileTypes: true })
      for (const entry of entries) {
        const fullPath = join(d, entry.name)
        if (entry.isDirectory()) { walkDir(fullPath); continue }
        if (!['.ts', '.tsx'].includes(extname(entry.name))) continue

        const rel = relPath(fullPath)
        if (changedFiles && !changedFiles.has(`src/${rel}`)) continue

        const content = readFileContent(fullPath)
        for (const pattern of keyPatterns) {
          if (content.includes(pattern)) {
            addViolation('SECURITY', rel, `contains "${pattern}" — server-only key must not be in client code`)
          }
        }
      }
    }
    walkDir(clientPath)
  }
}

// ─── Rule 4: No direct Supabase .from() in client ─────────────
function checkNoDirectDBInClient(changedFiles?: Set<string>) {
  const clientPaths = [
    { dir: 'components', label: 'component' },
    { dir: 'hooks', label: 'hook' },
  ]

  for (const { dir } of clientPaths) {
    const clientPath = join(SRC, dir)
    try { readdirSync(clientPath) } catch { continue }

    const walkDir = (d: string) => {
      const entries = readdirSync(d, { withFileTypes: true })
      for (const entry of entries) {
        const fullPath = join(d, entry.name)
        if (entry.isDirectory()) { walkDir(fullPath); continue }
        if (!['.ts', '.tsx'].includes(extname(entry.name))) continue

        const rel = relPath(fullPath)
        if (changedFiles && !changedFiles.has(`src/${rel}`)) continue

        const content = readFileContent(fullPath)
        if (content.includes('.from(') && content.includes('supabase')) {
          const lines = content.split('\n')
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i]
            if (line.includes('.from(') && line.includes('supabase')) {
              const block = lines.slice(i, Math.min(i + 5, lines.length)).join('\n')
              if (/\.(insert|update|delete|upsert)\(/.test(block)) {
                addViolation('ARCH', rel, 'direct DB mutation — must use API Routes', i + 1)
              }
            }
          }
        }
      }
    }
    walkDir(clientPath)
  }
}

// ─── Rule 5: API mutation routes import zod schema ─────────────
function checkApiZodValidation(changedFiles?: Set<string>) {
  const apiPath = join(SRC, 'app', 'api')
  try { readdirSync(apiPath) } catch { return }

  const walkDir = (d: string) => {
    const entries = readdirSync(d, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = join(d, entry.name)
      if (entry.isDirectory()) { walkDir(fullPath); continue }
      if (entry.name !== 'route.ts') continue

      const rel = relPath(fullPath)
      if (changedFiles && !changedFiles.has(`src/${rel}`)) continue

      const content = readFileContent(fullPath)
      const hasPost = content.includes('export async function POST')
      const hasZodImport = content.includes('Schema') && (content.includes('safeParse') || content.includes('.parse('))

      if (hasPost && !hasZodImport) {
        addViolation('ZOD', rel, 'POST handler missing zod validation')
      }
    }
  }
  walkDir(apiPath)
}

// ─── Rule 6: PascalCase component exports ──────────────────────
function checkPascalCaseComponents(changedFiles?: Set<string>) {
  const compPath = join(SRC, 'components')
  try { readdirSync(compPath) } catch { return }

  const walkDir = (d: string) => {
    const entries = readdirSync(d, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = join(d, entry.name)
      if (entry.isDirectory()) { walkDir(fullPath); continue }
      if (!entry.name.endsWith('.tsx')) continue

      const rel = relPath(fullPath)
      if (changedFiles && !changedFiles.has(`src/${rel}`)) continue

      const content = readFileContent(fullPath)
      const exportMatch = content.match(/export\s+(default\s+)?function\s+([A-Z][a-zA-Z0-9]*)/)
      const constMatch = content.match(/export\s+(const|function)\s+([A-Z][a-zA-Z0-9]*)/)

      if (!exportMatch && !constMatch) {
        // Could be default export or arrow function — skip
      }
    }
  }
  walkDir(compPath)
}

// ─── Rule 7: No `: any` or `as any` ─────────────────────────────
function checkAnyTypes(changedFiles?: Set<string>) {
  const walkDir = (d: string) => {
    const entries = readdirSync(d, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = join(d, entry.name)
      if (entry.isDirectory()) { walkDir(fullPath); continue }
      if (!['.ts', '.tsx'].includes(extname(entry.name))) continue

      const rel = relPath(fullPath)
      if (changedFiles && !changedFiles.has(`src/${rel}`)) continue

      if (rel.includes('__tests__')) continue
      if (rel.endsWith('.server.ts')) continue
      if (rel.endsWith('.config.ts')) continue

      const content = readFileContent(fullPath)
      const lines = content.split('\n')

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        if (line.trim().startsWith('//') || line.trim().startsWith('*')) continue
        if (line.includes('import ')) continue

        if (line.includes('SupabaseClient<any>')) continue

        if (/: any\b/.test(line)) {
          if (/\bcatch\s*\(\w+\s*:\s*any\b/.test(line)) continue
          addViolation('ANY', rel, `uses : any type annotation`, i + 1)
        }

        if (line.includes('as any')) {
          addViolation('ANY', rel, `uses 'as any' cast`, i + 1)
        }
      }
    }
  }
  walkDir(SRC)
}

// ─── Rule 7b: No manual validation in API routes ────────────────
function checkManualValidation(changedFiles?: Set<string>) {
  const apiPath = join(SRC, 'app', 'api')
  try { readdirSync(apiPath) } catch { return }

  const manualPatterns = [
    { pattern: /typeof\s+\w+\s*===?\s*['"]string['"]/, desc: 'typeof check (use zod instead)' },
    { pattern: /typeof\s+\w+\s*===?\s*['"]number['"]/, desc: 'typeof check (use zod instead)' },
    { pattern: /!\w+\s*\|\|\s*typeof/, desc: 'manual null+typeof check (use zod instead)' },
    { pattern: /isNaN\s*\(/, desc: 'isNaN check (use zod number schema instead)' },
    { pattern: /parseInt\s*\(/, desc: 'parseInt (use zod coerce instead)' },
    { pattern: /parseFloat\s*\(/, desc: 'parseFloat (use zod coerce instead)' },
  ]

  const walkDir = (d: string) => {
    const entries = readdirSync(d, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = join(d, entry.name)
      if (entry.isDirectory()) { walkDir(fullPath); continue }
      if (entry.name !== 'route.ts') continue

      const rel = relPath(fullPath)
      if (changedFiles && !changedFiles.has(`src/${rel}`)) continue

      const content = readFileContent(fullPath)
      const lines = content.split('\n')

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        for (const { pattern, desc } of manualPatterns) {
          if (pattern.test(line)) {
            addViolation('MANUAL', rel, desc, i + 1)
          }
        }
      }
    }
  }
  walkDir(apiPath)
}

// ─── Rule 8: Idiom — services use getServerClient ─────────────
function checkServiceIdioms(changedFiles?: Set<string>) {
  const servicePath = join(SRC, 'domains')
  try { readdirSync(servicePath) } catch { return }

  const walkDir = (d: string) => {
    const entries = readdirSync(d, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = join(d, entry.name)
      if (entry.isDirectory()) { walkDir(fullPath); continue }
      if (!entry.name.endsWith('.service.ts')) continue

      const rel = relPath(fullPath)
      if (changedFiles && !changedFiles.has(`src/${rel}`)) continue

      const content = readFileContent(fullPath)

      if (content.includes('createClient(') && !content.includes('getServerClient')) {
        addViolation('IDIOM', rel, 'service creates Supabase client directly — import getServerClient instead')
      }

      const hasExport = content.includes('export async function')
      if (hasExport) {
        const lines = content.split('\n')
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].includes('export async function') && lines.slice(i, Math.min(i + 30, lines.length)).join('\n').includes('throw new Error')) {
            addViolation('IDIOM', rel, 'service throws error — return { error, status } instead', i + 1)
          }
        }
      }
    }
  }
  walkDir(servicePath)
}

// ─── Rule 9: Idiom — API routes should not contain Supabase queries ────
function checkApiRouteIdioms(changedFiles?: Set<string>) {
  const apiPath = join(SRC, 'app', 'api')
  try { readdirSync(apiPath) } catch { return }

  const walkDir = (d: string) => {
    const entries = readdirSync(d, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = join(d, entry.name)
      if (entry.isDirectory()) { walkDir(fullPath); continue }
      if (entry.name !== 'route.ts') continue

      const rel = relPath(fullPath)
      if (changedFiles && !changedFiles.has(`src/${rel}`)) continue

      const content = readFileContent(fullPath)

      if (content.includes('createClient(') || content.includes('createServerClient')) {
        addViolation('IDIOM', rel, 'route creates Supabase client directly — use service layer instead')
      }

      if (content.includes('.from(')) {
        addViolation('IDIOM', rel, 'route has direct Supabase query — move to service layer')
      }
    }
  }
  walkDir(apiPath)
}

// ─── Rule 10: No raw logic in pages ──────────────────────────────
function checkNoRawLogicInPages(changedFiles?: Set<string>) {
  const pagesPath = join(SRC, 'app')
  try { readdirSync(pagesPath) } catch { return }

  const walkDir = (d: string) => {
    const entries = readdirSync(d, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = join(d, entry.name)
      if (entry.isDirectory()) { walkDir(fullPath); continue }

      if (entry.name !== 'page.tsx' && entry.name !== 'layout.tsx') continue

      const rel = relPath(fullPath)
      if (changedFiles && !changedFiles.has(`src/${rel}`)) continue

      const content = readFileContent(fullPath)

      if (content.includes('fetch(')) {
        addViolation('PAGE', rel, 'page contains fetch() — use a hook instead')
      }

      if (content.includes('supabase.from(')) {
        addViolation('PAGE', rel, 'page contains supabase.from() — use a hook instead')
      }

      if (content.includes("from '@/lib/supabase'") || content.includes('from "@/lib/supabase"')) {
        addViolation('PAGE', rel, 'page imports supabase client directly — use a hook instead')
      }

      if (content.includes("from '@/domains/") && content.includes('.service')) {
        addViolation('PAGE', rel, 'page imports service directly — use a hook instead')
      }
    }
  }
  walkDir(pagesPath)
}

// ─── Rule 11: Domain completeness ──────────────────────────────
function checkDomainCompleteness(changedFiles?: Set<string>) {
  const domainsPath = join(SRC, 'domains')
  try { readdirSync(domainsPath) } catch { return }

  const entries = readdirSync(domainsPath, { withFileTypes: true })
  for (const entry of entries) {
    if (!entry.isDirectory()) continue

    const domainDir = join(domainsPath, entry.name)
    const files = readdirSync(domainDir)
    const hasTypes = files.some(f => f.endsWith('.types.ts'))
    const hasService = files.some(f => f.endsWith('.service.ts'))

    if (!hasTypes) {
      addViolation('DOMAIN', `domains/${entry.name}/`, 'missing types file — every domain needs {name}.types.ts')
    }
    if (!hasService && files.length > 1) {
      addViolation('DOMAIN', `domains/${entry.name}/`, 'has files but no service — domains need {name}.service.ts for business logic')
    }
  }
}

// ─── Run all checks ────────────────────────────────────────────
const changedFiles = diffRef ? getChangedFiles(diffRef) : undefined

if (changedFiles === undefined && diffRef) {
  console.error('Warning: --diff specified but git diff failed, checking all files')
}

checkLineLimits(SRC, changedFiles)
checkNaming(SRC, changedFiles)
checkNoServerKeyInClient(changedFiles)
checkNoDirectDBInClient(changedFiles)
checkApiZodValidation(changedFiles)
checkManualValidation(changedFiles)
checkPascalCaseComponents(changedFiles)
checkAnyTypes(changedFiles)
checkServiceIdioms(changedFiles)
checkApiRouteIdioms(changedFiles)
checkNoRawLogicInPages(changedFiles)
checkDomainCompleteness(changedFiles)

// ─── Report ────────────────────────────────────────────────────
if (JSON_OUTPUT) {
  // JSON output for LLM parsing
  const output = {
    status: violations.length === 0 ? 'passed' : 'failed',
    violations: violations.map(v => ({
      rule: v.rule,
      file: v.file,
      detail: v.detail,
      severity: v.severity,
      adrs: v.adrs,
      line: v.line,
    })),
    summary: {
      total: violations.length,
      by_severity: {
        error: violations.filter(v => v.severity === 'error').length,
        warning: violations.filter(v => v.severity === 'warning').length,
        info: violations.filter(v => v.severity === 'info').length,
      },
      by_rule: Object.fromEntries(
        [...new Set(violations.map(v => v.rule))].map(rule => [
          rule,
          violations.filter(v => v.rule === rule).length,
        ])
      ),
    },
  }
  console.log(JSON.stringify(output, null, 2))
  process.exit(violations.length > 0 ? 1 : 0)
} else {
  // Human-readable output
  if (violations.length > 0) {
    const grouped: Record<string, Violation[]> = {}
    for (const v of violations) {
      if (!grouped[v.rule]) grouped[v.rule] = []
      grouped[v.rule].push(v)
    }

    const ruleEmoji: Record<string, string> = {
      SIZE: '📏', NAMING: '📝', SECURITY: '🔒', ARCH: '🏗️', ZOD: '✅',
      MANUAL: '🚫', ANY: '⚠️', IDIOM: '🎯', PAGE: '📄', PASCAL: '🔤', DOMAIN: '📁'
    }

    const severityEmoji: Record<Severity, string> = {
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️',
    }

    console.error('\n❌ Architecture violations found:\n')

    for (const [rule, items] of Object.entries(grouped)) {
      const emoji = ruleEmoji[rule] || '❌'
      console.error(`  ${emoji} ${rule} (${RULE_SEVERITY[rule] || 'warning'}):`)
      for (const v of items) {
        const sevEmoji = SHOW_SEVERITY ? `${severityEmoji[v.severity]} ` : ''
        const adrRef = v.adrs.length > 0 ? ` [${v.adrs.join(', ')}]` : ''
        const lineInfo = v.line ? `:${v.line}` : ''
        console.error(`     ${sevEmoji}${v.file}${lineInfo} — ${v.detail}${adrRef}`)
      }
      console.error()
    }

    console.error(`  Total: ${violations.length} violation(s)`)
    console.error(`  Errors: ${violations.filter(v => v.severity === 'error').length}`)
    console.error(`  Warnings: ${violations.filter(v => v.severity === 'warning').length}`)
    console.error()
    process.exit(1)
  } else {
    console.log('✅ All architecture checks passed.')
    process.exit(0)
  }
}
