import { expect, test, type Locator, type Page } from '@playwright/test'
import sharp from 'sharp'
import { collectNetwork, expectCanvasPainted } from './support/smoke-helpers'

const BASELINE_PRESET = 'transform_modes'
const SNAPSHOT_OPTIONS = { maxDiffPixelRatio: 0.012, threshold: 0.18 }

test('simulator2 replay canvas matches stable visual baselines', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 })
  const network = collectNetwork(page)

  await openReplayPreset(page, BASELINE_PRESET)

  const canvas = page.locator('canvas').last()
  const timeline = page.getByTestId('replay-timeline')
  const tickReadout = page.getByTestId('replay-current-tick')
  await expect(canvas).toBeVisible()
  await expect(timeline).toBeVisible()
  await expectCanvasPainted(canvas)

  const maxTick = Number(await timeline.getAttribute('max'))
  expect(maxTick, 'timeline should expose the whole replay').toBeGreaterThan(20)

  await page.getByRole('button', { name: /Пауза/ }).click()
  await expect(page.getByRole('button', { name: /Играть/ })).toBeVisible()

  await setTimelineTick(timeline, 0)
  await expect(tickReadout).toContainText(`Tick 0 / ${maxTick}`)
  await expect(canvas).toHaveScreenshot('simulator2-replay-start.png', SNAPSHOT_OPTIONS)

  const midTick = Math.min(maxTick - 5, Math.max(12, Math.floor(maxTick * 0.35)))
  await setTimelineTick(timeline, midTick)
  await expect(tickReadout).toContainText(`Tick ${midTick} / ${maxTick}`)
  await expect(canvas).toHaveScreenshot('simulator2-replay-mid-seek.png', SNAPSHOT_OPTIONS)

  await page.getByLabel(/Хитбоксы/).check()
  await page.getByLabel(/Векторы движения/).check()
  await page.getByLabel(/Линии атак/).check()
  const overlayPixels = await countOverlayPixels(canvas)
  expect(overlayPixels.hitboxCyan, 'overlay snapshot should include hitboxes').toBeGreaterThan(10)
  expect(overlayPixels.velocityYellow, 'overlay snapshot should include movement vectors').toBeGreaterThan(0)
  await expect(canvas).toHaveScreenshot('simulator2-replay-overlays.png', SNAPSHOT_OPTIONS)

  expect(network.hasChunk('pixi'), 'visual baselines should stay on the canvas renderer').toBe(false)
  expect(network.countPathPrefix('/api/')).toBe(0)
  network.assertClean()
})

async function openReplayPreset(page: Page, preset: string): Promise<void> {
  await page.goto('/simulator2')
  await expect(page.getByRole('heading', { name: /Симулятор Боя/ })).toBeVisible()
  await page.getByLabel('Replay renderer').selectOption('canvas')
  await page.locator('select').first().selectOption(preset)
  await page.getByRole('button', { name: /НАЧАТЬ СИМУЛЯЦИЮ/ }).click()
}

async function setTimelineTick(timeline: Locator, tick: number): Promise<void> {
  await timeline.evaluate((element, value) => {
    const input = element as HTMLInputElement
    const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    valueSetter?.call(input, String(value))
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
  }, tick)
}

async function countOverlayPixels(canvas: Locator): Promise<{ hitboxCyan: number; velocityYellow: number }> {
  const buffer = await canvas.screenshot()
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  let hitboxCyan = 0
  let velocityYellow = 0

  for (let pixel = 0; pixel < info.width * info.height; pixel++) {
    const index = pixel * 4
    const red = data[index]
    const green = data[index + 1]
    const blue = data[index + 2]
    const alpha = data[index + 3]
    if (alpha < 180) continue
    if (red < 90 && green > 170 && blue > 180) hitboxCyan++
    if (red > 230 && green > 210 && blue > 100 && blue < 180) velocityYellow++
  }

  return { hitboxCyan, velocityYellow }
}
