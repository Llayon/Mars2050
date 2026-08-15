import { z } from 'zod'
import { ASSET_RENDER_LAYERS, MapRenderProfileSchema, VisualAssetOverhangSchema } from './mars-map-asset.types'

/** Source companion texture files for a raw un-trimmed asset. */
export const RawAssetSourceSchema = z.object({
  albedo: z.string().min(1),
  normal: z.string().min(1).optional(),
  data: z.string().min(1).optional()
})
export type RawAssetSource = z.infer<typeof RawAssetSourceSchema>

/** Raw asset entry emitted by Blender Exporter or authored manually. */
export const RawAssetEntrySchema = z.object({
  id: z.string().min(1),
  layer: z.enum(ASSET_RENDER_LAYERS),
  source: RawAssetSourceSchema,
  /** Raw un-trimmed pixel coordinates of pivot before alpha-crop. */
  anchorPx: z.object({
    x: z.number().nonnegative(),
    y: z.number().nonnegative()
  }),
  footprint: z.array(z.object({ q: z.number().int(), r: z.number().int() })).optional(),
  sockets: z.tuple([
    z.string().min(1), z.string().min(1), z.string().min(1),
    z.string().min(1), z.string().min(1), z.string().min(1)
  ]).optional(),
  overhangPx: VisualAssetOverhangSchema.optional()
})
export type RawAssetEntry = z.infer<typeof RawAssetEntrySchema>

/** Input manifest consumed by compiler (scripts/compile-map-assets.ts). */
export const RawAssetManifestSchema = z.object({
  version: z.number().int().positive(),
  profile: MapRenderProfileSchema,
  assets: z.array(RawAssetEntrySchema).min(1)
}).superRefine((manifest, ctx) => {
  const ids = new Set<string>()
  manifest.assets.forEach((asset, idx) => {
    if (ids.has(asset.id)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Duplicate raw asset id "${asset.id}" at index ${idx}` })
    }
    ids.add(asset.id)
  })
})
export type RawAssetManifest = z.infer<typeof RawAssetManifestSchema>
