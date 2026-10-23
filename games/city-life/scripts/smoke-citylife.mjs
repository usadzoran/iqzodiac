// End-to-end smoke test for the City Life exploration build (run `pnpm build` first).
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { chromium } from 'playwright'

const port = 4300 + Math.floor(Math.random() * 500)
const url = `http://127.0.0.1:${port}/`
const out = process.env.SHOTS_DIR ?? '/tmp/citylife-shots'
mkdirSync(out, { recursive: true })
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--port', String(port), '--strictPort', '--host', '127.0.0.1'], { stdio: 'ignore', detached: false })
let browser
const errors = []
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

async function stop() {
  try { server.kill('SIGTERM') } catch {}
  await browser?.close().catch(() => {})
}
async function waitForServer() {
  for (let i = 0; i < 80; i += 1) {
    try { if ((await fetch(url)).ok) return } catch {}
    await sleep(250)
  }
  throw new Error('City Life preview server did not start')
}
async function attachDiagnostics(page) {
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  page.on('pageerror', error => errors.push(String(error)))
  page.on('response', response => { if (response.status() >= 400) errors.push(`HTTP ${response.status()} ${response.url()}`) })
  await page.goto(url, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.city-interface .city-topbar', { timeout: 30000 })
  await page.waitForFunction(() => Boolean(window.__citylife?.game))
  await page.waitForTimeout(1000)
}

try {
  await waitForServer()
  browser = await chromium.launch({ args: ['--ignore-gpu-blocklist', '--no-sandbox'] }).catch(() => chromium.launch({ args: ['--no-sandbox'], executablePath: process.env.CHROMIUM_PATH ?? '/usr/bin/chromium' }))
  const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ar' })
  const page = await desktop.newPage()
  await attachDiagnostics(page)
  const language = await page.evaluate(() => ({ lang: document.documentElement.lang, dir: document.documentElement.dir }))
  if (language.lang !== 'ar' || language.dir !== 'rtl') throw new Error(`expected Arabic RTL, got ${JSON.stringify(language)}`)
  if (await page.locator('.city-location-row').count() !== 6) throw new Error('expected six city destinations in the directory')
  await page.screenshot({ path: `${out}/01-citylife-desktop.png` })

  const before = await page.evaluate(() => ({ x: window.__citylife.game.snapshot.x, z: window.__citylife.game.snapshot.z }))
  await page.keyboard.down('KeyW')
  await page.waitForTimeout(650)
  await page.keyboard.up('KeyW')
  const after = await page.evaluate(() => ({ x: window.__citylife.game.snapshot.x, z: window.__citylife.game.snapshot.z }))
  if (Math.hypot(after.x - before.x, after.z - before.z) < 2) throw new Error('WASD movement did not move the city exploration focus')

  await page.locator('#city-search').fill('مقهى')
  if (await page.locator('.city-location-row').count() !== 1) throw new Error('Arabic place search did not filter the directory')
  await page.locator('#city-search').fill('')
  await page.locator('.city-location-row[data-location="furniture"]').click()
  await page.locator('[data-action="navigate"]').click()
  const routeCount = await page.evaluate(() => window.__citylife.game.snapshot.route.length)
  if (routeCount < 2) throw new Error('selecting a destination did not draw a route')

  await page.evaluate(() => {
    const app = window.__citylife
    const location = app.game.locations.find(item => item.id === 'furniture')
    app.game.target.set(location.door.x, 0, location.door.z)
    app.game.selectLocation('furniture')
    app.game.setDestination('furniture')
    app.ui.update(app.game.snapshot)
  })
  await page.waitForSelector('[data-action="enter"]:not(.is-hidden)')
  await page.locator('[data-action="enter"]').click()
  const indoor = await page.evaluate(() => window.__citylife.game.snapshot.mode)
  if (indoor !== 'interior') throw new Error(`store visit failed; mode=${indoor}`)
  await page.screenshot({ path: `${out}/02-citylife-interior.png` })
  await page.locator('[data-action="exit"]').click()
  if (await page.evaluate(() => window.__citylife.game.snapshot.mode) !== 'city') throw new Error('exit button did not return to the city')
  await desktop.close()

  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'ar' })
  const phonePage = await phone.newPage()
  await attachDiagnostics(phonePage)
  const overflow = await phonePage.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)
  if (overflow) throw new Error('mobile layout has horizontal page overflow')
  const stick = await phonePage.locator('.city-stick').boundingBox()
  if (!stick) throw new Error('mobile movement control is missing')
  const beforeTouch = await phonePage.evaluate(() => ({ x: window.__citylife.game.snapshot.x, z: window.__citylife.game.snapshot.z }))
  await phonePage.mouse.move(stick.x + stick.width / 2, stick.y + stick.height / 2)
  await phonePage.mouse.down()
  await phonePage.mouse.move(stick.x + stick.width * .82, stick.y + stick.height / 2, { steps: 5 })
  await phonePage.waitForTimeout(500)
  await phonePage.mouse.up()
  const afterTouch = await phonePage.evaluate(() => ({ x: window.__citylife.game.snapshot.x, z: window.__citylife.game.snapshot.z }))
  if (Math.hypot(afterTouch.x - beforeTouch.x, afterTouch.z - beforeTouch.z) < .5) throw new Error('touch joystick did not move the exploration focus')
  await phonePage.screenshot({ path: `${out}/03-citylife-mobile.png` })
  await phone.close()

  if (errors.length) throw new Error(`browser errors:\n  ${errors.join('\n  ')}`)
  await stop()
  console.log(`smoke: OK — city navigation, Arabic search, route display, indoor visit, exit and mobile movement. Screenshots: ${out}`)
} catch (error) {
  console.error(`smoke: FAIL — ${error?.message ?? String(error)}`)
  await stop()
  process.exit(1)
}
