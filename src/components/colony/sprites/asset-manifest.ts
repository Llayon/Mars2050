import { BuildingTypeKey } from '@/domains/building/building.types'

/** 
 * Maps building types to asset paths.
 */
export const ASSET_MANIFEST: Partial<Record<BuildingTypeKey, string>> = {
  water_extractor: '/assets/buildings/water_extractor.webp',
  solar_panels: '/assets/buildings/solar-panels.webp',
  mine: '/assets/buildings/mine.webp',
  greenhouse: '/assets/buildings/farm.webp',
  oxygen_generator: '/assets/buildings/oxygen-generator.webp',
  research_lab: '/assets/buildings/research-lab.webp',
  habitat: '/assets/buildings/dome.webp',
}
