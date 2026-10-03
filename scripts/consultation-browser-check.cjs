// Run only against the isolated local test services; never point this fixture script at production.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/HYPE AMD/AppData/Local/ms-playwright-go/1.57.0/package')
const { execFileSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')
const assert = require('node:assert/strict')
const api = 'http://127.0.0.1:8099'
const site = 'http://127.0.0.1:5179'
const output = path.resolve(__dirname, '../artifacts/consultation-browser')
fs.mkdirSync(output, { recursive: true })
const password = 'LocalTestOnly123!'
const suffix = Date.now()
const sql = statement => execFileSync('C:/Program Files/PostgreSQL/18/bin/psql.exe', ['-h', '127.0.0.1', '-p', '55439', '-U', 'footguard_test', '-d', 'footguard_consultation_test', '-v', 'ON_ERROR_STOP=1', '-At', '-c', statement], { encoding: 'utf8' }).trim()
async function request(method, route, body, token) {
  const res = await fetch(api + route, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) })
  const json = await res.json()
  if (!res.ok || !json.success) throw new Error(`${method} ${route}: ${res.status} ${json.message}`)
  return json.data
}
const checks = []
const errors = []
let browser
const fixtures = []
async function check(name, action) { await action(); checks.push(name); console.log(`PASS ${name}`) }
async function login(page, email, provider = false) {
  await page.goto(site + '/login')
  if (provider) await page.getByRole('button', { name: 'Tenaga kesehatan', exact: false }).click()
  await page.getByLabel('Alamat email').fill(email)
  await page.getByLabel('Kata sandi', { exact: true }).fill(password)
  await page.getByRole('button', { name: provider ? 'Masuk sebagai Tenaga Kesehatan' : 'Masuk sebagai Pasien' }).click()
  await page.waitForURL(`**/${provider ? 'provider' : 'patient'}/dashboard`)
  await page.getByRole('main').waitFor()
}
async function noOverflow(page) {
  const dimensions = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }))
  assert.ok(dimensions.scroll <= dimensions.width + 1, JSON.stringify(dimensions))
}
async function receivedAudio(page) {
  await page.waitForFunction(async () => {
    for (const pc of window.__pcs) {
      if (pc.connectionState !== 'connected') continue
      const stats = await pc.getStats()
      for (const entry of stats.values()) if (entry.type === 'inbound-rtp' && entry.kind === 'audio' && entry.bytesReceived > 0) return true
    }
    return false
  }, null, { timeout: 30000 })
}

