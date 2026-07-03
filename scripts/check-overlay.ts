import { chromium } from 'playwright'

async function run() {
  console.log('Launching browser...')
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()

  // Listen to console logs
  page.on('console', (msg) => {
    console.log(`[BROWSER CONSOLE] ${msg.type()}: ${msg.text()}`)
  })

  // Listen to network requests
  page.on('request', (req) => {
    if (req.url().includes('dirt_mask')) {
      console.log(`[NETWORK REQUEST] ${req.method()} ${req.url()}`)
    }
  })

  page.on('response', (res) => {
    if (res.url().includes('dirt_mask')) {
      console.log(`[NETWORK RESPONSE] ${res.status()} ${res.url()}`)
    }
  })

  console.log('Navigating to http://localhost:3000/ ...')
  try {
    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle', timeout: 15000 })
    console.log('Page loaded. Waiting 5s for PixiJS canvas to draw...')
    await page.waitForTimeout(5000)
    console.log('Finished waiting.')
  } catch (err: any) {
    console.error('Error loading page:', err.message)
  } finally {
    await browser.close()
    console.log('Browser closed.')
  }
}

run()
