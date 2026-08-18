import type { LoadedMapAssets } from './mars-map-render.types'
import { terrainSortKey } from './mars-map-assets'
import type { TerrainVisualField, TerrainVisualCell } from './mars-terrain.types'
import { selectWeightedAsset } from './mars-terrain-catalog'
import { hashCoord } from './mars-terrain-field'
import { TERRAIN_SALTS } from './mars-terrain-biomes'
import { createTerrainRenderable, type TerrainLightingContext } from './mars-map-lit-mesh'
import type { TerrainLightingMode } from './mars-map-lighting'
import { TERRAIN_FORMATION_RECIPES, type TerrainFormationRecipe } from './mars-formation-recipes'
import { generateTerrainFlowField } from './mars-terrain-flow'
import { cellToWorld } from '@/domains/map/map.grid'
import type { TerrainLayerHierarchy } from './mars-map-terrain'

interface PlacedCluster {
  cell: TerrainVisualCell
  recipe: TerrainFormationRecipe
  primaryId: string
  scale: number
}

function checkExclusion(cell: TerrainVisualCell, radius: number, occupied: Set<string>): boolean {
  const rad = Math.ceil(radius)
  const r2 = radius * radius
  for (let dy = -rad; dy <= rad; dy++) {
    for (let dx = -rad; dx <= rad; dx++) {
      if (dx * dx + dy * dy <= r2 && occupied.has(`${cell.x + dx},${cell.y + dy}`)) return true
    }
  }
  return false
}

function markExclusion(cell: TerrainVisualCell, radius: number, occupied: Set<string>): void {
  const rad = Math.ceil(radius)
  const r2 = radius * radius
  for (let dy = -rad; dy <= rad; dy++) {
    for (let dx = -rad; dx <= rad; dx++) {
      if (dx * dx + dy * dy <= r2) occupied.add(`${cell.x + dx},${cell.y + dy}`)
    }
  }
}

function spawnClusterInstance(
  cluster: PlacedCluster,
  layers: TerrainLayerHierarchy,
  field: TerrainVisualField,
  assets: LoadedMapAssets,
  cellWorldSize: number,
  flowField: ReturnType<typeof generateTerrainFlowField>,
  lightingContext?: TerrainLightingContext | null,
  lightingMode?: TerrainLightingMode
): void {
  const { cell, recipe, primaryId, scale } = cluster
  const runtimeAsset = assets.assets.get(primaryId)
  if (!runtimeAsset) return

  const worldPos = cellToWorld({ x: cell.x, y: cell.y }, cellWorldSize)
  const isHero = recipe.tier === 'hero'

  const primaryRenderable = createTerrainRenderable({
    asset: runtimeAsset,
    assets,
    lightingContext,
    lightingMode,
    scaleMultiplier: scale
  })
  primaryRenderable.position.set(worldPos.x, worldPos.y)
  primaryRenderable.zIndex = terrainSortKey(worldPos.y, isHero ? 12 : 8)

  const targetLayer = isHero ? layers.heroLayer : layers.macroLayer
  targetLayer.addChild(primaryRenderable)

  const clusterHash = hashCoord(field.seed, cell.x, cell.y, TERRAIN_SALTS.MACRO)

  // Ground support decal under cluster
  if (recipe.groundDecals && recipe.groundDecals.length > 0) {
    const decalId = selectWeightedAsset(recipe.groundDecals, clusterHash)
    if (decalId) {
      const decalAsset = assets.assets.get(decalId)
      if (decalAsset) {
        const decalRenderable = createTerrainRenderable({
          asset: decalAsset,
          assets,
          lightingContext,
          lightingMode,
          alpha: 0.80,
          scaleMultiplier: scale * 0.75
        })
        decalRenderable.position.set(worldPos.x, worldPos.y)
        decalRenderable.zIndex = terrainSortKey(worldPos.y, 1)
        layers.formationGroundLayer.addChild(decalRenderable)
      }
    }
  }

  // Satellite decor
  if (recipe.satellites) {
    const regFlow = flowField.regionFlows.get(cell.regionId)
    const baseAngle = regFlow ? regFlow.angleRad : flowField.globalAngleRad

    recipe.satellites.forEach((sat, satIdx) => {
      const satHash = hashCoord(field.seed, cell.x + satIdx * 7, cell.y - satIdx * 5, TERRAIN_SALTS.SCATTER)
      if ((satHash % 100) / 100 > sat.probability) return

      const satAsset = assets.assets.get(sat.assetId)
      if (!satAsset) return

      const dist = (sat.distanceMin + ((satHash % 1000) / 1000) * (sat.distanceMax - sat.distanceMin)) * cellWorldSize * (scale / 2.5)
      const minDeg = sat.angleMinDeg ?? (sat.relativeToFlow ? -30 : 0)
      const maxDeg = sat.angleMaxDeg ?? (sat.relativeToFlow ? 30 : 360)
      const degOffset = minDeg + (((satHash >>> 8) % 1000) / 1000) * (maxDeg - minDeg)
      const ang = sat.relativeToFlow ? baseAngle + degOffset * (Math.PI / 180) : degOffset * (Math.PI / 180)

      let satScaleMultiplier: number | undefined
      if (sat.scaleRange) {
        satScaleMultiplier = sat.scaleRange[0] + (((satHash >>> 16) % 1000) / 1000) * (sat.scaleRange[1] - sat.scaleRange[0])
      }

      const satRenderable = createTerrainRenderable({
        asset: satAsset,
        assets,
        lightingContext,
        lightingMode,
        alpha: sat.alpha ?? 0.85,
        scaleMultiplier: satScaleMultiplier
      })
      const satPos = { x: worldPos.x + Math.cos(ang) * dist, y: worldPos.y + Math.sin(ang) * dist }
      satRenderable.position.set(satPos.x, satPos.y)
      satRenderable.zIndex = terrainSortKey(satPos.y, sat.targetLayer === 'scatter' ? 4 : 2)

      if (sat.targetLayer === 'surfaceDetail') layers.surfaceDetailLayer.addChild(satRenderable)
      else if (sat.targetLayer === 'formationGround') layers.formationGroundLayer.addChild(satRenderable)
      else layers.scatterLayer.addChild(satRenderable)
    })
  }
}

