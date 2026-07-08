import { expect, test, type Locator, type Page } from '@playwright/test'
import sharp from 'sharp'
import { collectNetwork } from './support/smoke-helpers'

const REPLAY_PRESETS = [
  'stealth_reveal',
  'projectile_barrier',
  'summon_caps',
  'control_status',
  'transform_modes',
  'cleanse_status',
]

test('simulator2 replay renders combat presets without browser errors', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 })
  const network = collectNetwork(page)
  const consoleWarnings = collectConsoleWarnings(page)

  await page.goto('/simulator2')
  await expect(page.getByRole('heading', { name: /Симулятор Боя/ })).toBeVisible()

  for (const preset of REPLAY_PRESETS) {
    await runReplayPreset(page, preset)
  }

  expect(network.hasChunk('pixi'), 'simulator2 replay should stay on the canvas renderer').toBe(false)
  expect(network.countPathPrefix('/api/')).toBe(0)
  expect(consoleWarnings, 'console warnings').toEqual([])
  network.assertClean()
})

test('simulator2 replay fits and renders on a mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const network = collectNetwork(page)
  const consoleWarnings = collectConsoleWarnings(page)

  await page.goto('/simulator2')
  await expect(page.getByRole('heading', { name: /Симулятор Боя/ })).toBeVisible()
  await page.locator('select').first().selectOption('stealth_reveal')
  await page.getByRole('button', { name: /НАЧАТЬ СИМУЛЯЦИЮ/ }).click()

  const canvas = page.locator('canvas').last()
  await expect(canvas).toBeVisible()
  await page.waitForTimeout(900)
  await expectBattleReplayCanvasPainted(canvas)
  await expect(page.getByRole('button', { name: /Пауза|Играть/ })).toBeVisible()

  const box = await canvas.boundingBox()
  expect(box).not.toBeNull()
  const viewport = page.viewportSize()
  expect(viewport).not.toBeNull()
  expect(box!.x, 'mobile replay canvas left edge').toBeGreaterThanOrEqual(0)
  expect(box!.x + box!.width, 'mobile replay canvas right edge').toBeLessThanOrEqual(viewport!.width + 1)
  expect(box!.width, 'mobile replay canvas width').toBeGreaterThan(300)
  expect(box!.height, 'mobile replay canvas height').toBeGreaterThan(600)

  expect(network.hasChunk('pixi'), 'mobile simulator2 replay should stay on the canvas renderer').toBe(false)
  expect(consoleWarnings, 'console warnings').toEqual([])
  network.assertClean()
})

test('simulator2 replay debug overlays render hitboxes, velocity, and target lines', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 })
  const network = collectNetwork(page)
  const consoleWarnings = collectConsoleWarnings(page)

  await page.goto('/simulator2')
  await expect(page.getByRole('heading', { name: /Симулятор Боя/ })).toBeVisible()
  await page.locator('select').first().selectOption('projectile_barrier')
  await page.getByRole('button', { name: /НАЧАТЬ СИМУЛЯЦИЮ/ }).click()

  const canvas = page.locator('canvas').last()
  await expect(canvas).toBeVisible()
  await page.getByLabel(/Хитбоксы/).check()
  await page.getByLabel(/Векторы движения/).check()
  await page.getByLabel(/Линии атак/).check()

  await expect.poll(async () => (await countOverlayPixels(canvas)).hitboxCyan, { timeout: 5000 }).toBeGreaterThan(10)
  await expect.poll(async () => (await countOverlayPixels(canvas)).velocityYellow, { timeout: 8000 }).toBeGreaterThan(5)
  await expect.poll(async () => (await countOverlayPixels(canvas)).targetRed, { timeout: 12000 }).toBeGreaterThan(5)

  expect(network.hasChunk('pixi'), 'simulator2 replay overlays should stay on the canvas renderer').toBe(false)
  expect(consoleWarnings, 'console warnings').toEqual([])
  network.assertClean()
})

