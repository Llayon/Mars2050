import { BuildingTypeKey } from '@/domains/building/building.types'

/** 
 * Maps building types to asset paths.
 */
export const ASSET_MANIFEST: Partial<Record<BuildingTypeKey, string>> = {
  water_extractor: '/assets/buildings/water_extractor.png',
  solar_panels: '/assets/buildings/solar_panels.png',
  mine: '/assets/buildings/mine.png',
  greenhouse: '/assets/buildings/greenhouse.png',
}
