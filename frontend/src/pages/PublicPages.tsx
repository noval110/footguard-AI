import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, Eye, EyeOff, Footprints, LoaderCircle, ShieldCheck, Stethoscope, UserRound } from 'lucide-react'
import { Logo } from '../components/UI'
import hero from '../assets/editorial-feet.png'
import { register } from '../api/auth'
import { ApiError, errorText } from '../api/client'
import { useAuth } from '../auth/useAuth'
import { LoadingState } from '../components/Feedback'
import { GoogleSignInButton } from '../components/GoogleSignInButton'
import type { User } from '../api/types'

export { Landing } from './LandingPage'

export function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const navigate = useNavigate()
  const location = useLocation()
  const routeState = location.state as { from?: string; registered?: boolean; role?: 'patient' | 'provider' } | null
  const { user, loading: sessionLoading, signIn, signInWithGoogle } = useAuth()
  const [role, setRole] = useState<'patient' | 'provider'>(routeState?.role === 'provider' ? 'provider' : 'patient')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  if (sessionLoading) return <div className="auth-loading"><LoadingState label="Memeriksa sesi Anda..." /></div>
  if (user) return <Navigate to={user.role === 'provider' ? '/provider/dashboard' : '/patient/dashboard'} replace />
  function redirectAuthenticated(profile: User) {
    const target = profile.role === 'provider' ? '/provider/dashboard' : '/patient/dashboard'
    const requested = routeState?.from
    navigate(requested?.startsWith(`/${profile.role}/`) ? requested : target, { replace: true })
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) return
    const form = new FormData(event.currentTarget)
    const email = String(form.get('email') || '').trim()
    const password = String(form.get('password') || '')
    const name = String(form.get('name') || '').trim()
    if (!email || !password || (mode === 'register' && !name)) { setError('Lengkapi semua kolom yang wajib diisi.'); return }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError('Masukkan alamat email yang valid.'); return }
    if (mode === 'register' && password.length < 8) { setError('Kata sandi minimal 8 karakter.'); return }
    setSubmitting(true); setError('')
    try {
      if (mode === 'register') {
        await register(name, email, password)
        navigate('/login', { replace: true, state: { registered: true, role: 'patient' } })
      } else {
        const profile = await signIn(email, password)
        redirectAuthenticated(profile)
      }
    } catch (err) { setError(login && err instanceof ApiError && err.status === 401 ? 'Email atau kata sandi tidak sesuai.' : errorText(err)) }
    finally { setSubmitting(false) }
  }
  async function submitGoogle(credential: string) {
    if (submitting) return
    setSubmitting(true); setError('')
    try { redirectAuthenticated(await signInWithGoogle(credential)) }
    catch (err) { setError(err instanceof ApiError && err.status === 401 ? 'Login Google gagal. Periksa akun Google Anda dan coba lagi.' : errorText(err)) }
    finally { setSubmitting(false) }
  }
  const login = mode === 'login'
  const patient = role === 'patient'
  const chooseRole = (nextRole: 'patient' | 'provider') => { setRole(nextRole); setError('') }
  return <div className="fg-auth">
    <header className="fresh-auth-header"><Logo compact /><Link to="/"><ArrowLeft size={16} />Kembali ke beranda</Link></header>
    <main className="fresh-auth-grid">
      <aside className="fresh-auth-story">
        <div className="fresh-auth-story-copy"><span className="fresh-auth-pill"><ShieldCheck size={15} />SAHABAT PEMANTAUAN KAKI ANDA</span><h2>Perhatian kecil hari ini.<br /><span>Langkah lebih tenang<br />esok hari.</span></h2><p>Foto, catatan pemeriksaan, dan review tenaga kesehatan. Terhubung untuk mendampingi perawatan kaki Anda.</p><div className="fresh-auth-benefits"><span><Check size={15} />Riwayat pemeriksaan tersimpan</span><span><Check size={15} />Peninjauan oleh tenaga kesehatan</span></div></div>
        <img src={hero} alt="Kaki melangkah dalam cahaya alami" className="fresh-auth-photo" />
        <div className="fresh-auth-caption"><Footprints size={21} /><span>Setiap langkah berarti.<small>See Today, Healthier Tomorrow.</small></span></div>
      </aside>
      <section className="fresh-auth-form" aria-labelledby="auth-title">
        <span className="eyebrow">{login ? 'SELAMAT DATANG KEMBALI' : 'MULAI BERSAMA DIA SCAN'}</span>
        <h1 id="auth-title">{login ? 'Masuk ke DIA SCAN' : patient ? 'Buat akun pasien' : 'Akses tenaga kesehatan'}</h1>
        <p className="fresh-auth-intro">{login ? patient ? 'Lanjutkan pemantauan kaki dan buka kembali catatan pemeriksaan Anda.' : 'Tinjau hasil pemeriksaan pasien dan catat tindak lanjut perawatan.' : patient ? 'Mulai catatan kesehatan kaki Anda dengan satu akun.' : 'Akun tenaga kesehatan disediakan oleh administrator institusi.'}</p>
        <div className="auth-role-picker" role="group" aria-label="Pilih jenis akun">
          <button type="button" className={patient ? 'selected' : ''} onClick={() => chooseRole('patient')} aria-pressed={patient} disabled={submitting}><UserRound size={19} /><span><strong>Pasien</strong><small>Pemantauan pribadi</small></span></button>
          <button type="button" className={!patient ? 'selected' : ''} onClick={() => chooseRole('provider')} aria-pressed={!patient} disabled={submitting}><Stethoscope size={19} /><span><strong>Tenaga kesehatan</strong><small>Peninjauan klinis</small></span></button>
        </div>
        {login && routeState?.registered && <p className="success-message" role="status">Akun pasien berhasil dibuat. Silakan masuk.</p>}
        {!login && !patient ? <div className="fresh-provider-notice"><ShieldCheck size={26} /><h2>Akun klinis dikelola administrator</h2><p>Hubungi administrator DIA SCAN di institusi Anda untuk mendapatkan akses tenaga kesehatan.</p><Link className="button" to="/login" state={{ role: 'provider' }}>Masuk dengan akun klinis<ArrowRight size={16} /></Link></div> : <>
          <form onSubmit={submit} noValidate>
            {!login && <label className="field" htmlFor="auth-name">Nama lengkap<input id="auth-name" name="name" autoComplete="name" maxLength={100} placeholder="Nama lengkap Anda" required disabled={submitting} /></label>}
            <label className="field" htmlFor="auth-email">Alamat email<input id="auth-email" name="email" type="email" autoComplete="email" placeholder="nama@email.com" required disabled={submitting} aria-invalid={error ? true : undefined} aria-describedby={error ? 'auth-error' : undefined} /></label>
            <div className="field"><label htmlFor="auth-password">Kata sandi</label><div className="fresh-password-input"><input id="auth-password" name="password" type={showPassword ? 'text' : 'password'} autoComplete={login ? 'current-password' : 'new-password'} placeholder={login ? 'Masukkan kata sandi' : 'Minimal 8 karakter'} minLength={login ? 1 : 8} maxLength={72} required disabled={submitting} aria-describedby={!login ? 'password-hint' : undefined} /><button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'} aria-pressed={showPassword}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>{!login && <small id="password-hint">Gunakan setidaknya 8 karakter untuk kata sandi Anda.</small>}</div>
            {error && <p className="form-error" id="auth-error" role="alert">{error}</p>}
            <button className="button fresh-auth-submit" type="submit" disabled={submitting}>{submitting ? <><LoaderCircle className="spin" size={17} />Memproses...</> : <>{login ? `Masuk sebagai ${patient ? 'Pasien' : 'Tenaga Kesehatan'}` : 'Daftar sebagai Pasien'}<ArrowRight size={17} /></>}</button>
          </form>
          {login && import.meta.env.VITE_GOOGLE_CLIENT_ID && <div className="fresh-google-auth"><div className="fresh-auth-divider"><span>atau lanjutkan dengan</span></div><GoogleSignInButton onCredential={submitGoogle} disabled={submitting} />{!patient && <small>Akun Google baru mendapat akses pasien. Akses tenaga kesehatan hanya untuk akun yang sudah terdaftar.</small>}</div>}
          <p className="fresh-auth-switch">{login ? 'Belum punya akun?' : 'Sudah punya akun?'} <Link to={login ? '/register' : '/login'} state={{ role }}>{login ? 'Daftar di sini' : 'Masuk di sini'}</Link></p>
        </>}
        <div className="fresh-auth-assurance"><ShieldCheck size={17} /><p>Akses sesuai peran akun.<br />Catatan pemeriksaan untuk mendukung perawatan Anda.</p></div>
      </section>
    </main>
    <footer className="fresh-auth-footer"><span>© {new Date().getFullYear()} DIA SCAN</span><p>DIA SCAN membantu skrining dan pemantauan kaki diabetik. Hasil AI tidak menggantikan pemeriksaan tenaga kesehatan.</p></footer>
  </div>
}