/**
 * Master orchestrator for geological cluster placement (guaranteed 2-4 heroes + 4-8 macros).
 */
export function populateFormationClusters(
  layers: TerrainLayerHierarchy,
  field: TerrainVisualField,
  assets: LoadedMapAssets,
  cellWorldSize: number,
  occupiedCells: Set<string>,
  lightingContext?: TerrainLightingContext | null,
  lightingMode?: TerrainLightingMode
): void {
  const flowField = generateTerrainFlowField(field.seed, field.regions)
  const allRecipes = Object.values(TERRAIN_FORMATION_RECIPES)
  const heroRecipes = allRecipes.filter(r => r.tier === 'hero')
  const macroRecipes = allRecipes.filter(r => r.tier === 'macro')
  const placedHeroCells: TerrainVisualCell[] = []

  // 1. Guaranteed Hero Formations Placement (2..4 heroes)
  const interiorCells = field.cells.filter(c => c.x >= 2 && c.x <= field.width - 3 && c.y >= 2 && c.y <= field.height - 3)
  const scoredHeroCandidates = interiorCells
    .map(c => {
      const scoreHash = hashCoord(field.seed, c.x, c.y, TERRAIN_SALTS.MACRO)
      return { cell: c, score: (c.elevation * 0.6 + c.roughness * 0.4) * 1000 + (scoreHash % 500) }
    })
    .sort((a, b) => b.score - a.score)

  const heroTargetCount = 3
  for (const cand of scoredHeroCandidates) {
    if (placedHeroCells.length >= heroTargetCount) break
    const cell = cand.cell
    const matching = heroRecipes.filter(r => r.biomes.includes(cell.biome))
    if (matching.length === 0) continue

    const clusterHash = hashCoord(field.seed, cell.x, cell.y, TERRAIN_SALTS.MACRO)
    const recipe = matching[clusterHash % matching.length]

    if (checkExclusion(cell, recipe.exclusionRadiusCells, occupiedCells)) continue
    if (placedHeroCells.some(h => Math.hypot(h.x - cell.x, h.y - cell.y) < 4.5)) continue

    const primaryId = selectWeightedAsset(recipe.primaryAssets, clusterHash)
    if (!primaryId) continue

    const scale = recipe.primaryScaleRange
      ? recipe.primaryScaleRange[0] + ((clusterHash % 1000) / 1000) * (recipe.primaryScaleRange[1] - recipe.primaryScaleRange[0])
      : 1.0

    markExclusion(cell, recipe.exclusionRadiusCells, occupiedCells)
    placedHeroCells.push(cell)

    spawnClusterInstance({ cell, recipe, primaryId, scale }, layers, field, assets, cellWorldSize, flowField, lightingContext, lightingMode)
  }

  // 2. Macro Formations Placement (4..8 macros)
  for (const cell of field.cells) {
    if (occupiedCells.has(`${cell.x},${cell.y}`)) continue

    const matching = macroRecipes.filter(r => r.biomes.includes(cell.biome))
    if (matching.length === 0) continue

    const clusterHash = hashCoord(field.seed, cell.x, cell.y, TERRAIN_SALTS.MACRO)
    if ((clusterHash % 1000) > 85) continue

    const recipe = matching[clusterHash % matching.length]
    if (checkExclusion(cell, recipe.exclusionRadiusCells, occupiedCells)) continue

    const primaryId = selectWeightedAsset(recipe.primaryAssets, clusterHash)
    if (!primaryId) continue

    const scale = recipe.primaryScaleRange
      ? recipe.primaryScaleRange[0] + ((clusterHash % 1000) / 1000) * (recipe.primaryScaleRange[1] - recipe.primaryScaleRange[0])
      : 1.0

    markExclusion(cell, recipe.exclusionRadiusCells, occupiedCells)

    spawnClusterInstance({ cell, recipe, primaryId, scale }, layers, field, assets, cellWorldSize, flowField, lightingContext, lightingMode)
  }
}
