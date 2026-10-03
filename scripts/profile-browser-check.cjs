// Local-only regression checks against the isolated existing test database.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/HYPE AMD/AppData/Local/ms-playwright-go/1.57.0/package')
const { execFileSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')
const assert = require('node:assert/strict')
const api = 'http://127.0.0.1:8098'
const site = 'http://127.0.0.1:5187'
const output = path.resolve(__dirname, '../artifacts/profile-browser')
const password = 'LocalProfileTest123!'
const suffix = Date.now()
const fixtures = []
const checks = []
const pageErrors = []
let browser
const sql = statement => execFileSync('C:/Program Files/PostgreSQL/18/bin/psql.exe', ['-h', '127.0.0.1', '-p', '55439', '-U', 'footguard_test', '-d', 'footguard_consultation_test', '-v', 'ON_ERROR_STOP=1', '-At', '-c', statement], { encoding: 'utf8' }).trim()
async function request(method, route, body, token) {
  const res = await fetch(api + route, { method, headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) })
  const json = await res.json()
  assert.ok(res.ok && json.success, `${method} ${route}: ${res.status} ${json.message}`)
  return json.data
}
async function upload(bytes, type, token, expected = 200) {
  const form = new FormData()
  form.append('photo', new Blob([bytes], { type }), 'arbitrary-name.png')
  const res = await fetch(api + '/api/profile/photo', { method: 'PUT', headers: { Authorization: `Bearer ${token}` }, body: form })
  assert.equal(res.status, expected, await res.clone().text())
  return res.json()
}
async function check(name, action) { await action(); checks.push(name); console.log(`PASS ${name}`) }
async function login(page, account, provider) {
  await page.goto(site + '/login')
  await page.getByRole('group', { name: 'Pilih jenis akun' }).getByRole('button', { name: provider ? 'Tenaga kesehatan' : 'Pasien', exact: false }).click()
  await page.getByLabel('Alamat email').fill(account.user.email)
  await page.getByLabel('Kata sandi', { exact: true }).fill(password)
  await page.getByRole('button', { name: provider ? 'Masuk sebagai Tenaga Kesehatan' : 'Masuk sebagai Pasien' }).click()
  await page.waitForURL(`**/${provider ? 'provider' : 'patient'}/dashboard`)
}
async function avatarsReady(page, count = 3) {
  await page.waitForFunction(n => {
    const images = [...document.querySelectorAll('.user-avatar img')]
    return images.length === n && images.every(img => img.complete && img.naturalWidth > 0)
  }, count)
}
async function noOverflow(page) {
  const sizes = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }))
  assert.ok(sizes.scroll <= sizes.width + 1, JSON.stringify(sizes))
}

