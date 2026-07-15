import { expect, type Locator, type Page } from '@playwright/test'
import sharp from 'sharp'

export async function loadReplayPreset(page: Page, preset: string): Promise<void> {
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

export async function startSelectedSimulation(page: Page): Promise<void> {
  const startButton = page.getByRole('button', { name: /НАЧАТЬ СИМУЛЯЦИЮ/ })
  await expect(startButton).toBeEnabled()
  await startButton.click()
}

export function collectConsoleWarnings(page: Page): string[] {
  const warnings: string[] = []
  page.on('console', message => {
    const text = message.text()
    if (message.type() === 'warning' && !isBenignReplayBrowserWarning(text)) warnings.push(text)
  })
  return warnings
}

export async function expectBattleReplayCanvasPainted(
  canvas: Locator,
  options: { requireEnemyHp?: boolean } = {},
): Promise<void> {
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

  expect(friendlyHpPixels, 'replay canvas should contain green friendly HP bars').toBeGreaterThan(20)
  if (options.requireEnemyHp !== false) {
    expect(enemyHpPixels, 'replay canvas should contain red enemy HP bars').toBeGreaterThan(20)
  }
}

function isBenignReplayBrowserWarning(text: string): boolean {
  return text.includes('GL Driver Message') && text.includes('GPU stall due to ReadPixels')
}
