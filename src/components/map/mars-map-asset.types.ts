import { z } from 'zod'
import { HEX_DIRECTION_NAMES, type HexDirection } from '@/domains/map/map.hex'

export const HEX_SOCKET_DIRECTIONS = HEX_DIRECTION_NAMES
export type HexSocketDirection = HexDirection
export const ASSET_RENDER_LAYERS = ['ground', 'macro', 'scatter', 'infrastructure', 'entity'] as const
export type AssetRenderLayer = typeof ASSET_RENDER_LAYERS[number]

export const MapRenderProfileSchema = z.object({
  version: z.number().int().positive(),
  projection: z.literal('orthographic'),
  hexOrientation: z.literal('pointy'),
  cameraPitch: z.number(), cameraYaw: z.number(), orthoScale: z.number().positive(),
  tileWorldRadius: z.number().positive(), pixelsPerWorldUnit: z.number().positive(),
  sunAzimuth: z.number(), sunElevation: z.number(), atlasPageSize: z.number().int().positive(),
  padding: z.number().int().nonnegative(), extrude: z.number().int().nonnegative(),
  mipmaps: z.boolean().default(false)
})
export type MapRenderProfile = z.infer<typeof MapRenderProfileSchema>

/** Pixel extension outside logical footprint bounds at reference render scale (pixelsPerWorldUnit * tileWorldRadius). */
export const VisualAssetOverhangSchema = z.object({
  top: z.number().nonnegative(), right: z.number().nonnegative(),
  bottom: z.number().nonnegative(), left: z.number().nonnegative()
})
export type VisualAssetOverhang = z.infer<typeof VisualAssetOverhangSchema>

export const VisualAssetFrameSchema = z.object({
  id: z.string().min(1),
  page: z.number().int().nonnegative(),
  frame: z.object({ x: z.number().int().nonnegative(), y: z.number().int().nonnegative(), w: z.number().int().positive(), h: z.number().int().positive() }),
  /** Normalized [0..1] pivot relative to FINAL TRIMMED sprite frame. (0,0)=top-left, (1,1)=bottom-right. */
  anchor: z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) }),
  overhang: VisualAssetOverhangSchema.optional(),
  footprint: z.array(z.object({ q: z.number().int(), r: z.number().int() })).optional(),
  sockets: z.tuple([z.string().min(1), z.string().min(1), z.string().min(1), z.string().min(1), z.string().min(1), z.string().min(1)]).optional(),
  layer: z.enum(ASSET_RENDER_LAYERS)
}).superRefine((data, ctx) => {
  if (data.footprint && data.footprint.length > 1) {
    const seen = new Set<string>()
    for (const c of data.footprint) {
      const k = `${c.q},${c.r}`
      if (seen.has(k)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Duplicate footprint (${k}) in ${data.id}` })
      seen.add(k)
    }
  }
})
export type VisualAssetFrame = z.infer<typeof VisualAssetFrameSchema>

export const MapAssetPageSchema = z.object({
  id: z.string().min(1),
  albedo: z.string().min(1),
  normal: z.string().min(1), // RGBA lossless PNG
  data: z.string().min(1),   // RGBA lossless PNG: R=Height, G=AO, B=Emissive
  width: z.number().int().positive(),
  height: z.number().int().positive()
})
export type MapAssetPage = z.infer<typeof MapAssetPageSchema>

export const MapAssetManifestSchema = z.object({
  version: z.number().int().positive(),
  profile: MapRenderProfileSchema,
  pages: z.array(MapAssetPageSchema).min(1),
  assets: z.record(z.string(), VisualAssetFrameSchema)
}).superRefine((manifest, ctx) => {
  const pageIds = new Set<string>()
  manifest.pages.forEach((p, i) => {
    if (pageIds.has(p.id)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Duplicate page id "${p.id}" at index ${i}` })
    pageIds.add(p.id)
  })
  for (const [key, asset] of Object.entries(manifest.assets)) {
    if (key !== asset.id) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Key "${key}" !== asset.id "${asset.id}"` })
    const page = manifest.pages[asset.page]
    if (!page) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Asset "${asset.id}" references invalid page ${asset.page}` })
      continue
    }
    if (asset.frame.x + asset.frame.w > page.width || asset.frame.y + asset.frame.h > page.height) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Asset "${asset.id}" frame exceeds page dimensions` })
    }
  }
})
export type MapAssetManifest = z.infer<typeof MapAssetManifestSchema>
