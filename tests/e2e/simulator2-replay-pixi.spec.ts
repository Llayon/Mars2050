import { expect, test, type Locator, type Page } from '@playwright/test'
import sharp from 'sharp'
import { collectNetwork, expectCanvasPainted } from './support/smoke-helpers'

test('simulator2 replay can render through the selected Pixi renderer', async ({ page }) => {
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

test('simulator2 Pixi replay fits and renders on a mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const network = collectNetwork(page)

  await page.goto('/simulator2')
  await expect(page.getByRole('heading', { name: /Симулятор Боя/ })).toBeVisible()
  expect(network.hasChunk('pixi'), 'first simulator screen should not load Pixi').toBe(false)

  await page.getByLabel('Replay renderer').selectOption('pixi')
  await loadReplayPreset(page, 'ranged_duel')
  await startSelectedSimulation(page)

  const canvas = page.locator('canvas').last()
  await expect(canvas).toBeVisible()
  await page.waitForTimeout(900)
  await expectCanvasPainted(canvas)
  await expect(page.getByRole('button', { name: /Пауза|Играть/ })).toBeVisible()
  await expect(page.getByText('Управление')).toHaveCount(0)
  await expect(page.getByText(/Метрики/)).toHaveCount(0)
  await expect(page.getByText('Оверлеи (Debug)')).toHaveCount(0)

  const box = await canvas.boundingBox()
  const controlsBox = await page.getByTestId('replay-controls').boundingBox()
  const viewport = page.viewportSize()
  expect(box).not.toBeNull()
  expect(controlsBox).not.toBeNull()
  expect(viewport).not.toBeNull()
  expect(box!.x, 'mobile Pixi replay canvas left edge').toBeGreaterThanOrEqual(0)
  expect(box!.x + box!.width, 'mobile Pixi replay canvas right edge').toBeLessThanOrEqual(viewport!.width + 1)
  expect(box!.width, 'mobile Pixi replay canvas width').toBeGreaterThan(300)
  expect(box!.height, 'mobile Pixi replay canvas height').toBeGreaterThan(600)
  expect(controlsBox!.height, 'mobile Pixi replay controls height').toBeLessThan(130)
  expect(controlsBox!.y + controlsBox!.height, 'mobile Pixi replay controls bottom edge').toBeLessThanOrEqual(viewport!.height)

  expect(network.hasChunk('pixi'), 'Pixi renderer should load after replay opens').toBe(true)
  expect(network.countPathPrefix('/api/')).toBe(0)
  network.assertClean()
})

test('simulator2 Pixi replay can seek, rewind, and stay stable while paused', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 })
  const network = collectNetwork(page)

  await page.goto('/simulator2')
  await expect(page.getByRole('heading', { name: /Симулятор Боя/ })).toBeVisible()
  await page.getByLabel('Replay renderer').selectOption('pixi')
  await loadReplayPreset(page, 'transform_modes')
  await startSelectedSimulation(page)

  const canvas = page.locator('canvas').last()
  const timeline = page.getByTestId('replay-timeline')
  const tickReadout = page.getByTestId('replay-current-tick')
  await expect(canvas).toBeVisible()
  await expect(timeline).toBeVisible()

  const maxTick = Number(await timeline.getAttribute('max'))
  expect(maxTick, 'timeline should cover the replay log').toBeGreaterThan(20)
  await page.getByRole('button', { name: /Пауза/ }).click()
  await setTimelineTick(timeline, 0)
  await expect(tickReadout).toContainText(`Tick 0 / ${maxTick}`)
  await page.waitForTimeout(120)
  const startFrame = await canvas.screenshot()

  const targetTick = Math.min(maxTick - 5, Math.max(12, Math.floor(maxTick * 0.35)))
  await setTimelineTick(timeline, targetTick)
  await expect(tickReadout).toContainText(`Tick ${targetTick} / ${maxTick}`)
  await page.waitForTimeout(120)
  const seekFrame = await canvas.screenshot()
  expect(await countChangedPixels(startFrame, seekFrame), 'Pixi seek should repaint a different battle state').toBeGreaterThan(80)

  const pausedA = await canvas.screenshot()
  await page.waitForTimeout(180)
  const pausedB = await canvas.screenshot()
  expect(await countChangedPixels(pausedA, pausedB), 'paused Pixi replay should not jitter').toBeLessThan(20)

  await setTimelineTick(timeline, 0)
  await expect(tickReadout).toContainText(`Tick 0 / ${maxTick}`)
  await page.waitForTimeout(120)
  const rewoundFrame = await canvas.screenshot()
  expect(await countChangedPixels(startFrame, rewoundFrame), 'Pixi rewind to tick 0 should rebuild the initial state').toBeLessThan(20)

  await page.getByRole('button', { name: /Играть/ }).click()
  await expect.poll(async () => Number(await timeline.inputValue()), { timeout: 5000 }).toBeGreaterThan(0)

  expect(network.hasChunk('pixi'), 'Pixi renderer should stay selected after replay opens').toBe(true)
  expect(network.countPathPrefix('/api/')).toBe(0)
  network.assertClean()
})

