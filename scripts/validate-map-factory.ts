import fs from 'fs'
import path from 'path'

export interface FactoryValidationResult {
  valid: boolean
  errors: string[]
}

const ALLOWED_LAYERS = new Set(['ground', 'macro', 'scatter', 'infrastructure', 'entity'])
const ALLOWED_GENERATORS = new Set([
  'regolith',
  'basalt',
  'dust',
  'crater',
  'ridge',
  'rocks',
  'dune',
  'mesa',
  'ridge_chain',
  'dust_drift',
  'erosion_strip',
  'rock_field',
  'cracked_ground'
])

/**
 * Validates the structure and constraints of map-asset-factory.json.
 */
export function validateFactoryConfigContent(rawContent: string): FactoryValidationResult {
  const errors: string[] = []

  let config: any
  try {
    config = JSON.parse(rawContent)
  } catch (err) {
    return { valid: false, errors: [`JSON Parse error: ${String(err)}`] }
  }

  if (config.version !== 1) {
    errors.push(`Invalid version: expected 1, got ${config.version}`)
  }

  if (!Array.isArray(config.assets) || config.assets.length === 0) {
    errors.push('Config must have a non-empty "assets" array.')
    return { valid: false, errors }
  }

  const seenIds = new Set<string>()

  for (let i = 0; i < config.assets.length; i++) {
    const asset = config.assets[i]
    const prefix = `assets[${i}] (${asset.id ?? 'unknown'})`

    if (!asset.id || typeof asset.id !== 'string') {
      errors.push(`${prefix}: missing or invalid "id"`)
    } else {
      if (seenIds.has(asset.id)) {
        errors.push(`${prefix}: duplicate asset id "${asset.id}"`)
      }
      seenIds.add(asset.id)
    }

    if (!ALLOWED_LAYERS.has(asset.layer)) {
      errors.push(`${prefix}: invalid layer "${asset.layer}"`)
    }

    if (!ALLOWED_GENERATORS.has(asset.generator)) {
      errors.push(`${prefix}: invalid generator "${asset.generator}"`)
    }

    if (typeof asset.seed !== 'number' || !Number.isFinite(asset.seed)) {
      errors.push(`${prefix}: missing or non-finite "seed"`)
    }

    if (!asset.anchorPx || typeof asset.anchorPx.x !== 'number' || typeof asset.anchorPx.y !== 'number') {
      errors.push(`${prefix}: invalid "anchorPx" (must have x and y numbers)`)
    }

    if (Array.isArray(asset.footprint)) {
      for (let f = 0; f < asset.footprint.length; f++) {
        const fp = asset.footprint[f]
        if (typeof fp.x !== 'number' || typeof fp.y !== 'number') {
          errors.push(`${prefix}.footprint[${f}]: invalid coordinate (expected {x, y})`)
        }
        if ('q' in fp || 'r' in fp) {
          errors.push(`${prefix}.footprint[${f}]: forbidden legacy hex coordinates (q/r)`)
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

export function validateFactoryConfigFile(filePath: string): FactoryValidationResult {
  if (!fs.existsSync(filePath)) {
    return { valid: false, errors: [`File not found: ${filePath}`] }
  }
  const content = fs.readFileSync(filePath, 'utf-8')
  return validateFactoryConfigContent(content)
}

function runCli() {
  const configPath = path.join(process.cwd(), 'assets', 'pipeline', 'map-asset-factory.json')
  console.log(`Validating Blender Asset Factory configuration at ${configPath}...`)

  const result = validateFactoryConfigFile(configPath)
  if (!result.valid) {
    console.error('❌ Factory Configuration Validation Failed:')
    for (const err of result.errors) {
      console.error(`  - ${err}`)
    }
    process.exit(1)
  }

  console.log('✅ Factory Configuration is valid.')
}

if (require.main === module || process.argv[1]?.includes('validate-map-factory')) {
  runCli()
}
