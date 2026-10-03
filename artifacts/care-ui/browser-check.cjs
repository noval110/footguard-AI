const { chromium } = require('C:/Users/HYPE AMD/AppData/Local/ms-playwright-go/1.57.0/package')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const output = __dirname
const errors = []
let browser
let page

;(async () => {
  browser = await chromium.launch({ channel: 'msedge', headless: true })
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, timezoneId: 'Asia/Jakarta' })
  await context.addInitScript(() => localStorage.setItem('footguard_token', 'local-ui-fixture'))
  page = await context.newPage()
  page.on('console', message => { if (message.type() === 'error') console.log(message.text()) })
  page.on('pageerror', e => errors.push(e.message))
  let role = 'patient'
  let notices = [
    { id: 1, kind: 'appointment_confirmed', conversation_id: 1, examination_id: null, created_at: '2026-10-03T13:00:00Z', read_at: '2026-10-03T13:10:00Z' },
    { id: 2, kind: 'examination_reviewed', conversation_id: null, examination_id: 11, created_at: '2026-10-03T12:00:00Z', read_at: null },
    { id: 3, kind: 'examination_reviewed', conversation_id: null, examination_id: 12, created_at: '2026-10-03T11:00:00Z', read_at: null },
    { id: 4, kind: 'message', conversation_id: 1, examination_id: null, created_at: '2026-10-03T10:00:00Z', read_at: '2026-10-03T10:05:00Z' },
  ]
  const appointments = ['requested', 'confirmed', 'completed', 'cancelled'].map((status, index) => ({ id: index + 1, conversation_id: 1, scheduled_at: '2026-10-04T03:30:00Z', status, notes: index === 0 ? 'Diskusi hasil pemeriksaan dan perawatan kaki sehari-hari.' : '', patient_name: 'Nadia Putri', provider_name: 'Dr. Maya Sari', examination_id: 11 }))
  await page.route('**/api/**', async route => {
    const request = route.request()
    const url = new URL(request.url())
    if (!url.pathname.startsWith('/api/')) return route.continue()
    let data = null
    if (url.pathname === '/api/profile') data = { id: 100, name: role === 'patient' ? 'Nadia Putri' : 'Dr. Maya Sari', email: 'fixture@example.com', role }
    else if (url.pathname === '/api/appointments') data = appointments
    else if (url.pathname === '/api/notifications') data = notices
    else if (url.pathname === '/api/conversations') data = []
    else if (url.pathname === '/api/realtime/ticket') return route.fulfill({ status: 503, json: { success: false, message: 'UI fixture has no realtime server' } })
    else if (url.pathname.match(/^\/api\/notifications\/\d+\/read$/)) {
      const id = Number(url.pathname.split('/')[3])
      notices = notices.map(n => n.id === id ? { ...n, read_at: new Date().toISOString() } : n)
    } else if (url.pathname.match(/^\/api\/appointments\/\d+$/) && request.method() === 'PATCH') {
      data = appointments.find(a => a.id === Number(url.pathname.split('/')[3]))
      data.status = request.postDataJSON().status
    }
    return route.fulfill({ headers: { 'Access-Control-Allow-Origin': '*' }, json: { success: true, data } })
  })
  await page.goto('http://127.0.0.1:5188/patient/schedule')
  await page.locator('.appointment-card').first().waitFor()
  assert.equal(await page.locator('.appointment-card').count(), 4)
  assert.equal(await page.locator('.appointment-card--requested .appointment-time').innerText(), '10.30 WIB')
  assert.equal(await page.locator('.appointment-card--requested a').first().getAttribute('href'), '/patient/consultation?conversation=1')
  assert.equal(await page.locator('.appointment-card--requested a').nth(1).getAttribute('href'), '/patient/result/11')
  const toggle = page.getByRole('button', { name: /^Notifikasi/ })
  await toggle.click()
  await page.locator('.notification-popover').waitFor()
  assert.equal(await page.locator('.notification-new').count(), 2)
  assert.equal(await page.locator('.notification-item').nth(1).getAttribute('href'), '/patient/result/11')
  await page.screenshot({ path: path.join(output, 'desktop.png'), fullPage: true })
  await page.keyboard.press('Escape')
  assert.equal(await toggle.getAttribute('aria-expanded'), 'false')
  assert.equal(await toggle.evaluate(el => el === document.activeElement), true)
  await toggle.click()
  await page.getByRole('heading', { name: 'Jadwal Konsultasi', exact: true }).click()
  assert.equal(await page.locator('.notification-popover').count(), 0)
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 })
    await toggle.click()
    const sizes = await page.evaluate(() => {
      const panel = document.querySelector('.notification-popover').getBoundingClientRect()
      return { width: innerWidth, scroll: document.documentElement.scrollWidth, left: panel.left, right: panel.right }
    })
    assert.ok(sizes.scroll <= width + 1 && sizes.left >= 0 && sizes.right <= width, JSON.stringify(sizes))
    await page.screenshot({ path: path.join(output, `mobile-${width}.png`), fullPage: true })
    await page.getByRole('button', { name: 'Tutup notifikasi' }).click()
    for (const button of await page.locator('.appointment-card').first().locator('a, button').all()) {
      const bounds = await button.boundingBox()
      assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width + 1)
    }
  }
  await page.getByRole('button', { name: 'Batalkan', exact: true }).first().click()
  await page.locator('.appointment-card--cancelled').nth(1).waitFor()
  role = 'provider'
  await page.setViewportSize({ width: 1440, height: 1000 })
  appointments[0].status = 'requested'
  appointments[1].scheduled_at = new Date(Date.now() - 10 * 60000).toISOString()
  await page.goto('http://127.0.0.1:5188/provider/schedule')
  await page.getByRole('button', { name: 'Konfirmasi', exact: true }).waitFor()
  assert.equal(await page.locator('.appointment-participant strong').first().innerText(), 'Nadia Putri')
  assert.equal(await page.locator('.appointment-card--requested .appointment-status').innerText(), 'Menunggu konfirmasi')
  assert.equal(await page.locator('.appointment-card--requested .appointment-navigation a').nth(1).getAttribute('href'), '/provider/examinations/11')
  assert.equal(await page.getByRole('button', { name: 'Mulai panggilan', exact: true }).isDisabled(), true)
  await page.getByRole('button', { name: 'Tandai selesai', exact: true }).waitFor()
  await toggle.click()
  assert.equal(await page.locator('.notification-item').nth(1).getAttribute('href'), '/provider/examinations/11')
  await page.screenshot({ path: path.join(output, 'provider-desktop.png'), fullPage: true })
  await page.keyboard.press('Escape')
  assert.equal(await toggle.evaluate(el => el === document.activeElement), true)
  for (const width of [768, 390, 320]) {
    await page.setViewportSize({ width, height: 844 })
    await toggle.click()
    await page.screenshot({ path: path.join(output, `provider-${width}-notifications.png`), fullPage: true })
    const panel = await page.locator('.notification-popover').boundingBox()
    assert.ok(panel.x >= 0 && panel.x + panel.width <= width + 1)
    await page.getByRole('button', { name: 'Tutup notifikasi' }).click()
    await page.screenshot({ path: path.join(output, `provider-${width}-schedule.png`), fullPage: true })
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
    for (const button of await page.locator('.appointment-card').locator('a, button').all()) {
      const bounds = await button.boundingBox()
      assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width + 1)
    }
  }
  await page.setViewportSize({ width: 1440, height: 1000 })
  await toggle.click()
  await page.getByRole('heading', { name: 'Jadwal Konsultasi', exact: true }).click({ position: { x: 10, y: 10 } })
  assert.equal(await page.locator('.notification-popover').count(), 0)
  await toggle.click()
  await page.getByRole('button', { name: 'Tutup notifikasi' }).click()
  await page.getByRole('button', { name: 'Konfirmasi', exact: true }).click()
  await page.locator('.appointment-card--confirmed').nth(1).waitFor()
  await page.getByRole('button', { name: 'Tandai selesai', exact: true }).click()
  await page.locator('.appointment-card--completed').nth(1).waitFor()
  notices = []
  await page.reload()
  await toggle.click()
  await page.getByText('Belum ada notifikasi', { exact: true }).waitFor()
  notices = Array.from({ length: 25 }, (_, index) => ({ id: index + 1, kind: 'message', conversation_id: 1, examination_id: null, created_at: '2026-10-03T10:00:00Z', read_at: null }))
  await page.reload()
  await toggle.click()
  await page.locator('.notification-item').nth(24).waitFor()
  assert.ok(await page.locator('.notification-list').evaluate(el => el.scrollHeight > el.clientHeight))
  assert.deepEqual(errors, [])
  fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify({ success: true, checks: ['Patient desktop/mobile 390px/320px layouts', 'Provider desktop/tablet 768px/mobile 390px/320px layouts', 'Timezone and date', 'All four appointment statuses', 'Patient/provider destinations and actions', 'Provider confirmation, completion, and unavailable calling', 'Escape, outside click, close button and focus', 'Read/unread notification styling', 'Empty state and long-list scrolling', 'No browser runtime errors'] }, null, 2))
  console.log('PASS care UI: desktop, 390px, 320px, status actions, navigation, keyboard, empty and long notification lists')
})().catch(async error => { console.error(error); console.error(await page?.locator('body').innerText()); process.exitCode = 1 }).finally(async () => { await browser?.close() })
