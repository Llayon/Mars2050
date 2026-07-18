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

  expect(network.hasChunk('pixi'), 'simulator2 replay should use the Pixi default renderer').toBe(true)
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
  await loadReplayPreset(page, 'ranged_duel')
  await startSelectedSimulation(page)

  const canvas = page.locator('canvas').last()
  await expect(canvas).toBeVisible()
  await page.waitForTimeout(900)
  await expectBattleReplayCanvasPainted(canvas, { requireHp: false })
  expect((await countDirectVisualPixels(canvas)).spriteColorPixels, 'mobile replay canvas should contain unit sprites').toBeGreaterThan(50)
  await expect(page.getByRole('button', { name: /Пауза|Играть/ })).toBeVisible()

  const box = await canvas.boundingBox()
  expect(box).not.toBeNull()
  const viewport = page.viewportSize()
  expect(viewport).not.toBeNull()
  expect(box!.x, 'mobile replay canvas left edge').toBeGreaterThanOrEqual(0)
  expect(box!.x + box!.width, 'mobile replay canvas right edge').toBeLessThanOrEqual(viewport!.width + 1)
  expect(box!.width, 'mobile replay canvas width').toBeGreaterThan(300)
  expect(box!.height, 'mobile replay canvas height').toBeGreaterThan(600)

  expect(network.hasChunk('pixi'), 'mobile simulator2 replay should use the Pixi default renderer').toBe(true)
  expect(consoleWarnings, 'console warnings').toEqual([])
  network.assertClean()
})

test('simulator2 replay debug overlays render hitboxes, velocity, and target lines', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 })
  const network = collectNetwork(page)
  const consoleWarnings = collectConsoleWarnings(page)

  await page.goto('/simulator2')
  await expect(page.getByRole('heading', { name: /Симулятор Боя/ })).toBeVisible()
  await loadReplayPreset(page, 'projectile_barrier')
  await startSelectedSimulation(page)

  const canvas = page.locator('canvas').last()
  const timeline = page.getByTestId('replay-timeline')
  const tickReadout = page.getByTestId('replay-current-tick')
  await expect(canvas).toBeVisible()
  await page.getByRole('button', { name: /Пауза/ }).click()
  await expect(page.getByRole('button', { name: /Играть/ })).toBeVisible()
  await page.getByLabel(/Хитбоксы/).check()
  await page.getByLabel(/Векторы движения/).check()
  await page.getByLabel(/Линии атак/).check()
  await setTimelineTick(timeline, 7)
  await expect(tickReadout).toContainText(/Tick 7 \//)

  await expect.poll(async () => (await countOverlayPixels(canvas)).hitboxCyan, { timeout: 5000 }).toBeGreaterThan(10)
  await expect.poll(async () => (await countOverlayPixels(canvas)).velocityYellow, { timeout: 8000 }).toBeGreaterThan(5)
  await page.getByRole('button', { name: /Играть/ }).click()
  await expect.poll(async () => Number(await timeline.inputValue())).toBeGreaterThan(7)
  await page.getByRole('button', { name: /Пауза/ }).click()
  await expect.poll(async () => (await countOverlayPixels(canvas)).targetRed, { timeout: 12000 }).toBeGreaterThan(5)

  expect(network.hasChunk('pixi'), 'simulator2 replay overlays should use the Pixi default renderer').toBe(true)
  expect(consoleWarnings, 'console warnings').toEqual([])
  network.assertClean()
})

test('simulator2 replay keeps dense movement states visually stable', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 })
  const network = collectNetwork(page)
  const consoleWarnings = collectConsoleWarnings(page)

  await page.goto('/simulator2')
  await expect(page.getByRole('heading', { name: /Симулятор Боя/ })).toBeVisible()

  for (const preset of ['ranged_duel', 'marine_crowd_qa', 'massive_clash']) {
    await runDenseMovementVisualSmoke(page, preset)
  }

  expect(network.hasChunk('pixi'), 'dense movement replay should use the Pixi default renderer').toBe(true)
  expect(network.countPathPrefix('/api/')).toBe(0)
  expect(consoleWarnings, 'console warnings').toEqual([])
  network.assertClean()
})

