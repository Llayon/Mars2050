import { describe, it, expect } from 'vitest'
import sharp from 'sharp'
import { computeAlphaTrim, extrudeImage, packRectangles } from '../../scripts/map-assets/map-asset-packer'

describe('map-asset-packer (Alpha Trim, Extrusion & MaxRects Packing)', () => {
  it('computeAlphaTrim calculates bounding box and returns null on empty image', async () => {
    // 1. Non-empty: 100x100 transparent image with a 20x30 solid rectangle at (10, 20)
    const imgData = Buffer.alloc(100 * 100 * 4)
    for (let y = 20; y < 50; y++) {
      for (let x = 10; x < 30; x++) {
        const idx = (y * 100 + x) * 4
        imgData[idx] = 255
        imgData[idx + 1] = 120
        imgData[idx + 2] = 50
        imgData[idx + 3] = 255
      }
    }

    const pngBuf = await sharp(imgData, { raw: { width: 100, height: 100, channels: 4 } }).png().toBuffer()
    const box = await computeAlphaTrim(pngBuf)
    expect(box).toEqual({ left: 10, top: 20, width: 20, height: 30 })

    // 2. Fully transparent: 50x50 zero alpha
    const emptyBuf = await sharp({ create: { width: 50, height: 50, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toBuffer()
    const emptyBox = await computeAlphaTrim(emptyBuf)
    expect(emptyBox).toBeNull()
  })

  it('extrudeImage extends edge pixels by 2px with true border clamping across all corners', async () => {
    // 2x2 test image with distinct 4 corner colors
    const rawData = Buffer.from([
      255, 0, 0, 255,     0, 255, 0, 255,     // Top-left: Red, Top-right: Green
      0, 0, 255, 255,     255, 255, 0, 255    // Bottom-left: Blue, Bottom-right: Yellow
    ])
    const srcBuf = await sharp(rawData, { raw: { width: 2, height: 2, channels: 4 } }).png().toBuffer()
    const { buffer, width, height } = await extrudeImage(srcBuf, 2)

    expect(width).toBe(6) // 2 + 2*2
    expect(height).toBe(6)

    const { data } = await sharp(buffer).raw().toBuffer({ resolveWithObject: true })
    const getPixel = (x: number, y: number) => {
      const idx = (y * 6 + x) * 4
      return [data[idx], data[idx + 1], data[idx + 2], data[idx + 3]]
    }

    expect(getPixel(0, 0)).toEqual([255, 0, 0, 255])
    expect(getPixel(5, 0)).toEqual([0, 255, 0, 255])
    expect(getPixel(0, 5)).toEqual([0, 0, 255, 255])
    expect(getPixel(5, 5)).toEqual([255, 255, 0, 255])
    expect(getPixel(2, 2)).toEqual([255, 0, 0, 255])
  })

  it('packRectangles deterministically packs items and splits into multiple pages when exceeding capacity', () => {
    const items = [
      { id: 'item_c', width: 400, height: 400 },
      { id: 'item_a', width: 400, height: 400 },
      { id: 'item_b', width: 400, height: 400 }
    ]

    const packed = packRectangles(items, 512, 4, 2)
    const pages = new Set(packed.map(p => p.page))

    expect(pages.size).toBe(3)
    for (const p of packed) {
      expect(p.x).toBe(2)
      expect(p.y).toBe(2)
      expect(p.x + p.width).toBeLessThanOrEqual(512)
      expect(p.y + p.height).toBeLessThanOrEqual(512)
    }

    const packedReversed = packRectangles([...items].reverse(), 512, 4, 2)
    expect(packed).toEqual(packedReversed)
  })
})