test('simulator2 Pixi replay keeps dense movement and crowd LOD readable', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 })
  const network = collectNetwork(page)

  await page.goto('/simulator2')
  await expect(page.getByRole('heading', { name: /Симулятор Боя/ })).toBeVisible()
  await page.getByLabel('Replay renderer').selectOption('pixi')

  await runDenseMovementVisualSmoke(page, 'marine_crowd_qa', 45)
  await loadReplayPreset(page, 'zerg_rush')
  await startSelectedSimulation(page)

  const canvas = page.locator('canvas').last()
  const timeline = page.getByTestId('replay-timeline')
  const tickReadout = page.getByTestId('replay-current-tick')
  await expect(canvas).toBeVisible()
  await expect(timeline).toBeVisible()

  const maxTick = Number(await timeline.getAttribute('max'))
  expect(maxTick, 'zerg_rush timeline should expose stress replay ticks').toBeGreaterThan(120)
  await page.getByRole('button', { name: /Пауза/ }).click()
  const targetTick = Math.min(maxTick - 5, 145)
  await setTimelineTick(timeline, targetTick)
  await expect(tickReadout).toContainText(`Tick ${targetTick} / ${maxTick}`)
  await page.waitForTimeout(160)
  await expectCanvasPainted(canvas)

  const pixels = await countCrowdLodPixels(canvas)
  expect(pixels.badgePurple, 'Pixi zerg stress state should not show crowd counter badges').toBeLessThan(12)
  expect(pixels.whiteTextPixels, 'Pixi zerg stress state should suppress per-unit labels').toBeLessThan(5000)

  await page.getByRole('button', { name: /✕/ }).click()
  await expect(canvas).toBeHidden()

  expect(network.hasChunk('pixi'), 'Pixi renderer should stay selected for dense QA').toBe(true)
  expect(network.countPathPrefix('/api/')).toBe(0)
  network.assertClean()
})

test('simulator2 Pixi replay renders former alias units through direct visual assets', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 })
  const network = collectNetwork(page)

  await page.goto('/simulator2')
  await expect(page.getByRole('heading', { name: /Симулятор Боя/ })).toBeVisible()
  expect(network.hasChunk('pixi'), 'first simulator screen should not load Pixi').toBe(false)

  await page.getByLabel('Replay renderer').selectOption('pixi')
  await loadReplayPreset(page, 'visual_alias_qa')
  await startSelectedSimulation(page)

  const canvas = page.locator('canvas').last()
  await expect(canvas).toBeVisible()
  await page.waitForTimeout(900)
  await expectCanvasPainted(canvas)

  await expect.poll(async () => (await countDirectVisualPixels(canvas)).spriteColorPixels, { timeout: 5000 }).toBeGreaterThan(50)
  const pixels = await countDirectVisualPixels(canvas)
  expect(pixels.whiteTextPixels, 'Pixi former alias units should avoid fallback unit labels').toBeLessThan(5000)

  await page.getByRole('button', { name: /✕/ }).click()
  await expect(canvas).toBeHidden()

  expect(network.hasChunk('pixi'), 'Pixi renderer should load for former alias visual QA').toBe(true)
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

async function runDenseMovementVisualSmoke(page: Page, preset: string, preferredTick: number): Promise<void> {
  await loadReplayPreset(page, preset)
  await startSelectedSimulation(page)

  const canvas = page.locator('canvas').last()
  const timeline = page.getByTestId('replay-timeline')
  const tickReadout = page.getByTestId('replay-current-tick')
  await expect(canvas).toBeVisible()
  await expect(timeline).toBeVisible()

  const maxTick = Number(await timeline.getAttribute('max'))
  const targetTick = Math.min(maxTick - 5, preferredTick)
  expect(targetTick, `${preset} should expose a dense movement tick`).toBeGreaterThan(0)
  await page.getByRole('button', { name: /Пауза/ }).click()
  await page.getByLabel(/Хитбоксы/).check()
  await page.getByLabel(/Векторы движения/).check()
  await setTimelineTick(timeline, targetTick)
  await expect(tickReadout).toContainText(`Tick ${targetTick} / ${maxTick}`)
  await page.waitForTimeout(160)

  const overlayPixels = await countOverlayPixels(canvas)
  expect(overlayPixels.hitboxCyan, `${preset} Pixi tick ${targetTick} should show hitbox overlays`).toBeGreaterThan(10)
  const firstFrame = await canvas.screenshot()
  await page.waitForTimeout(180)
  const secondFrame = await canvas.screenshot()
  expect(await countChangedPixels(firstFrame, secondFrame), `${preset} Pixi tick ${targetTick} paused replay should not jitter`).toBeLessThan(20)

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

async function countCrowdLodPixels(canvas: Locator): Promise<{ badgePurple: number; whiteTextPixels: number }> {
  const buffer = await canvas.screenshot()
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  let badgePurple = 0
  let whiteTextPixels = 0

  for (let pixel = 0; pixel < info.width * info.height; pixel++) {
    const index = pixel * 4
    const red = data[index]
    const green = data[index + 1]
    const blue = data[index + 2]
    const alpha = data[index + 3]
    if (alpha < 180) continue
    if (red > 140 && red < 205 && green > 55 && green < 130 && blue > 210) badgePurple++
    if (red > 245 && green > 245 && blue > 245) whiteTextPixels++
  }

  return { badgePurple, whiteTextPixels }
}

async function countDirectVisualPixels(canvas: Locator): Promise<{ spriteColorPixels: number; whiteTextPixels: number }> {
  const buffer = await canvas.screenshot()
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  let spriteColorPixels = 0
  let whiteTextPixels = 0

  for (let pixel = 0; pixel < info.width * info.height; pixel++) {
    const index = pixel * 4
    const red = data[index]
    const green = data[index + 1]
    const blue = data[index + 2]
    const alpha = data[index + 3]
    if (alpha < 180) continue

    const isEnemyHp = red > 160 && green < 150 && blue < 150
    const isFriendlyHp = green > 150 && red < 90 && blue < 140
    const isGrid = Math.abs(red - green) < 12 && Math.abs(green - blue) < 12 && red > 70 && red < 180
    if (red > 245 && green > 245 && blue > 245) whiteTextPixels++
    if (!isEnemyHp && !isFriendlyHp && !isGrid && red + green + blue > 110) spriteColorPixels++
  }

  return { spriteColorPixels, whiteTextPixels }
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
