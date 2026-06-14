import { BuildingTypeKey } from '@/domains/building/building.types'

/** 
 * Maps building types to asset paths.
 */
export const ASSET_MANIFEST: Partial<Record<BuildingTypeKey, string>> = {
  water_extractor: '/assets/buildings/water_extractor.png',
  // oxygen_generator: '/assets/buildings/oxygen_generator.png', 
}
