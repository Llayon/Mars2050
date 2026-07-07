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
