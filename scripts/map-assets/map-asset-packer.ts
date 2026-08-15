import sharp from 'sharp'

export interface BoundingBox {
  left: number
  top: number
  width: number
  height: number
}

export interface PackItemInput {
  id: string
  width: number
  height: number
}

export interface PackItemOutput {
  id: string
  page: number
  x: number
  y: number
  width: number
  height: number
}

interface FreeRect {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Computes bounding box of non-transparent pixels (alpha > 0) from an RGBA image buffer.
 * Returns null if the image is completely transparent.
 */
export async function computeAlphaTrim(imageBuffer: Buffer): Promise<BoundingBox | null> {
  const { data, info } = await sharp(imageBuffer).raw().toBuffer({ resolveWithObject: true })
  const { width, height, channels } = info

  if (channels < 4) {
    return { left: 0, top: 0, width, height }
  }

  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * channels
      const alpha = data[idx + 3]
      if (alpha > 0) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }

  if (maxX < minX || maxY < minY) {
    return null // Fully transparent image
  }

  return {
    left: minX,
    top: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1
  }
}

/**
 * Extrudes edge pixels outwards by `extrude` pixels on an RGBA raw image buffer to prevent bilinear bleeding.
 */
export async function extrudeImage(
  imageBuffer: Buffer,
  extrude: number
): Promise<{ buffer: Buffer; width: number; height: number }> {
  if (extrude <= 0) {
    const meta = await sharp(imageBuffer).metadata()
    return { buffer: imageBuffer, width: meta.width || 0, height: meta.height || 0 }
  }

  const { data, info } = await sharp(imageBuffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const srcW = info.width
  const srcH = info.height
  const dstW = srcW + 2 * extrude
  const dstH = srcH + 2 * extrude
  const dstData = Buffer.alloc(dstW * dstH * 4)

  for (let y = 0; y < dstH; y++) {
    const srcY = Math.min(Math.max(0, y - extrude), srcH - 1)
    for (let x = 0; x < dstW; x++) {
      const srcX = Math.min(Math.max(0, x - extrude), srcW - 1)
      const srcIdx = (srcY * srcW + srcX) * 4
      const dstIdx = (y * dstW + x) * 4

      dstData[dstIdx] = data[srcIdx]
      dstData[dstIdx + 1] = data[srcIdx + 1]
      dstData[dstIdx + 2] = data[srcIdx + 2]
      dstData[dstIdx + 3] = data[srcIdx + 3]
    }
  }

  const extrudedBuffer = await sharp(dstData, {
    raw: { width: dstW, height: dstH, channels: 4 }
  }).png().toBuffer()

  return { buffer: extrudedBuffer, width: dstW, height: dstH }
}

/**
 * Packs multiple rectangles into fixed-size atlas pages using deterministic MaxRects-BSSF.
 */
export function packRectangles(
  items: PackItemInput[],
  pageSize: number,
  padding: number,
  extrude: number
): PackItemOutput[] {
  // Sort deterministically: descending height, then descending width, then alphabetical ID
  const sorted = [...items].sort((a, b) => {
    if (b.height !== a.height) return b.height - a.height
    if (b.width !== a.width) return b.width - a.width
    return a.id.localeCompare(b.id)
  })

  const results: PackItemOutput[] = []
  const pages: FreeRect[][] = []

  function findPositionInPage(freeRects: FreeRect[], w: number, h: number): { x: number; y: number; rectIdx: number } | null {
    let bestShortSideFit = Infinity
    let bestPos: { x: number; y: number; rectIdx: number } | null = null

    for (let i = 0; i < freeRects.length; i++) {
      const r = freeRects[i]
      if (r.width >= w && r.height >= h) {
        const leftoverX = r.width - w
        const leftoverY = r.height - h
        const shortSideFit = Math.min(leftoverX, leftoverY)
        if (shortSideFit < bestShortSideFit) {
          bestShortSideFit = shortSideFit
          bestPos = { x: r.x, y: r.y, rectIdx: i }
        }
      }
    }
    return bestPos
  }

  function splitFreeRects(freeRects: FreeRect[], used: { x: number; y: number; width: number; height: number }): FreeRect[] {
    const nextFree: FreeRect[] = []

    for (const r of freeRects) {
      if (
        used.x >= r.x + r.width ||
        used.x + used.width <= r.x ||
        used.y >= r.y + r.height ||
        used.y + used.height <= r.y
      ) {
        nextFree.push(r)
        continue
      }

      if (used.x > r.x && used.x < r.x + r.width) {
        nextFree.push({ x: r.x, y: r.y, width: used.x - r.x, height: r.height })
      }
      if (used.x + used.width < r.x + r.width) {
        nextFree.push({ x: used.x + used.width, y: r.y, width: r.x + r.width - (used.x + used.width), height: r.height })
      }
      if (used.y > r.y && used.y < r.y + r.height) {
        nextFree.push({ x: r.x, y: r.y, width: r.width, height: used.y - r.y })
      }
      if (used.y + used.height < r.y + r.height) {
        nextFree.push({ x: r.x, y: used.y + used.height, width: r.width, height: r.y + r.height - (used.y + used.height) })
      }
    }

    return nextFree.filter((a, i) => !nextFree.some((b, j) => i !== j && b.x <= a.x && b.y <= a.y && b.x + b.width >= a.x + a.width && b.y + b.height >= a.y + a.height))
  }

  for (const item of sorted) {
    const totalSlotW = item.width + 2 * extrude + padding
    const totalSlotH = item.height + 2 * extrude + padding

    if (totalSlotW > pageSize || totalSlotH > pageSize) {
      throw new Error(`Item "${item.id}" dimensions (${totalSlotW}x${totalSlotH} including gutter) exceed atlas page size (${pageSize}x${pageSize})`)
    }

    let placed = false

    for (let pageIdx = 0; pageIdx < pages.length; pageIdx++) {
      const pos = findPositionInPage(pages[pageIdx], totalSlotW, totalSlotH)
      if (pos) {
        pages[pageIdx] = splitFreeRects(pages[pageIdx], { x: pos.x, y: pos.y, width: totalSlotW, height: totalSlotH })
        results.push({
          id: item.id,
          page: pageIdx,
          x: pos.x + extrude,
          y: pos.y + extrude,
          width: item.width,
          height: item.height
        })
        placed = true
        break
      }
    }

    if (!placed) {
      const newPageIdx = pages.length
      const initialFree: FreeRect[] = [{ x: 0, y: 0, width: pageSize, height: pageSize }]
      pages.push(splitFreeRects(initialFree, { x: 0, y: 0, width: totalSlotW, height: totalSlotH }))
      results.push({
        id: item.id,
        page: newPageIdx,
        x: extrude,
        y: extrude,
        width: item.width,
        height: item.height
      })
    }
  }

  // Sort results by ID for deterministic output
  return results.sort((a, b) => a.id.localeCompare(b.id))
}
