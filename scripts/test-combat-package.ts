import { execSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

function run(command: string, cwd: string): string {
  return execSync(command, { cwd, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] })
}

function main(): void {
  const rootDir = process.cwd()
  const stageDir = join(tmpdir(), `combat-core-smoke-${Date.now()}`)
  mkdirSync(stageDir, { recursive: true })

  try {
    console.log('[1/6] Building @mars2050/combat-core...')
    run('npm.cmd --workspace=@mars2050/combat-core run build', rootDir)

    console.log('[2/6] Packaging tarball into isolated tmpdir...')
    const packJson = run(`npm.cmd pack --workspace=@mars2050/combat-core --json --pack-destination="${stageDir}"`, rootDir)
    const packMeta = JSON.parse(packJson)[0]
    const tarballPath = join(stageDir, packMeta.filename)

    if (!existsSync(tarballPath)) {
      throw new Error(`Tarball not found at ${tarballPath}`)
    }

    const tarballBytes = readFileSync(tarballPath)
    const tarballHash = createHash('sha256').update(tarballBytes).digest('hex')
    console.log(`Tarball created: ${packMeta.filename} (sha256: ${tarballHash})`)

    console.log('[3/6] Inspecting package tarball files...')
    const files: string[] = packMeta.files.map((f: { path: string }) => f.path)
    const illegalFiles = files.filter(f => f.startsWith('src/') || f.includes('tsconfig') || f.includes('next'))
    if (illegalFiles.length > 0) {
      throw new Error(`Tarball contains unexpected files: ${illegalFiles.join(', ')}`)
    }
    console.log(`Tarball contains ${files.length} valid files without sources or application leaks.`)

    console.log('[4/6] Setting up standalone consumer outside workspace...')
    const consumerDir = join(stageDir, 'consumer')
    mkdirSync(consumerDir, { recursive: true })

    writeFileSync(
      join(consumerDir, 'package.json'),
      JSON.stringify({
        name: 'smoke-consumer',
        version: '1.0.0',
        type: 'module',
        dependencies: {
          zod: '^4.4.2',
        },
        devDependencies: {
          typescript: '^5.0.0',
          '@types/node': '^20.0.0',
        },
      }, null, 2),
      'utf8'
    )

    run(`npm.cmd install "${tarballPath}"`, consumerDir)

    writeFileSync(
      join(consumerDir, 'tsconfig.json'),
      JSON.stringify({
        compilerOptions: {
          target: 'ES2022',
          module: 'NodeNext',
          moduleResolution: 'NodeNext',
          lib: ['ES2022', 'DOM'],
          strict: true,
          noEmit: false,
          outDir: './dist',
          skipLibCheck: true,
        },
        include: ['./consumer.ts'],
      }, null, 2),
      'utf8'
    )

    const consumerTsCode = `
import {
  battleInputSchema,
  unitDefinitionSchema,
  serializeLegacyUnit,
  deserializeLegacyUnit,
  encodeLegacyReplayJson,
  decodeLegacyReplayJson,
  type BattleInput,
  type CombatReplayUnit,
  type CombatRunResult,
} from '@mars2050/combat-core'

// 1. Validate valid UnitDefinition
const sampleUnitDef = unitDefinitionSchema.parse({
  id: 'knight',
  name: 'Рыцарь',
  baseStats: {
    hp: 120,
    attack: 25,
    defense: 5,
    speed: 4,
    range: 1,
  },
})

// 2. Validate BattleInput schema
const sampleBattleInput: BattleInput = battleInputSchema.parse({
  seed: 42,
  definitions: {
    knight: sampleUnitDef,
  },
  units: [
    {
      instanceId: 'k1',
      definitionId: 'knight',
      team: 'attacker',
      placement: { x: 300, y: 900 },
    },
  ],
})

// 3. Test invalid input rejection
const invalidInputResult = battleInputSchema.safeParse({ seed: 'not-a-number' })
if (invalidInputResult.success) {
  throw new Error('Expected invalid input to fail validation')
}

// 4. Test legacy unit wire serialization & deserialization round-trip
const unit: CombatReplayUnit = {
  id: 'test-1',
  type: 'knight',
  team: 'attacker',
  hp: 120,
  maxHp: 120,
  x: 300,
  y: 900,
  attack: 25,
  range: 1,
  speed: 4,
  shield: 50,
}

const serialized = serializeLegacyUnit(unit)
const deserialized = deserializeLegacyUnit(serialized)
if (deserialized.id !== unit.id || deserialized.shield !== 50) {
  throw new Error('Legacy unit round-trip mismatch')
}

// 5. Test complete replay round-trip
const replayResult: CombatRunResult = {
  winner: 'attacker',
  seed: 42,
  elapsedTicks: 100,
  terminationReason: 'elimination',
  initialState: [unit],
  survivors: [unit],
  logs: [
    {
      tick: 1,
      actions: [{ type: 'attack', sourceId: 'test-1', amount: 25 }],
    },
  ],
  engineVersion: 9,
  engineRevision: 'combat-core-v1',
}

const encoded = encodeLegacyReplayJson(replayResult)
const decoded = decodeLegacyReplayJson(encoded)
if (decoded.winner !== 'attacker' || decoded.logs.length !== 1) {
  throw new Error('Legacy replay round-trip mismatch')
}

console.log('Consumer smoke verification passed successfully.')
`

    writeFileSync(join(consumerDir, 'consumer.ts'), consumerTsCode, 'utf8')

    console.log('[5/6] Compiling and running TypeScript consumer...')
    const localTsc = join(consumerDir, 'node_modules', '.bin', 'tsc.cmd')
    const tscCmd = existsSync(localTsc) ? `"${localTsc}" -p tsconfig.json` : 'npx.cmd -p typescript tsc -p tsconfig.json'
    run(tscCmd, consumerDir)
    const stdout = run('node dist/consumer.js', consumerDir)
    console.log(stdout.trim())

    console.log('[6/6] Verifying subpath encapsulation...')
    let subpathBlocked = false
    try {
      run('node -e "import(\'@mars2050/combat-core/dist/contracts/unit.contracts.js\')"', consumerDir)
    } catch {
      subpathBlocked = true
    }
    if (!subpathBlocked) {
      throw new Error('Unexported subpath import was not blocked by package exports!')
    }
    console.log('Unexported internal subpaths correctly blocked by package exports.')

    console.log(`\nAll archive smoke checks PASSED. (Archive SHA256: ${tarballHash})`)
  } finally {
    try {
      rmSync(stageDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup error on Windows if busy
    }
  }
}

main()
