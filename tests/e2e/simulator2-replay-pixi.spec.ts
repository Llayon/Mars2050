import { expect, test, type Locator, type Page } from '@playwright/test'
import sharp from 'sharp'
import { collectNetwork, expectCanvasPainted } from './support/smoke-helpers'

test('simulator2 replay can render through the Pixi opt-in renderer', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 })
  const network = collectNetwork(page)

  await page.goto('/simulator2')
  await expect(page.getByRole('heading', { name: /Симулятор Боя/ })).toBeVisible()
  expect(network.hasChunk('pixi'), 'first simulator screen should not load Pixi').toBe(false)

  await page.getByLabel('Replay renderer').selectOption('pixi')
  await loadReplayPreset(page, 'ranged_duel')
  await startSelectedSimulation(page)

  const canvas = page.locator('canvas').last()
  const timeline = page.getByTestId('replay-timeline')
  const tickReadout = page.getByTestId('replay-current-tick')
  await expect(canvas).toBeVisible()
  await expect(timeline).toBeVisible()
  await page.waitForTimeout(900)
  await expectCanvasPainted(canvas)
  expect(network.hasChunk('pixi'), 'Pixi renderer should load Pixi only after replay opens').toBe(true)

  const maxTick = Number(await timeline.getAttribute('max'))
  const movementTick = Math.min(maxTick - 5, 20)
  await page.getByRole('button', { name: /Пауза/ }).click()
  await setTimelineTick(timeline, movementTick)
  await expect(tickReadout).toContainText(`Tick ${movementTick} / ${maxTick}`)
  await page.getByLabel(/Хитбоксы/).check()
  await page.getByLabel(/Векторы движения/).check()
  await page.getByLabel(/Линии атак/).check()
  await page.waitForTimeout(120)
  await expect.poll(async () => (await countOverlayPixels(canvas)).hitboxCyan, { timeout: 5000 }).toBeGreaterThan(10)
  await expect.poll(async () => (await countOverlayPixels(canvas)).velocityYellow, { timeout: 8000 }).toBeGreaterThan(5)
  await page.getByRole('button', { name: /Играть/ }).click()
  await expect.poll(async () => (await countOverlayPixels(canvas)).targetRed, { timeout: 12000 }).toBeGreaterThan(5)

  await page.getByRole('button', { name: /✕/ }).click()
  await expect(canvas).toBeHidden()

  expect(network.countPathPrefix('/api/')).toBe(0)
  network.assertClean()
})

async function loadReplayPreset(page: Page, preset: string): Promise<void> {
  const presetSelect = page.locator('select').first()
  await presetSelect.evaluate((element, value) => {
    const input = element as HTMLSelectElement
    const valueSetter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set
    valueSetter?.call(input, '')
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
    valueSetter?.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
  }, preset)
  await expect(presetSelect).toHaveValue(preset)
}

async function startSelectedSimulation(page: Page): Promise<void> {
  const startButton = page.getByRole('button', { name: /НАЧАТЬ СИМУЛЯЦИЮ/ })
  await expect(startButton).toBeEnabled()
  await startButton.click()
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

async function countOverlayPixels(canvas: Locator): Promise<{ hitboxCyan: number; velocityYellow: number; targetRed: number }> {
  const buffer = await canvas.screenshot()
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  let hitboxCyan = 0
  let velocityYellow = 0
  let targetRed = 0

  for (let pixel = 0; pixel < info.width * info.height; pixel++) {
    const index = pixel * 4
    const red = data[index]
    const green = data[index + 1]
    const blue = data[index + 2]
    const alpha = data[index + 3]
    if (alpha < 180) continue
    if (red < 90 && green > 170 && blue > 180) hitboxCyan++
    if (red > 230 && green > 210 && blue > 100 && blue < 180) velocityYellow++
    if (red > 230 && green < 70 && blue < 70) targetRed++
  }

  return { hitboxCyan, velocityYellow, targetRed }
}