;(async () => {
  const patient = await request('POST', '/api/auth/register', { name: 'Browser Patient', email: `browser-patient-${suffix}@example.com`, password }); fixtures.push(patient.user.id)
  const doctorAccount = await request('POST', '/api/auth/register', { name: 'Browser Provider', email: `browser-provider-${suffix}@example.com`, password }); fixtures.push(doctorAccount.user.id)
  sql(`DELETE FROM patients WHERE user_id=${doctorAccount.user.id}; UPDATE users SET role='provider' WHERE id=${doctorAccount.user.id};`)
  const doctor = await request('POST', '/api/auth/login', { email: doctorAccount.user.email, password })
  const patientProfile = await request('GET', '/api/patients/me', null, patient.token)
  const assessment = await request('POST', '/api/assessments', { has_lops: false, has_pad: false, foot_deformity: false, previous_ulcer: false, previous_amputation: false, kidney_failure: false }, patient.token)
  const examinations = []
  for (const risk of ['low', 'moderate']) {
    const exam = await request('POST', '/api/examinations', { assessment_id: assessment.id }, patient.token)
    examinations.push(exam)
    await request('POST', `/api/examinations/${exam.id}/risk-result`, { risk_category: risk, explanation: 'Local test fixture: provider-assigned risk.' }, doctor.token)
  }
  const conversation = await request('POST', '/api/conversations', { provider_id: doctor.user.id, examination_id: examinations[1].id }, patient.token)
  browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required'] })
  const patientContext = await browser.newContext({ viewport: { width: 390, height: 844 }, permissions: ['microphone'] })
  const providerContext = await browser.newContext({ viewport: { width: 1440, height: 1000 }, permissions: ['microphone'] })
  for (const context of [patientContext, providerContext]) await context.addInitScript(() => {
    const Native = window.RTCPeerConnection
    window.__pcs = []
    window.RTCPeerConnection = class extends Native { constructor(...args) { super(...args); window.__pcs.push(this) } }
    const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices)
    window.__originalMedia = original
    window.__mediaRequests = []
    navigator.mediaDevices.getUserMedia = constraints => { window.__mediaRequests.push(constraints); return original(constraints) }
  })
  const p = await patientContext.newPage()
  const d = await providerContext.newPage()
  for (const page of [p, d]) page.on('pageerror', err => errors.push(err.message))
  await check('Patient and provider password login', async () => { await login(p, patient.user.email); await login(d, doctor.user.email, true) })
  await check('Progress timeline and comparison at 360/390/768/1440px', async () => {
    await p.goto(site + '/patient/progress')
    await p.getByRole('heading', { name: 'Perkembangan Kondisi Kaki', exact: true }).waitFor()
    await p.getByRole('button', { name: 'Bandingkan dengan sebelumnya' }).last().click()
    await p.getByRole('heading', { name: 'Pemeriksaan sebelumnya', exact: true }).waitFor()
    for (const width of [360, 390, 768, 1440]) { await p.setViewportSize({ width, height: 900 }); await noOverflow(p) }
    await p.setViewportSize({ width: 390, height: 844 })
    await p.screenshot({ path: path.join(output, 'patient-progress-mobile.png'), fullPage: true })
  })
  await check('Provider queue includes older examinations and review fields', async () => {
    await d.goto(site + '/provider/review-queue')
    await d.getByRole('heading', { name: 'Antrean Review', exact: true }).waitFor()
    await d.getByText(`#${examinations[0].id} ·`, { exact: false }).waitFor()
    await d.goto(site + `/provider/examinations/${examinations[0].id}`)
    await d.getByLabel('Catatan klinis').fill('Local browser review note')
    await d.getByLabel('Kesimpulan review').fill('Provider-written conclusion')
    await d.getByLabel('Rekomendasi tindak lanjut').fill('Discuss at consultation')
    await d.getByLabel('Status review').selectOption('needs_followup')
    await d.getByRole('button', { name: 'Simpan Review' }).click()
    await d.getByText('Perlu tindak lanjut', { exact: true }).first().waitFor()
    await d.goto(site + `/provider/patients/${patientProfile.id}/progress`)
    await d.getByRole('heading', { name: 'Perkembangan Kondisi Kaki', exact: true }).waitFor()
  })
  await p.goto(site + `/patient/consultation?conversation=${conversation.id}`)
  await d.goto(site + `/provider/consultation?conversation=${conversation.id}`)
  await check('Persistent realtime chat, plain text, and unread/read states', async () => {
    await p.getByLabel('Tulis pesan konsultasi').fill('<b>Plain text browser message</b>')
    await p.getByRole('button', { name: 'Kirim', exact: true }).click()
    await d.getByText('<b>Plain text browser message</b>', { exact: true }).waitFor()
    assert.equal(await d.locator('.message-content b').count(), 0)
    await d.bringToFront()
    await d.reload()
    await d.getByText('<b>Plain text browser message</b>', { exact: true }).waitFor()
    await p.getByText('Dibaca', { exact: false }).waitFor()
    await d.getByLabel('Tulis pesan konsultasi').fill('Provider reply')
    await d.getByRole('button', { name: 'Kirim', exact: true }).click()
    await p.locator('.message-list').getByText('Provider reply', { exact: true }).waitFor()
    await p.screenshot({ path: path.join(output, 'patient-chat-mobile.png'), fullPage: true })
    await noOverflow(p)
  })
  await check('Request and confirm appointment from participant UIs', async () => {
    await p.getByRole('button', { name: 'Jadwalkan konsultasi', exact: true }).click()
    const schedule = new Date(Date.now() + 2 * 86400000)
    const local = new Date(schedule.getTime() - schedule.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
    await p.getByLabel('Tanggal dan waktu').fill(local)
    await p.getByLabel('Catatan (opsional)').fill('Browser appointment')
    await p.getByRole('button', { name: 'Minta jadwal', exact: true }).click()
    await d.getByRole('button', { name: 'Konfirmasi', exact: true }).click()
    await p.getByText('Dikonfirmasi', { exact: true }).waitFor()
    await p.getByRole('button', { name: 'Batalkan', exact: true }).click()
    await d.getByText('Dibatalkan', { exact: true }).waitFor()
  })
  await check('WebRTC incoming call, accept, bidirectional audio, mute, hang up', async () => {
    await p.getByRole('button', { name: 'Panggilan suara', exact: true }).waitFor({ state: 'visible' })
    await p.waitForFunction(() => ![...document.querySelectorAll('button')].find(b => b.textContent === 'Panggilan suara')?.disabled)
    await p.getByRole('button', { name: 'Panggilan suara', exact: true }).click()
    await d.getByRole('heading', { name: 'Panggilan konsultasi masuk', exact: true }).waitFor()
    await d.bringToFront()
    await d.getByRole('button', { name: 'Terima', exact: true }).focus()
    await d.keyboard.press('Shift+Tab')
    assert.equal(await d.evaluate(() => document.activeElement.textContent), 'Tolak')
    await d.keyboard.press('Tab')
    assert.equal(await d.evaluate(() => document.activeElement.textContent), 'Terima')
    await d.getByRole('button', { name: 'Terima', exact: true }).click()
    await p.getByRole('heading', { name: 'Panggilan tersambung', exact: true }).waitFor()
    await d.getByRole('heading', { name: 'Panggilan tersambung', exact: true }).waitFor()
    await receivedAudio(p); await receivedAudio(d)
    assert.ok((await p.evaluate(() => window.__mediaRequests)).every(c => c.audio === true && c.video === false))
    assert.ok((await d.evaluate(() => window.__mediaRequests)).every(c => c.audio === true && c.video === false))
    await p.getByRole('button', { name: 'Mute mikrofon', exact: true }).click()
    assert.equal(await p.evaluate(() => window.__pcs.at(-1).getSenders().find(s => s.track?.kind === 'audio').track.enabled), false)
    await p.screenshot({ path: path.join(output, 'patient-audio-call-mobile.png'), fullPage: true })
    await noOverflow(p)
    await p.getByRole('button', { name: 'Akhiri panggilan', exact: true }).click()
    await d.getByRole('heading', { name: 'Panggilan berakhir', exact: true }).waitFor()
    assert.ok(await p.evaluate(() => window.__pcs.every(pc => pc.connectionState === 'closed')))
    const calls = await request('GET', `/api/conversations/${conversation.id}/calls`, null, patient.token)
    assert.equal(calls[0].status, 'ended'); assert.ok(calls[0].started_at); assert.ok(calls[0].ended_at)
    await p.getByRole('button', { name: 'Tutup', exact: true }).click(); await d.getByRole('button', { name: 'Tutup', exact: true }).click()
  })
  await check('Incoming call rejection', async () => {
    await d.getByRole('button', { name: 'Panggilan suara', exact: true }).click()
    await p.getByRole('button', { name: 'Tolak', exact: true }).click()
    await d.getByText('Panggilan ditolak.', { exact: true }).waitFor()
    await p.getByRole('button', { name: 'Tutup', exact: true }).click(); await d.getByRole('button', { name: 'Tutup', exact: true }).click()
  })
  await check('Simulated microphone permission denial', async () => {
    await p.evaluate(() => { navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('Denied', 'NotAllowedError')) })
    await p.getByRole('button', { name: 'Panggilan suara', exact: true }).click()
    await p.getByText('Izin mikrofon diperlukan untuk panggilan suara.', { exact: true }).waitFor()
    await p.getByRole('button', { name: 'Tutup', exact: true }).click()
  })
  await check('Simulated missing microphone', async () => {
    await p.evaluate(() => { navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('Missing', 'NotFoundError')) })
    await p.getByRole('button', { name: 'Panggilan suara', exact: true }).click()
    await p.getByText('Mikrofon tidak ditemukan.', { exact: true }).waitFor()
    await p.getByRole('button', { name: 'Tutup', exact: true }).click()
    await p.evaluate(() => { navigator.mediaDevices.getUserMedia = window.__originalMedia })
  })
  await check('Accepting in another provider tab keeps the connected call active', async () => {
    const extra = await providerContext.newPage()
    await extra.goto(site + `/provider/consultation?conversation=${conversation.id}`)
    await extra.getByLabel('Tulis pesan konsultasi').waitFor()
    await extra.waitForFunction(() => ![...document.querySelectorAll('button')].find(b => b.textContent === 'Panggilan suara')?.disabled)
    await p.getByRole('button', { name: 'Panggilan suara', exact: true }).click()
    await d.getByRole('button', { name: 'Terima', exact: true }).waitFor()
    await extra.getByRole('button', { name: 'Terima', exact: true }).waitFor()
    await d.getByRole('button', { name: 'Terima', exact: true }).click()
    await p.getByRole('heading', { name: 'Panggilan tersambung', exact: true }).waitFor()
    await extra.getByText('Panggilan sudah diterima pada sesi lain.', { exact: true }).waitFor()
    await receivedAudio(p)
    await extra.close()
    await p.getByRole('button', { name: 'Akhiri panggilan', exact: true }).click()
    await d.getByRole('heading', { name: 'Panggilan berakhir', exact: true }).waitFor()
    await p.getByRole('button', { name: 'Tutup', exact: true }).click(); await d.getByRole('button', { name: 'Tutup', exact: true }).click()
  })
  await check('Mobile consultation list, composer, appointment layout and call keyboard focus', async () => {
    for (const width of [360, 390, 768, 1440]) { await p.setViewportSize({ width, height: 900 }); await noOverflow(p) }
    await p.setViewportSize({ width: 360, height: 800 })
    await p.getByRole('button', { name: 'Kembali ke percakapan', exact: true }).click()
    await p.getByRole('button', { name: /Browser Provider.*Provider reply/ }).waitFor()
    await p.screenshot({ path: path.join(output, 'patient-conversation-list-mobile.png'), fullPage: true })
    await d.goto(site + '/provider/schedule'); await d.getByRole('heading', { name: 'Jadwal Konsultasi', exact: true }).first().waitFor()
    await d.setViewportSize({ width: 360, height: 800 }); await noOverflow(d)
  })
  assert.deepEqual(errors, [])
  fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify({ checks, runtimeErrors: errors, media: 'Edge headless with simulated microphone devices; bidirectional RTP bytes verified', production: false }, null, 2))
})().catch(error => { console.error(error.stack); process.exitCode = 1 }).finally(async () => {
  if (browser) await browser.close()
  const ids = fixtures.join(',')
  if (ids) sql(`DELETE FROM realtime_events WHERE user_id IN (${ids}); DELETE FROM realtime_tickets WHERE user_id IN (${ids}); DELETE FROM notifications WHERE user_id IN (${ids}); DELETE FROM call_sessions WHERE conversation_id IN (SELECT id FROM conversations WHERE provider_id IN (${ids})); DELETE FROM appointments WHERE conversation_id IN (SELECT id FROM conversations WHERE provider_id IN (${ids})); DELETE FROM messages WHERE conversation_id IN (SELECT id FROM conversations WHERE provider_id IN (${ids})); DELETE FROM conversations WHERE provider_id IN (${ids}); DELETE FROM medical_reviews WHERE reviewer_id IN (${ids}); DELETE FROM users WHERE id IN (${ids});`)
})
