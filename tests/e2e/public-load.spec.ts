import { expect, test } from '@playwright/test'

function isSupabaseRest(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.host.endsWith('.supabase.co') && parsed.pathname.startsWith('/rest/v1')
  } catch {
    return false
  }
}

test('public auth shell is server-rendered without client JavaScript', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()

  await page.goto(baseURL ?? '/')

  await expect(page.getByTestId('public-auth-shell')).toBeVisible()
  await expect(page.getByText('Добро пожаловать в Mars2050!')).toBeVisible()
  await expect(page.getByTestId('public-auth-login')).toBeVisible()
  await expect(page.getByTestId('public-auth-register')).toBeVisible()

  await context.close()
})

test('public auth shell appears before Supabase REST work starts', async ({ page }) => {
  const requestsBeforeShell: string[] = []
  let shellVisible = false

  page.on('request', request => {
    if (!shellVisible) requestsBeforeShell.push(request.url())
  })

  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await expect(page.getByTestId('public-auth-shell')).toBeVisible({ timeout: 1500 })
  shellVisible = true

  expect(requestsBeforeShell.filter(isSupabaseRest)).toEqual([])
})
