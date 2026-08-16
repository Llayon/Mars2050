import fs from 'fs'
import path from 'path'
import { spawnSync } from 'child_process'
import { validateFactoryConfigFile } from './validate-map-factory'
import { loadAndValidateInputs } from './map-assets/map-asset-input'

export function findBlenderExecutable(): string | null {
  const customBin = process.env.BLENDER_BIN
  if (customBin && fs.existsSync(customBin)) {
    return customBin
  }

  const probeCmd = process.platform === 'win32' ? 'where.exe' : 'which'
  const probe = spawnSync(probeCmd, ['blender'], {
    encoding: 'utf-8'
  })

  if (probe.status === 0 && probe.stdout) {
    const lines = probe.stdout.trim().split(/\r?\n/)
    if (lines.length > 0 && fs.existsSync(lines[0].trim())) {
      return lines[0].trim()
    }
  }

  // Common default install paths on Windows
  if (process.platform === 'win32') {
    const defaultPaths = [
      'D:\\Programms\\Blender\\blender.exe',
      'D:\\Programms\\Blender\\5.2\\blender.exe',
      'C:\\Program Files\\Blender Foundation\\Blender 5.2\\blender.exe',
      'C:\\Program Files\\Blender Foundation\\Blender 5.1\\blender.exe',
      'C:\\Program Files\\Blender Foundation\\Blender 4.2\\blender.exe',
      'C:\\Program Files\\Blender Foundation\\Blender 4.1\\blender.exe'
    ]
    for (const p of defaultPaths) {
      if (fs.existsSync(p)) return p
    }
  }

  return null
}

async function runMapAssetFactory() {
  const rootDir = process.cwd()
  const configPath = path.join(rootDir, 'assets', 'pipeline', 'map-asset-factory.json')
  const profilePath = path.join(rootDir, 'assets', 'pipeline', 'map-render-profile.json')
  const pythonScript = path.join(rootDir, 'tools', 'blender', 'map_asset_factory.py')
  const canonicalDir = path.join(rootDir, 'assets', 'raw_renders')
  const stagingDir = path.join(rootDir, 'assets', 'raw_renders.next')
  const prevDir = path.join(rootDir, 'assets', 'raw_renders.prev')

  console.log('=== Mars2050 Blender Terrain Asset Factory ===')

  // 1. Static validation of factory configuration
  const validation = validateFactoryConfigFile(configPath)
  if (!validation.valid) {
    console.error('❌ Factory Configuration Validation Failed:')
    for (const err of validation.errors) console.error(`  - ${err}`)
    process.exit(1)
  }
  console.log('✅ Factory configuration validated successfully.')

  // 2. Discover Blender binary (fail if not found)
  const blenderBin = findBlenderExecutable()
  if (!blenderBin) {
    console.error('\n❌ [MapFactory] Blender executable not found.')
    console.error('   Please ensure Blender is installed or specify BLENDER_BIN environment variable.')
    console.error('   Example: BLENDER_BIN="D:\\Programms\\Blender\\blender.exe" npm run map:assets:factory')
    process.exit(1)
  }

  console.log(`Found Blender executable at: ${blenderBin}`)

  // Prepare staging directory
  if (fs.existsSync(stagingDir)) {
    fs.rmSync(stagingDir, { recursive: true, force: true })
  }
  fs.mkdirSync(stagingDir, { recursive: true })

  // 3. Execute Headless Blender Rendering to raw_renders.next
  console.log(`Rendering assets into staging directory: ${stagingDir}...`)
  const result = spawnSync(
    blenderBin,
    [
      '--background',
      '--python',
      pythonScript,
      '--',
      '--output-dir',
      stagingDir,
      '--config',
      configPath,
      '--profile',
      profilePath
    ],
    { stdio: 'inherit' }
  )

  if (result.status !== 0) {
    console.error(`❌ Blender execution failed with exit code ${result.status}`)
    fs.rmSync(stagingDir, { recursive: true, force: true })
    process.exit(result.status || 1)
  }

  // 4. Verify all 13 assets x 3 channels exist and are non-empty
  const stagedManifestPath = path.join(stagingDir, 'raw_manifest.json')
  if (!fs.existsSync(stagedManifestPath)) {
    console.error('❌ Blender run completed without generating raw_manifest.json')
    fs.rmSync(stagingDir, { recursive: true, force: true })
    process.exit(1)
  }

  const factoryConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
  const expectedAssetCount = factoryConfig.assets.length

  for (const assetDef of factoryConfig.assets) {
    const id = assetDef.id
    for (const ch of ['albedo.png', 'normal.png', 'data.png']) {
      const filePath = path.join(stagingDir, `${id}.${ch}`)
      if (!fs.existsSync(filePath)) {
        console.error(`❌ Missing rendered channel: ${id}.${ch}`)
        fs.rmSync(stagingDir, { recursive: true, force: true })
        process.exit(1)
      }
      const stat = fs.statSync(filePath)
      if (stat.size < 100) {
        console.error(`❌ Corrupted or empty rendered channel (${stat.size} bytes): ${id}.${ch}`)
        fs.rmSync(stagingDir, { recursive: true, force: true })
        process.exit(1)
      }
    }
  }

  // Validate using companion input validator
  const inputValidation = await loadAndValidateInputs(profilePath, stagedManifestPath, stagingDir)
  if (!inputValidation.success) {
    console.error('❌ Staged Raw Asset Manifest Validation Failed:')
    for (const err of inputValidation.errors) console.error(`  - ${err}`)
    fs.rmSync(stagingDir, { recursive: true, force: true })
    process.exit(1)
  }

  // 5. True Transactional Promotion with Rollback Protection
  console.log(`Atomically promoting ${expectedAssetCount} assets (${expectedAssetCount * 3} images) to canonical directory...`)
  try {
    if (fs.existsSync(prevDir)) {
      fs.rmSync(prevDir, { recursive: true, force: true })
    }
    if (fs.existsSync(canonicalDir)) {
      fs.renameSync(canonicalDir, prevDir)
    }
    fs.renameSync(stagingDir, canonicalDir)
    if (fs.existsSync(prevDir)) {
      fs.rmSync(prevDir, { recursive: true, force: true })
    }
    console.log(`✅ Factory Run Succeeded. ${expectedAssetCount} production assets published to assets/raw_renders/`)
  } catch (promotionError) {
    console.error('❌ Atomic promotion failed, rolling back:', promotionError)
    if (fs.existsSync(prevDir) && !fs.existsSync(canonicalDir)) {
      fs.renameSync(prevDir, canonicalDir)
    }
    process.exit(1)
  }
}

if (require.main === module || process.argv[1]?.includes('run-map-asset-factory')) {
  runMapAssetFactory().catch(console.error)
}