test('simulator2 replay uses badge-free crowd LOD for zerg rush stress states', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 })
  const network = collectNetwork(page)
  const consoleWarnings = collectConsoleWarnings(page)

  await page.goto('/simulator2')
  await expect(page.getByRole('heading', { name: /Симулятор Боя/ })).toBeVisible()
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
  await expect(page.getByRole('button', { name: /Играть/ })).toBeVisible()

  for (const tick of [80, 145]) {
    const targetTick = Math.min(maxTick - 5, tick)
    await setTimelineTick(timeline, targetTick)
    await expect(tickReadout).toContainText(`Tick ${targetTick} / ${maxTick}`)
    await page.waitForTimeout(120)
    await expectBattleReplayCanvasPainted(canvas)

    const pixels = await countCrowdLodPixels(canvas)
    expect(pixels.badgePurple, `zerg_rush tick ${targetTick} should not show crowd counter badges`).toBeLessThan(12)
    expect(pixels.whiteTextPixels, `zerg_rush tick ${targetTick} should suppress per-unit labels`).toBeLessThan(5000)

    const firstFrame = await canvas.screenshot()
    await page.waitForTimeout(180)
    const secondFrame = await canvas.screenshot()
    expect(await countChangedPixels(firstFrame, secondFrame), `zerg_rush tick ${targetTick} paused replay frame should not jitter`).toBeLessThan(20)
  }

  await page.getByRole('button', { name: /✕/ }).click()
  await expect(canvas).toBeHidden()

  expect(network.hasChunk('pixi'), 'zerg rush crowd LOD should use the Pixi default renderer').toBe(true)
  expect(network.countPathPrefix('/api/')).toBe(0)
  expect(consoleWarnings, 'console warnings').toEqual([])
  network.assertClean()
})

test('simulator2 replay renders direct T1 unit sprites without fallback label noise', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 })
  const network = collectNetwork(page)
  const consoleWarnings = collectConsoleWarnings(page)

  await page.goto('/simulator2')
  await expect(page.getByRole('heading', { name: /Симулятор Боя/ })).toBeVisible()
  await loadReplayPreset(page, 'tier1_visual_qa')
  await startSelectedSimulation(page)

  const canvas = page.locator('canvas').last()
  await expect(canvas).toBeVisible()
  await page.waitForTimeout(900)
  await expectBattleReplayCanvasPainted(canvas)

  await expect.poll(async () => (await countDirectVisualPixels(canvas)).spriteColorPixels, { timeout: 5000 }).toBeGreaterThan(50)
  const pixels = await countDirectVisualPixels(canvas)
  expect(pixels.whiteTextPixels, 'direct T1 sprites should avoid fallback unit labels').toBeLessThan(5000)

  await page.getByRole('button', { name: /✕/ }).click()
  await expect(canvas).toBeHidden()

  expect(network.hasChunk('pixi'), 'T1 visual QA should use the Pixi default renderer').toBe(true)
  expect(network.countPathPrefix('/api/')).toBe(0)
  expect(consoleWarnings, 'console warnings').toEqual([])
  network.assertClean()
})

test('simulator2 replay renders former alias units through direct visual assets', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 })
  const network = collectNetwork(page)
  const consoleWarnings = collectConsoleWarnings(page)

  await page.goto('/simulator2')
  await expect(page.getByRole('heading', { name: /Симулятор Боя/ })).toBeVisible()
  await loadReplayPreset(page, 'visual_alias_qa')
  await startSelectedSimulation(page)

  const canvas = page.locator('canvas').last()
  await expect(canvas).toBeVisible()
  await page.waitForTimeout(900)
  await expectBattleReplayCanvasPainted(canvas)

  await expect.poll(async () => (await countDirectVisualPixels(canvas)).spriteColorPixels, { timeout: 5000 }).toBeGreaterThan(50)
  const pixels = await countDirectVisualPixels(canvas)
  expect(pixels.whiteTextPixels, 'former alias units should avoid fallback unit labels').toBeLessThan(5000)

  await page.getByRole('button', { name: /✕/ }).click()
  await expect(canvas).toBeHidden()

  expect(network.hasChunk('pixi'), 'former alias visual QA should use the Pixi default renderer').toBe(true)
  expect(network.countPathPrefix('/api/')).toBe(0)
  expect(consoleWarnings, 'console warnings').toEqual([])
  network.assertClean()
})

test('simulator2 replay timeline can seek, rewind, and resume playback', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 })
  const network = collectNetwork(page)
  const consoleWarnings = collectConsoleWarnings(page)

  await page.goto('/simulator2')
  await expect(page.getByRole('heading', { name: /Симулятор Боя/ })).toBeVisible()
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

  expect(network.hasChunk('pixi'), 'simulator2 replay timeline should use the Pixi default renderer').toBe(true)
  expect(consoleWarnings, 'console warnings').toEqual([])
  network.assertClean()
})

