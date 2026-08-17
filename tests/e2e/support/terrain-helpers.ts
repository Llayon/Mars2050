import { expect, type Locator, type Page } from '@playwright/test'
import { expectCanvasPainted, resetE2eSession, waitForColony } from './smoke-helpers'

export interface MarsMapDiagnostics {
  lightingMode: 'baked' | 'enhanced'
  debugMode: 'off' | 'normal' | 'data'
  lightingAvailable: boolean
  rendererResolution: number
  rendererType: string
  atlasPages: number
  groundDecals: number
  macroCount: number
  scatterCount: number
}

export interface OpenMapOptions {
  lightingMode?: 'baked' | 'enhanced'
  debugMode?: 'off' | 'normal' | 'data'
  isMobile?: boolean
}

/**
 * Reads the gated window.__MARS_MAP_DIAGNOSTICS__ object from the browser context.
 */
export async function getTerrainDiagnostics(page: Page): Promise<MarsMapDiagnostics | null> {
  return page.evaluate(() => {
    const raw = (window as unknown as { __MARS_MAP_DIAGNOSTICS__?: MarsMapDiagnostics }).__MARS_MAP_DIAGNOSTICS__
    return raw || null
  })
}

/**
 * Resets E2E session, opens the canonical Mars Map screen with query parameters,
 * and waits for the WebGL canvas to paint.
 */
export async function openCanonicalMapScreen(
  page: Page,
  options: OpenMapOptions = {}
): Promise<{ canvasHost: Locator; canvas: Locator }> {
  const { lightingMode, debugMode, isMobile = false } = options

  const searchParams = new URLSearchParams()
  if (lightingMode) searchParams.set('terrainLighting', lightingMode)
  if (debugMode) searchParams.set('terrainDebug', debugMode)

  const url = searchParams.toString() ? `/?${searchParams.toString()}` : '/'
  await page.goto(url)
  await waitForColony(page, isMobile ? 'mobile' : 'desktop')

  if (isMobile) {
    await page.getByTestId('bottom-nav-map').click()
  } else {
    await page.getByTestId('command-dock-map').click()
  }

  const canvasHost = page.getByTestId('mars-map-canvas-host')
  await expect(canvasHost).toBeVisible({ timeout: 30_000 })

  const canvas = canvasHost.locator('canvas').last()
  await expect(canvas).toBeVisible({ timeout: 30_000 })
  await expectCanvasPainted(canvas)

  // Wait for diagnostics to be registered
  await expect.poll(async () => {
    const diag = await getTerrainDiagnostics(page)
    return !!diag
  }, { timeout: 30_000 }).toBe(true)

  return { canvasHost, canvas }
}
