import { z } from 'zod'

/** Canonical 6 hex socket directions matching map.hex direction vectors (E, NE, NW, W, SW, SE). */
export const HEX_SOCKET_DIRECTIONS = ['E', 'NE', 'NW', 'W', 'SW', 'SE'] as const
export type HexSocketDirection = typeof HEX_SOCKET_DIRECTIONS[number]

/** Visual rendering layer taxonomy for depth sorting and batching. */
export const ASSET_RENDER_LAYERS = ['ground', 'macro', 'scatter', 'infrastructure', 'entity'] as const
export type AssetRenderLayer = typeof ASSET_RENDER_LAYERS[number]

export const MapRenderProfileSchema = z.object({
  version: z.number().int().positive(),
  projection: z.literal('orthographic'),
  hexOrientation: z.literal('pointy'),
  cameraPitch: z.number(),
  cameraYaw: z.number(),
  orthoScale: z.number().positive(),
  tileWorldRadius: z.number().positive(),
  pixelsPerWorldUnit: z.number().positive(),
  sunAzimuth: z.number(),
  sunElevation: z.number(),
  atlasPageSize: z.number().int().positive(),
  padding: z.number().int().nonnegative(),
  extrude: z.number().int().nonnegative()
})
export type MapRenderProfile = z.infer<typeof MapRenderProfileSchema>

export const VisualAssetOverhangSchema = z.object({
  top: z.number().nonnegative(),
  right: z.number().nonnegative(),
  bottom: z.number().nonnegative(),
  left: z.number().nonnegative()
})
export type VisualAssetOverhang = z.infer<typeof VisualAssetOverhangSchema>

export const VisualAssetFrameSchema = z.object({
  id: z.string().min(1),
  page: z.number().int().nonnegative(),
  frame: z.object({
    x: z.number().int().nonnegative(),
    y: z.number().int().nonnegative(),
    w: z.number().int().positive(),
    h: z.number().int().positive()
  }),
  anchor: z.object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1)
  }),
  overhang: VisualAssetOverhangSchema.optional(),
  footprint: z.array(z.object({ q: z.number().int(), r: z.number().int() })).optional(),
  sockets: z.tuple([
    z.string().min(1),
    z.string().min(1),
    z.string().min(1),
    z.string().min(1),
    z.string().min(1),
    z.string().min(1)
  ]).optional(),
  layer: z.enum(ASSET_RENDER_LAYERS)
})
export type VisualAssetFrame = z.infer<typeof VisualAssetFrameSchema>

export const MapAssetPageSchema = z.object({
  id: z.string().min(1),
  albedo: z.string().min(1),
  normal: z.string().min(1),
  data: z.string().min(1),
  width: z.number().int().positive(),
  height: z.number().int().positive()
})
export type MapAssetPage = z.infer<typeof MapAssetPageSchema>

export const MapAssetManifestSchema = z.object({
  version: z.number().int().positive(),
  profile: MapRenderProfileSchema,
  pages: z.array(MapAssetPageSchema).min(1),
  assets: z.record(z.string(), VisualAssetFrameSchema)
})
export type MapAssetManifest = z.infer<typeof MapAssetManifestSchema>