test('simulator2 replay shows high-signal primitive event labels', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 })
  const network = collectNetwork(page)
  const consoleWarnings = collectConsoleWarnings(page)

  await page.goto('/simulator2')
  await expect(page.getByRole('heading', { name: /Симулятор Боя/ })).toBeVisible()
  await loadReplayPreset(page, 'qa_primitive_events')
  await startSelectedSimulation(page)

  const canvas = page.locator('canvas').last()
  const timeline = page.getByTestId('replay-timeline')
  await expect(canvas).toBeVisible()
  await expect(timeline).toBeVisible()

  await page.getByRole('button', { name: /Пауза/ }).click()
  await expect(page.getByRole('button', { name: /Играть/ })).toBeVisible()

  await playEventTick(page, timeline, 0)
  await expect.poll(async () => {
    const pixels = await countPrimitiveLabelPixels(canvas)
    return pixels.controlPurple > 8 && pixels.eventCyan > 12
  }, { timeout: 5000 }).toBe(true)

  await playEventTick(page, timeline, 2)
  await expect.poll(async () => (await countPrimitiveLabelPixels(canvas)).eventCyan, { timeout: 5000 }).toBeGreaterThan(12)

  await playEventTick(page, timeline, 4)
  await expect.poll(async () => (await countPrimitiveLabelPixels(canvas)).yellowLabel, { timeout: 5000 }).toBeGreaterThan(8)

  await playEventTick(page, timeline, 8)
  await expect.poll(async () => (await countPrimitiveLabelPixels(canvas)).yellowLabel, { timeout: 5000 }).toBeGreaterThan(8)

  expect(network.hasChunk('pixi'), 'primitive event replay labels should use the Pixi default renderer').toBe(true)
  expect(consoleWarnings, 'console warnings').toEqual([])
  network.assertClean()
})

async function runReplayPreset(page: Page, preset: string): Promise<void> {
  await loadReplayPreset(page, preset)
  await startSelectedSimulation(page)

  const canvas = page.locator('canvas').last()
  await expect(canvas).toBeVisible()
  await page.waitForTimeout(900)
  await expectBattleReplayCanvasPainted(canvas)
  await expect(page.getByText(/Метрики \(Tick/)).toBeVisible()
  await expect(page.getByRole('button', { name: /Пауза|Играть/ })).toBeVisible()

  await page.getByRole('button', { name: /✕/ }).click()
  await expect(canvas).toBeHidden()
}

async function runDenseMovementVisualSmoke(page: Page, preset: string): Promise<void> {
  await loadReplayPreset(page, preset)
  await startSelectedSimulation(page)

  const canvas = page.locator('canvas').last()
  const timeline = page.getByTestId('replay-timeline')
  const tickReadout = page.getByTestId('replay-current-tick')
  await expect(canvas).toBeVisible()
  await expect(timeline).toBeVisible()

  const maxTick = Number(await timeline.getAttribute('max'))
  expect(maxTick, `${preset} timeline should expose dense replay ticks`).toBeGreaterThan(25)

  await page.getByRole('button', { name: /Пауза/ }).click()
  await expect(page.getByRole('button', { name: /Играть/ })).toBeVisible()
  await page.getByLabel(/Хитбоксы/).check()
  await page.getByLabel(/Векторы движения/).check()
  for (const check of getDenseMovementChecks(preset, maxTick)) {
    await setTimelineTick(timeline, check.tick)
    await expect(tickReadout).toContainText(`Tick ${check.tick} / ${maxTick}`)
    await page.waitForTimeout(120)
    await expectBattleReplayCanvasPainted(canvas, { requireFriendlyHp: false })
    const overlayPixels = await countOverlayPixels(canvas)
    expect(overlayPixels.hitboxCyan, `${preset} tick ${check.tick} should show hitbox overlays`).toBeGreaterThan(10)
    if (check.requireVelocity) {
      expect(overlayPixels.velocityYellow, `${preset} tick ${check.tick} should show movement vectors`).toBeGreaterThan(5)
    }

    const firstFrame = await canvas.screenshot()
    await page.waitForTimeout(180)
    const secondFrame = await canvas.screenshot()
    expect(await countChangedPixels(firstFrame, secondFrame), `${preset} tick ${check.tick} paused replay frame should not jitter`).toBeLessThan(20)
  }

  await page.getByRole('button', { name: /✕/ }).click()
  await expect(canvas).toBeHidden()
}

function getDenseMovementChecks(preset: string, maxTick: number): { tick: number; requireVelocity: boolean }[] {
  const checks = preset === 'marine_crowd_qa'
    ? [{ tick: 12, requireVelocity: true }, { tick: 45, requireVelocity: false }]
    : [{ tick: 20, requireVelocity: true }]
  const seen = new Set<number>()
  return checks
    .map(check => ({ ...check, tick: Math.min(maxTick - 5, check.tick) }))
    .filter(check => {
      if (check.tick <= 0 || seen.has(check.tick)) return false
      seen.add(check.tick)
      return true
    })
}

async function loadReplayPreset(page: Page, preset: string): Promise<void> {
  const presetSelect = page.locator('select').first()
  await presetSelect.selectOption(preset)
  await expect(presetSelect).toHaveValue(preset)
}

async function startSelectedSimulation(page: Page): Promise<void> {
  const startButton = page.getByRole('button', { name: /НАЧАТЬ СИМУЛЯЦИЮ/ })
  await expect(startButton).toBeEnabled()
  await startButton.click()
}

async function playEventTick(page: Page, timeline: Locator, tick: number): Promise<void> {
  const pauseButton = page.getByRole('button', { name: /Пауза/ })
  if (await pauseButton.isVisible()) await pauseButton.click()
  await expect(page.getByRole('button', { name: /Играть/ })).toBeVisible()
  await setTimelineTick(timeline, tick)
  await expect(timeline).toHaveValue(String(tick))
  await expect(page.getByRole('button', { name: /Играть/ })).toBeVisible()
  await page.getByRole('button', { name: /Играть/ }).click()
  await expect.poll(async () => Number(await timeline.inputValue())).toBeGreaterThan(tick)
  await page.getByRole('button', { name: /Пауза/ }).click()
  await expect(page.getByRole('button', { name: /Играть/ })).toBeVisible()
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
    const text = message.text()
    if (message.type() === 'warning' && !isBenignReplayBrowserWarning(text)) warnings.push(text)
  })
  return warnings
}

function isBenignReplayBrowserWarning(text: string): boolean {
  return text.includes('GL Driver Message') && text.includes('GPU stall due to ReadPixels')
}

async function expectBattleReplayCanvasPainted(canvas: Locator, options: { requireHp?: boolean; requireFriendlyHp?: boolean; requireEnemyHp?: boolean } = {}): Promise<void> {
  const buffer = await canvas.screenshot()
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  let friendlyHpPixels = 0
  let enemyHpPixels = 0

  for (let pixel = 0; pixel < info.width * info.height; pixel++) {
    const index = pixel * 4
    const red = data[index]
    const green = data[index + 1]
    const blue = data[index + 2]
    const alpha = data[index + 3]
    if (alpha < 180) continue
    if (green > 150 && red < 90 && blue < 140) friendlyHpPixels++
    if (red > 160 && green < 150 && blue < 150) enemyHpPixels++
  }

  if (options.requireHp === false) return
  expect(friendlyHpPixels + enemyHpPixels, 'replay canvas should contain visible HP bars').toBeGreaterThan(20)
  if (options.requireFriendlyHp !== false) {
    expect(friendlyHpPixels, 'replay canvas should contain green friendly HP bars').toBeGreaterThan(20)
  }
  if (options.requireEnemyHp !== false) {
    expect(enemyHpPixels, 'replay canvas should contain red enemy HP bars').toBeGreaterThan(20)
  }
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

async function countPrimitiveLabelPixels(canvas: Locator): Promise<{ controlPurple: number; eventCyan: number; yellowLabel: number }> {
  const buffer = await canvas.screenshot()
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  let controlPurple = 0
  let eventCyan = 0
  let yellowLabel = 0

  for (let pixel = 0; pixel < info.width * info.height; pixel++) {
    const index = pixel * 4
    const red = data[index]
    const green = data[index + 1]
    const blue = data[index + 2]
    const alpha = data[index + 3]
    if (alpha < 180) continue
    if (red > 125 && red < 220 && green > 80 && green < 185 && blue > 185) controlPurple++
    if (red < 95 && green > 160 && blue > 180) eventCyan++
    if (red > 210 && green > 165 && blue < 95) yellowLabel++
  }

  return { controlPurple, eventCyan, yellowLabel }
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
