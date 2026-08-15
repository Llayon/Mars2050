import { z } from 'zod'
import { ASSET_RENDER_LAYERS, VisualAssetOverhangSchema } from './mars-map-asset.types'

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
  footprint: z.array(z.object({ x: z.number().int(), y: z.number().int() })).optional(),
  overhangPx: VisualAssetOverhangSchema.optional()
})
export type RawAssetEntry = z.infer<typeof RawAssetEntrySchema>

/** Input raw manifest consumed by compiler (authoritative profile is loaded separately). */
export const RawAssetManifestSchema = z.object({
  version: z.literal(2),
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
