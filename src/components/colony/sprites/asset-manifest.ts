import { BuildingTypeKey } from '@/domains/building/building.types'

/** 
 * Maps building types to sprite IDs (textures in the atlas).
 * Using colored rectangles as placeholders for Phase 1.
 */
export const AssetManifest: Record<BuildingTypeKey, string> = {
  solar_panels: 'sprite_solar',
  oxygen_generator: 'sprite_oxygen',
  water_extractor: 'sprite_water',
  mine: 'sprite_mine',
  greenhouse: 'sprite_greenhouse',
  research_lab: 'sprite_lab'
}
