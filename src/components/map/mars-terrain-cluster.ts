import type { LoadedMapAssets } from './mars-map-render.types'
import { terrainSortKey } from './mars-map-assets'
import type { TerrainVisualField } from './mars-terrain.types'
import { selectWeightedAsset } from './mars-terrain-catalog'
import { hashCoord } from './mars-terrain-field'
import { TERRAIN_SALTS } from './mars-terrain-biomes'
import { createTerrainRenderable, type TerrainLightingContext } from './mars-map-lit-mesh'
import type { TerrainLightingMode } from './mars-map-lighting'
import { TERRAIN_FORMATION_RECIPES } from './mars-formation-recipes'
import { generateTerrainFlowField } from './mars-terrain-flow'
import { cellToWorld } from '@/domains/map/map.grid'
import type { TerrainLayerHierarchy } from './mars-map-terrain'

/**
 * Populates multi-tier geological clusters (Mesa, Ridge, Crater formations with satellites).
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
  const recipes = Object.values(TERRAIN_FORMATION_RECIPES)

  for (const cell of field.cells) {
    const key = `${cell.x},${cell.y}`
    if (occupiedCells.has(key)) continue

    const matchingRecipes = recipes.filter(r => r.biomes.includes(cell.biome))
    if (matchingRecipes.length === 0) continue

    const clusterHash = hashCoord(field.seed, cell.x, cell.y, TERRAIN_SALTS.MACRO)
    if ((clusterHash % 1000) > 65) continue

    const recipeIdx = clusterHash % matchingRecipes.length
    const recipe = matchingRecipes[recipeIdx]

    // Check exclusion radius
    let collides = false
    const rad = Math.ceil(recipe.exclusionRadiusCells)
    for (let dy = -rad; dy <= rad; dy++) {
      for (let dx = -rad; dx <= rad; dx++) {
        if (dx * dx + dy * dy <= recipe.exclusionRadiusCells * recipe.exclusionRadiusCells) {
          if (occupiedCells.has(`${cell.x + dx},${cell.y + dy}`)) {
            collides = true
            break
          }
        }
      }
      if (collides) break
    }
    if (collides) continue

    const primaryId = selectWeightedAsset(recipe.primaryAssets, clusterHash)
    if (!primaryId) continue

    const runtimeAsset = assets.assets.get(primaryId)
    if (!runtimeAsset) continue

    const worldPos = cellToWorld({ x: cell.x, y: cell.y }, cellWorldSize)
    const isHero = primaryId.startsWith('mesa_') || primaryId.startsWith('cliff_')

    const primaryRenderable = createTerrainRenderable({
      asset: runtimeAsset,
      assets,
      lightingContext,
      lightingMode
    })
    primaryRenderable.position.set(worldPos.x, worldPos.y)
    primaryRenderable.zIndex = terrainSortKey(worldPos.y, isHero ? 12 : 8)

    const targetMacroLayer = isHero ? layers.heroLayer : layers.macroLayer
    targetMacroLayer.addChild(primaryRenderable)

    // Spawn cluster base ground decal
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
            alpha: 0.75
          })
          decalRenderable.position.set(worldPos.x, worldPos.y)
          decalRenderable.zIndex = terrainSortKey(worldPos.y, 1)
          layers.surfaceDetailLayer.addChild(decalRenderable)
        }
      }
    }

    // Mark cluster footprint
    for (let dy = -rad; dy <= rad; dy++) {
      for (let dx = -rad; dx <= rad; dx++) {
        if (dx * dx + dy * dy <= recipe.exclusionRadiusCells * recipe.exclusionRadiusCells) {
          occupiedCells.add(`${cell.x + dx},${cell.y + dy}`)
        }
      }
    }

    // Spawn satellite decor
    if (recipe.satellites) {
      const regFlow = flowField.regionFlows.get(cell.regionId)
      const baseAngle = regFlow ? regFlow.angleRad : flowField.globalAngleRad

      recipe.satellites.forEach((sat, satIdx) => {
        const satHash = hashCoord(field.seed, cell.x + satIdx * 5, cell.y - satIdx * 3, TERRAIN_SALTS.SCATTER)
        if ((satHash % 100) / 100 > sat.probability) return

        const satAsset = assets.assets.get(sat.assetId)
        if (!satAsset) return

        const dist = (sat.distanceMin + ((satHash % 1000) / 1000) * (sat.distanceMax - sat.distanceMin)) * cellWorldSize
        const ang = sat.relativeToFlow ? baseAngle + (((satHash >>> 8) % 60) - 30) * (Math.PI / 180) : ((satHash >>> 8) % 360) * (Math.PI / 180)

        const satPos = {
          x: worldPos.x + Math.cos(ang) * dist,
          y: worldPos.y + Math.sin(ang) * dist
        }

        const satRenderable = createTerrainRenderable({
          asset: satAsset,
          assets,
          lightingContext,
          lightingMode,
          alpha: sat.alpha ?? 0.85
        })
        satRenderable.position.set(satPos.x, satPos.y)
        satRenderable.zIndex = terrainSortKey(satPos.y, sat.targetLayer === 'scatter' ? 4 : 2)

        if (sat.targetLayer === 'surfaceDetail') layers.surfaceDetailLayer.addChild(satRenderable)
        else if (sat.targetLayer === 'formationGround') layers.formationGroundLayer.addChild(satRenderable)
        else layers.scatterLayer.addChild(satRenderable)
      })
    }
  }
}
