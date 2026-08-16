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
      'C:\\Program Files\\Blender Foundation\\Blender 4.2\\blender.exe',
      'C:\\Program Files\\Blender Foundation\\Blender 4.1\\blender.exe',
      'C:\\Program Files\\Blender Foundation\\Blender 4.0\\blender.exe',
      'C:\\Program Files\\Blender Foundation\\Blender 3.6\\blender.exe'
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
  const targetDir = path.join(rootDir, 'assets', 'raw_renders')
  const stagingDir = path.join(targetDir, '.factory-staging')

  console.log('=== Mars2050 Blender Terrain Asset Factory ===')

  // 1. Static validation of factory configuration
  const validation = validateFactoryConfigFile(configPath)
  if (!validation.valid) {
    console.error('❌ Factory Configuration Validation Failed:')
    for (const err of validation.errors) console.error(`  - ${err}`)
    process.exit(1)
  }
  console.log('✅ Factory configuration validated successfully.')

  // 2. Discover Blender binary
  const blenderBin = findBlenderExecutable()
  if (!blenderBin) {
    console.warn('\n⚠️ [MapFactory] Blender runtime unavailable — source rendering not executed.')
    console.warn('   (Checked BLENDER_BIN and standard system PATH).')
    console.warn('   Static validation and TypeScript pipelines remain operational.')
    return
  }

  console.log(`Found Blender executable at: ${blenderBin}`)
  if (fs.existsSync(stagingDir)) {
    fs.rmSync(stagingDir, { recursive: true, force: true })
  }
  fs.mkdirSync(stagingDir, { recursive: true })

  // 3. Execute Headless Blender Rendering to Staging Directory
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

  // 4. Validate Staged raw_manifest.json
  const stagedManifestPath = path.join(stagingDir, 'raw_manifest.json')
  if (!fs.existsSync(stagedManifestPath)) {
    console.error('❌ Blender run completed without generating raw_manifest.json')
    fs.rmSync(stagingDir, { recursive: true, force: true })
    process.exit(1)
  }

  const inputValidation = await loadAndValidateInputs(profilePath, stagedManifestPath, stagingDir)
  if (!inputValidation.success) {
    console.error('❌ Staged Raw Asset Manifest Validation Failed:')
    for (const err of inputValidation.errors) console.error(`  - ${err}`)
    fs.rmSync(stagingDir, { recursive: true, force: true })
    process.exit(1)
  }

  // 5. Atomic Promotion: Copy all staged outputs to canonical assets/raw_renders/
  console.log(`Atomically promoting renders from staging to ${targetDir}...`)
  const files = fs.readdirSync(stagingDir)
  for (const file of files) {
    const src = path.join(stagingDir, file)
    const dst = path.join(targetDir, file)
    fs.copyFileSync(src, dst)
  }

  fs.rmSync(stagingDir, { recursive: true, force: true })
  console.log(`✅ Factory Run Succeeded. Promoted ${files.length} assets to assets/raw_renders/`)
}

if (require.main === module || process.argv[1]?.includes('run-map-asset-factory')) {
  runMapAssetFactory().catch(console.error)
}