;(async () => {
  assert.equal(sql('SELECT current_database()'), 'footguard_consultation_test')
  fs.mkdirSync(output, { recursive: true })
  const patient = await request('POST', '/api/auth/register', { name: 'Nadia Putri', email: `profile-patient-${suffix}@example.com`, password })
  fixtures.push(patient)
  const providerRegistration = await request('POST', '/api/auth/register', { name: 'Dr. Maya Sari', email: `profile-provider-${suffix}@example.com`, password })
  fixtures.push(providerRegistration)
  sql(`DELETE FROM patients WHERE user_id=${providerRegistration.user.id}; UPDATE users SET role='provider' WHERE id=${providerRegistration.user.id};`)
  const provider = await request('POST', '/api/auth/login', { email: providerRegistration.user.email, password })
  fixtures[1] = provider
  browser = await chromium.launch({ channel: 'msedge', headless: true })
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  const page = await context.newPage()
  page.on('pageerror', error => pageErrors.push(error.message))
  await page.goto(site + '/login')
  const imageData = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 240; canvas.height = 240
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#f4d9e2'; ctx.fillRect(0, 0, 240, 240)
    ctx.fillStyle = '#87384f'; ctx.beginPath(); ctx.arc(120, 84, 42, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath(); ctx.ellipse(120, 220, 86, 76, 0, 0, Math.PI * 2); ctx.fill()
    return { png: canvas.toDataURL('image/png'), jpg: canvas.toDataURL('image/jpeg'), webp: canvas.toDataURL('image/webp') }
  })
  const bytes = type => Buffer.from(imageData[type].split(',')[1], 'base64')

  await check('JWT is required for every photo endpoint', async () => {
    for (const method of ['GET', 'PUT', 'DELETE']) assert.equal((await fetch(api + '/api/profile/photo', { method })).status, 401)
    assert.equal((await fetch(api + '/api/profile/photo', { headers: { Authorization: 'Bearer invalid' } })).status, 401)
  })
  await check('Backend accepts JPEG/PNG and rejects invalid/WebP/oversized images', async () => {
    await upload(bytes('png'), 'image/png', patient.token)
    await upload(bytes('jpg'), 'image/jpeg', patient.token)
    await upload(bytes('webp'), 'image/webp', patient.token, 400)
    await upload(Buffer.from('<svg><script>alert(1)</script></svg>'), 'image/png', patient.token, 400)
    await upload(Buffer.alloc(5 * 1024 * 1024 + 1), 'image/jpeg', patient.token, 413)
    await request('DELETE', '/api/profile/photo', null, patient.token)
  })

  for (const [role, account] of [['patient', patient], ['provider', provider]]) {
    const isProvider = role === 'provider'
    await check(`${role}: email/password login and empty-avatar fallback`, async () => {
      await login(page, account, isProvider)
      await page.goto(`${site}/${role}/profile`)
      await page.getByRole('heading', { name: 'Profil Saya', exact: true }).waitFor()
      await page.getByRole('button', { name: 'Unggah foto', exact: true }).waitFor()
      assert.equal(await page.locator('.user-avatar img').count(), 0)
      assert.equal(await page.locator('.profile-photo-avatar').innerText(), isProvider ? 'DM' : 'NP')
      assert.equal(await page.locator('.fresh-topbar-link').getAttribute('href'), `/${role}/profile`)
    })
    await check(`${role}: file validation before upload`, async () => {
      const input = page.getByLabel('Unggah foto profil', { exact: true })
      await input.setInputFiles({ name: 'bad.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg/>') })
      await page.getByRole('alert').filter({ hasText: 'Gunakan foto JPG atau PNG' }).waitFor()
      await input.setInputFiles({ name: 'large.png', mimeType: 'image/png', buffer: Buffer.alloc(5 * 1024 * 1024 + 1) })
      await page.getByRole('alert').filter({ hasText: 'maksimal 5 MB' }).waitFor()
      await input.setInputFiles({ name: 'broken.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('broken jpeg') })
      await page.getByRole('alert').filter({ hasText: 'Foto tidak dapat dibaca' }).waitFor()
    })
    await check(`${role}: preview, cancel, and save with immediate sidebar/header update`, async () => {
      const input = page.getByLabel('Unggah foto profil', { exact: true })
      await input.setInputFiles({ name: 'selfie.png', mimeType: 'image/png', buffer: bytes('png') })
      await page.getByRole('button', { name: 'Simpan foto', exact: true }).waitFor()
      assert.equal((await request('GET', '/api/profile', null, account.token)).avatar_url, undefined)
      assert.equal(await page.locator('.user-avatar img').count(), 1)
      await page.getByRole('button', { name: 'Batal', exact: true }).click()
      assert.equal(await page.locator('.user-avatar img').count(), 0)
      await input.setInputFiles({ name: 'selfie.jpg', mimeType: 'image/jpeg', buffer: bytes('jpg') })
      await page.getByRole('button', { name: 'Simpan foto', exact: true }).click()
      await page.getByRole('status').filter({ hasText: 'Foto profil berhasil disimpan.' }).waitFor()
      await avatarsReady(page)
      assert.ok((await request('GET', '/api/profile', null, account.token)).avatar_url)
    })
    await check(`${role}: upload failure retains preview and existing photo, retry works`, async () => {
      const previous = (await request('GET', '/api/profile', null, account.token)).avatar_url
      await page.getByLabel('Unggah foto profil', { exact: true }).setInputFiles({ name: 'replace.png', mimeType: 'image/png', buffer: bytes('png') })
      let intercept = true
      let releaseFailure
      const failureGate = new Promise(resolve => { releaseFailure = resolve })
      const failOnce = async route => {
        if (route.request().method() === 'PUT' && intercept) { intercept = false; await failureGate; await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ success: false, message: 'Local error test' }) }) }
        else await route.continue()
      }
      await page.route('**/api/profile/photo', failOnce)
      await page.getByRole('button', { name: 'Simpan foto', exact: true }).click()
      assert.ok(await page.getByRole('button', { name: 'Memproses...', exact: true }).isDisabled())
      releaseFailure()
      await page.getByRole('alert').filter({ hasText: 'Layanan belum siap' }).waitFor()
      assert.equal((await request('GET', '/api/profile', null, account.token)).avatar_url, previous)
      await page.getByRole('button', { name: 'Simpan foto', exact: true }).click()
      await page.getByRole('status').filter({ hasText: 'Foto profil berhasil disimpan.' }).waitFor()
      await avatarsReady(page)
      await page.unroute('**/api/profile/photo', failOnce)
      assert.notEqual((await request('GET', '/api/profile', null, account.token)).avatar_url, previous)
    })
    if (!isProvider) await check('patient: profile data editing and completion are preserved', async () => {
      assert.equal(await page.getByLabel('Jenis kelamin').inputValue(), '')
      assert.equal(await page.getByLabel('Tipe diabetes').inputValue(), '')
      await page.getByLabel('Tanggal lahir').fill('1988-04-20')
      await page.getByLabel('Jenis kelamin').selectOption('female')
      await page.getByLabel('Telepon', { exact: true }).fill('081234567890')
      await page.getByLabel('Alamat', { exact: true }).fill('Jl. Melati 12, Jakarta')
      await page.getByLabel('Tipe diabetes').selectOption('type2')
      await page.getByLabel('Tahun diagnosis').fill('2020')
      await page.getByRole('button', { name: 'Simpan Perubahan', exact: true }).click()
      await page.getByRole('status').filter({ hasText: /^Profil berhasil disimpan\.$/ }).waitFor()
      await page.getByText('4/4 data utama', { exact: true }).waitFor()
      assert.equal((await request('GET', '/api/patients/me', null, account.token)).phone, '081234567890')
    })
    await check(`${role}: photo persists after refresh and logout/login`, async () => {
      await page.reload(); await avatarsReady(page)
      await page.getByRole('button', { name: 'Keluar dari akun', exact: true }).click()
      await page.waitForURL('**/login')
      await login(page, account, isProvider)
      await page.goto(`${site}/${role}/profile`)
      await avatarsReady(page)
      if (isProvider) {
        await page.goto(`${site}/provider/dashboard`)
        await avatarsReady(page)
        assert.equal(await page.locator('.provider-avatar-circle img').count(), 1)
        await page.goto(`${site}/provider/profile`)
      }
    })
    await check(`${role}: responsive layout without horizontal overflow`, async () => {
      for (const width of [360, 390, 768, 1024, 1440]) {
        await page.setViewportSize({ width, height: 1000 })
        await noOverflow(page)
        if ([390, 1440].includes(width)) await page.screenshot({ path: path.join(output, `${role}-profile-${width}.png`), fullPage: true })
      }
    })
    await check(`${role}: delete restores profile/sidebar/header initials`, async () => {
      await page.getByRole('button', { name: 'Hapus foto', exact: true }).click()
      await page.getByRole('status').filter({ hasText: 'Foto profil dihapus.' }).waitFor()
      assert.equal(await page.locator('.user-avatar img').count(), 0)
      const profile = await request('GET', '/api/profile', null, account.token)
      assert.equal(profile.avatar_url, undefined)
      await page.reload()
      await page.getByRole('button', { name: 'Unggah foto', exact: true }).waitFor()
      assert.equal(await page.locator('.user-avatar img').count(), 0)
    })
    await page.getByRole('button', { name: 'Keluar dari akun', exact: true }).click()
    await page.waitForURL('**/login')
  }
  await check('Cross-account query parameters cannot read or delete another photo', async () => {
    const result = await upload(bytes('png'), 'image/png', patient.token)
    const patientURL = result.data.avatar_url
    assert.equal((await fetch(api + patientURL, { headers: { Authorization: `Bearer ${provider.token}` } })).status, 404)
    await request('DELETE', patientURL, null, provider.token)
    assert.equal((await fetch(api + patientURL, { headers: { Authorization: `Bearer ${patient.token}` } })).status, 200)
    assert.equal((await request('GET', '/api/profile', null, provider.token)).role, 'provider')
    assert.equal((await request('GET', '/api/profile', null, patient.token)).role, 'patient')
  })
  assert.deepEqual(pageErrors, [])
  fs.writeFileSync(path.join(output, 'verification.json'), JSON.stringify({ checks, pageErrors, environment: 'Real local Go API and isolated PostgreSQL; deliberately simulated upload failure once per role; headless Edge via Playwright.' }, null, 2))
  console.log(`Completed ${checks.length} checks. Screenshots: ${output}`)
})().catch(error => { console.error(error); process.exitCode = 1 }).finally(async () => {
  if (browser) await browser.close()
  for (const account of fixtures) {
    try { await request('DELETE', '/api/profile/photo', null, account.token) } catch { /* Cleanup below still runs. */ }
  }
  if (fixtures.length) sql(`DELETE FROM realtime_tickets WHERE user_id IN (${fixtures.map(a => a.user.id).join(',')}); DELETE FROM realtime_events WHERE user_id IN (${fixtures.map(a => a.user.id).join(',')}); DELETE FROM patients WHERE user_id IN (${fixtures.map(a => a.user.id).join(',')}); DELETE FROM users WHERE id IN (${fixtures.map(a => a.user.id).join(',')});`)
})