test('simulator2 replay timeline can seek, rewind, and resume playback', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 })
  const network = collectNetwork(page)
  const consoleWarnings = collectConsoleWarnings(page)

  await page.goto('/simulator2')
  await expect(page.getByRole('heading', { name: /Симулятор Боя/ })).toBeVisible()
  await page.locator('select').first().selectOption('transform_modes')
  await page.getByRole('button', { name: /НАЧАТЬ СИМУЛЯЦИЮ/ }).click()

  const canvas = page.locator('canvas').last()
  const timeline = page.getByTestId('replay-timeline')
  const tickReadout = page.getByTestId('replay-current-tick')
  await expect(canvas).toBeVisible()
  await expect(timeline).toBeVisible()

  const maxTick = Number(await timeline.getAttribute('max'))
  expect(maxTick, 'timeline should cover the replay log').toBeGreaterThan(20)

  await page.getByRole('button', { name: /Пауза/ }).click()
  await expect(page.getByRole('button', { name: /Играть/ })).toBeVisible()
  await setTimelineTick(timeline, 0)
  await expect(tickReadout).toContainText(`Tick 0 / ${maxTick}`)
  await page.waitForTimeout(100)
  const startFrame = await canvas.screenshot()

  const targetTick = Math.min(maxTick - 5, Math.max(12, Math.floor(maxTick * 0.35)))
  await setTimelineTick(timeline, targetTick)
  await expect(tickReadout).toContainText(`Tick ${targetTick} / ${maxTick}`)
  await page.waitForTimeout(100)
  const seekFrame = await canvas.screenshot()
  expect(await countChangedPixels(startFrame, seekFrame), 'seek should repaint a different battle state').toBeGreaterThan(80)

  await setTimelineTick(timeline, 0)
  await expect(tickReadout).toContainText(`Tick 0 / ${maxTick}`)
  await page.waitForTimeout(100)
  const rewoundFrame = await canvas.screenshot()
  expect(await countChangedPixels(startFrame, rewoundFrame), 'rewind to tick 0 should rebuild the initial state').toBeLessThan(20)

  await page.getByRole('button', { name: /Играть/ }).click()
  await expect.poll(async () => Number(await timeline.inputValue()), { timeout: 5000 }).toBeGreaterThan(0)

  expect(network.hasChunk('pixi'), 'simulator2 replay timeline should stay on the canvas renderer').toBe(false)
  expect(consoleWarnings, 'console warnings').toEqual([])
  network.assertClean()
})

async function runReplayPreset(page: Page, preset: string): Promise<void> {
  await page.locator('select').first().selectOption(preset)
  await page.getByRole('button', { name: /НАЧАТЬ СИМУЛЯЦИЮ/ }).click()

  const canvas = page.locator('canvas').last()
  await expect(canvas).toBeVisible()
  await page.waitForTimeout(900)
  await expectBattleReplayCanvasPainted(canvas)
  await expect(page.getByText(/Метрики \(Tick/)).toBeVisible()
  await expect(page.getByRole('button', { name: /Пауза|Играть/ })).toBeVisible()

  await page.getByRole('button', { name: /✕/ }).click()
  await expect(canvas).toBeHidden()
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

function collectConsoleWarnings(page: Page): string[] {
  const warnings: string[] = []
  page.on('console', message => {
    if (message.type() === 'warning') warnings.push(message.text())
  })
  return warnings
}

async function expectBattleReplayCanvasPainted(canvas: Locator): Promise<void> {
  const buffer = await canvas.screenshot()
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  let redTeamPixels = 0
  let blueTeamPixels = 0

  for (let pixel = 0; pixel < info.width * info.height; pixel++) {
    const index = pixel * 4
    const red = data[index]
    const green = data[index + 1]
    const blue = data[index + 2]
    const alpha = data[index + 3]
    if (alpha < 180) continue
    if (red > 170 && green < 120 && blue < 130) redTeamPixels++
    if (blue > 150 && red < 130 && green > 80) blueTeamPixels++
  }

  expect(redTeamPixels, 'replay canvas should contain red team unit pixels').toBeGreaterThan(20)
  expect(blueTeamPixels, 'replay canvas should contain blue team unit pixels').toBeGreaterThan(20)
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

async function countChangedPixels(before: Buffer, after: Buffer): Promise<number> {
  const first = await sharp(before).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const second = await sharp(after).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  expect(second.info.width).toBe(first.info.width)
  expect(second.info.height).toBe(first.info.height)

  let changed = 0
  for (let pixel = 0; pixel < first.info.width * first.info.height; pixel++) {
    const index = pixel * 4
    const delta = Math.abs(first.data[index] - second.data[index]) +
      Math.abs(first.data[index + 1] - second.data[index + 1]) +
      Math.abs(first.data[index + 2] - second.data[index + 2])
    if (delta > 40) changed++
  }
  return changed
}
