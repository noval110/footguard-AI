// Browser-only API fixtures; all API requests are intercepted, including writes.
const { chromium } = require('C:/Users/HYPE AMD/AppData/Local/ms-playwright-go/1.57.0/package')
const assert = require('node:assert/strict')
const now = new Date().toISOString()
const examination = { id: 20, patient_id: 1, assessment_id: null, status: 'pending', examined_at: now, created_at: now, completed_at: null }
const detail = { examination, patient: { id: 1, user_id: 1 }, assessment: null, ai_results: [], risk_result: null, medical_review: null,
  foot_images: [{ id: 1, examination_id: 20, image_url: '/api/uploads/original/missing.jpg', foot_side: 'foot', image_type: 'photo', quality_status: 'good', created_at: now }] }
;(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
    await context.addInitScript(() => localStorage.setItem('footguard_token', 'browser-fixture-only'))
    await context.route(/^http:\/\/(?:localhost|127\.0\.0\.1):8080\/api\//, async route => {
      const path = new URL(route.request().url()).pathname
      const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Authorization, Content-Type, Accept', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' }
      if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers })
      if (path.startsWith('/api/uploads/')) return route.fulfill({ status: 404, headers, json: { success: false, message: 'Gambar tidak ditemukan' } })
      if (path.endsWith('/analyze')) return route.fulfill({ status: 502, headers, json: { success: false, message: 'AI service tidak dapat dihubungi' } })
      if (path === '/api/realtime/ticket') return route.fulfill({ status: 503, headers, json: { success: false, message: 'Test realtime disabled' } })
      const data = path === '/api/profile' ? { id: 1, name: 'Browser Fixture', email: 'fixture@example.invalid', role: 'patient', is_active: true, created_at: now }
        : path === '/api/examinations/20' ? detail : []
      return route.fulfill({ status: 200, headers, json: { success: true, data } })
    })
    const page = await context.newPage()
    page.setDefaultTimeout(10000)
    const errors = []
    page.on('console', message => { if (message.type() === 'error') console.log('Browser console:', message.text()) })
    page.on('pageerror', error => errors.push(error.message))
    await page.goto('http://127.0.0.1:5179/patient/scan?examination=20')
    await page.getByText('Foto tidak tersedia. File mungkin belum tersimpan di server ini.', { exact: true }).waitFor().catch(async error => {
      console.log('Fixture page:', (await page.locator('body').innerText()).slice(0, 2000))
      console.log('Page errors:', errors)
      throw error
    })
    assert.equal(await page.getByText('Memuat gambar...', { exact: true }).count(), 0)
    console.log('PASS missing uploaded image displays an unavailable state')
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWLsAAAAASUVORK5CYII=', 'base64')
    await page.getByLabel('Pilih foto kaki').setInputFiles({ name: 'fixture.png', mimeType: 'image/png', buffer: png })
    await page.getByRole('button', { name: 'Analisis dengan AI', exact: true }).click()
    await page.getByRole('alert').filter({ hasText: 'Layanan analisis AI tidak dapat dihubungi atau gagal memproses foto.' }).waitFor()
    console.log('PASS saved-examination analysis displays a specific AI failure')
    assert.deepEqual(errors, [])
    console.log('PASS no browser page errors')
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })
