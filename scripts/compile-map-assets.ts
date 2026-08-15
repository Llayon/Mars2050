import path from 'path'
import type { MapAssetManifest } from '../src/components/map/mars-map-asset.types'
import { loadAndValidateInputs } from './map-assets/map-asset-input'
import { processRawAssets } from './map-assets/map-asset-process'
import { buildAtlasAndManifest } from './map-assets/map-asset-atlas'

export interface CompileMapAssetsOptions {
  inputManifestPath: string
  profilePath?: string
  baseDir?: string
  outputDir: string
  validateOnly?: boolean
  dryRun?: boolean
  report?: boolean
}

export interface CompileMapAssetsResult {
  success: boolean
  manifest?: MapAssetManifest
  pagesCount?: number
  assetsCount?: number
  errors?: string[]
}

/**
 * Compiles raw asset images and manifest into deterministically packed multi-channel texture atlases.
 */
export async function compileMapAssets(options: CompileMapAssetsOptions): Promise<CompileMapAssetsResult> {
  const {
    inputManifestPath,
    profilePath = path.join(process.cwd(), 'assets', 'pipeline', 'map-render-profile.json'),
    baseDir = path.dirname(inputManifestPath),
    outputDir,
    validateOnly = false,
    dryRun = false,
    report = false
  } = options

  // Step 1: Load authoritative profile and raw manifest with companion validation
  const inputResult = await loadAndValidateInputs(profilePath, inputManifestPath, baseDir)
  if (!inputResult.success || !inputResult.profile || !inputResult.validatedAssets) {
    return {
      success: false,
      errors: inputResult.errors,
      assetsCount: inputResult.validatedAssets?.length ?? 0
    }
  }

  const { profile, validatedAssets } = inputResult

  // Step 2: Synchronous Alpha Trim, Anchor Verification, and Edge Extrusion
  const processResult = await processRawAssets(validatedAssets, profile.extrude)
  if (!processResult.success || !processResult.processedAssets) {
    return {
      success: false,
      errors: processResult.errors,
      assetsCount: validatedAssets.length
    }
  }

  if (validateOnly) {
    return { success: true, assetsCount: processResult.processedAssets.length }
  }

  // Step 3: Deterministic Bin Packing & Multi-Channel Atlas Page Compositing
  const atlasResult = await buildAtlasAndManifest({
    profile,
    assets: processResult.processedAssets,
    outputDir,
    dryRun
  })

  if (!atlasResult.success) {
    return {
      success: false,
      errors: atlasResult.errors,
      assetsCount: processResult.processedAssets.length
    }
  }

  if (report) {
    console.log(`\n=== Mars Map Asset Compilation Report ===`)
    console.log(`Assets processed: ${processResult.processedAssets.length}`)
    console.log(`Atlas pages: ${atlasResult.pagesCount} (${profile.atlasPageSize}x${profile.atlasPageSize})`)
    console.log(`Extrusion: ${profile.extrude}px, Padding: ${profile.padding}px`)
    console.log(`Authoritative Profile: ${profilePath}`)
    console.log(`Output: ${outputDir}/terrain-manifest.json`)
    console.log(`=========================================\n`)
  }

  return {
    success: true,
    manifest: atlasResult.manifest,
    pagesCount: atlasResult.pagesCount,
    assetsCount: processResult.processedAssets.length
  }
}

// CLI entry point
if (require.main === module || (typeof process !== 'undefined' && process.argv[1]?.endsWith('compile-map-assets.ts'))) {
  const args = process.argv.slice(2)
  const isValidate = args.includes('--validate')
  const isDryRun = args.includes('--dry-run')
  const isReport = args.includes('--report') || !args.includes('--quiet')

  const inputManifestArg = args.find(a => a.startsWith('--input='))?.split('=')[1] ||
    path.join(process.cwd(), 'assets', 'raw_renders', 'raw_manifest.json')
  const profileArg = args.find(a => a.startsWith('--profile='))?.split('=')[1] ||
    path.join(process.cwd(), 'assets', 'pipeline', 'map-render-profile.json')
  const outputDirArg = args.find(a => a.startsWith('--output='))?.split('=')[1] ||
    path.join(process.cwd(), 'public', 'assets', 'map')

  compileMapAssets({
    inputManifestPath: inputManifestArg,
    profilePath: profileArg,
    outputDir: outputDirArg,
    validateOnly: isValidate,
    dryRun: isDryRun,
    report: isReport
  }).then(result => {
    if (!result.success) {
      console.error('Compilation failed with errors:', result.errors)
      process.exit(1)
    }
    console.log('Compilation succeeded!')
  }).catch(err => {
    console.error('Fatal compiler error:', err)
    process.exit(1)
  })
}
