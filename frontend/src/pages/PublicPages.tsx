import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { ArrowRight, BookOpen, Camera, Check, ClipboardCheck, HeartPulse, History, Menu, ScanSearch, ShieldCheck, Stethoscope, UserRound, X } from 'lucide-react'
import { ButtonLink, Logo } from '../components/UI'
import hero from '../assets/editorial-feet.png'
import { register } from '../api/auth'
import { ApiError, errorText } from '../api/client'
import { useAuth } from '../auth/useAuth'
import { LoadingState } from '../components/Feedback'

const steps = [
  { title: 'Ambil foto kaki', description: 'Pilih kaki kiri atau kanan, lalu dokumentasikan dengan cahaya yang cukup.', icon: Camera },
  { title: 'Lihat analisis visual', description: 'AI membantu menandai area pada foto yang perlu diperhatikan.', icon: ScanSearch },
  { title: 'Lengkapi konteks klinis', description: 'Informasi kesehatan membantu tenaga medis melakukan penilaian risiko.', icon: ClipboardCheck },
  { title: 'Pantau dan tindak lanjuti', description: 'Lihat riwayat pemeriksaan serta review dari tenaga kesehatan.', icon: History },
]
const features = [
  { title: 'Pemantauan visual kaki', description: 'Foto kaki tersimpan bersama tanggal dan sisi kaki.', icon: Camera },
  { title: 'Analisis berbantuan AI', description: 'Temuan visual, area yang ditandai, dan keyakinan model ditampilkan jelas.', icon: ScanSearch },
  { title: 'Riwayat pemeriksaan', description: 'Bandingkan catatan Anda dari waktu ke waktu.', icon: History },
  { title: 'Penilaian risiko', description: 'Kategori klinis dicatat terpisah dari hasil foto.', icon: HeartPulse },
  { title: 'Review tenaga kesehatan', description: 'Tenaga medis dapat meninjau hasil dan memberi catatan.', icon: Stethoscope },
  { title: 'Edukasi perawatan', description: 'Panduan singkat yang mudah dibaca saat dibutuhkan.', icon: BookOpen },
]

export function Landing() {
  const [menuOpen, setMenuOpen] = useState(false)
  return <div className="public-page" id="beranda">
    <header className="public-header"><div className="public-header-inner"><Logo /><nav className={menuOpen ? 'public-nav nav-open' : 'public-nav'} aria-label="Navigasi publik"><a href="#tentang" onClick={() => setMenuOpen(false)}>Tentang</a><a href="#cara-kerja" onClick={() => setMenuOpen(false)}>Cara kerja</a><a href="#fitur" onClick={() => setMenuOpen(false)}>Fitur</a><a href="#kejelasan-ai" onClick={() => setMenuOpen(false)}>Tentang AI</a><Link className="mobile-login" to="/login" onClick={() => setMenuOpen(false)}>Masuk</Link></nav><div className="header-actions"><Link to="/login" className="text-link">Masuk</Link><ButtonLink to="/patient/assessment">Mulai Pemeriksaan</ButtonLink></div><button type="button" className="menu-toggle" onClick={() => setMenuOpen(!menuOpen)} aria-label={menuOpen ? 'Tutup menu' : 'Buka menu'} aria-expanded={menuOpen}>{menuOpen ? <X /> : <Menu />}</button></div></header>
    <main>
      <section className="landing-hero"><div className="hero-photo" style={{ backgroundImage: `url(${hero})` }} role="img" aria-label="Kaki melangkah dalam cahaya alami" /><div className="hero-content"><p className="eyebrow">FOOTGUARD / PEMANTAUAN KAKI DIABETIK</p><h1>Pantau kesehatan<br />kaki diabetik<br /><em>lebih dini.</em></h1><p>FootGuard membantu pasien diabetes memantau kaki melalui foto, analisis visual berbantuan AI, penilaian risiko, dan tindak lanjut tenaga kesehatan.</p><div className="hero-buttons"><ButtonLink to="/patient/assessment">Mulai Pemeriksaan</ButtonLink><a className="button button-secondary" href="#cara-kerja">Pelajari Cara Kerja</a></div><span className="hero-assurance"><ShieldCheck size={17} /> Untuk pemantauan. Bukan diagnosis mandiri.</span></div><div className="hero-bottom"><span>See Today, Healthier Tomorrow</span><span>Satu langkah kecil untuk pemantauan yang lebih teratur.</span></div></section>
      <section id="tentang" className="section redesign-intro"><div><span className="eyebrow">01 / MENGAPA FOOTGUARD</span><h2>Perubahan kecil layak mendapat perhatian.</h2></div><div><p>Memantau kaki secara berkala membantu Anda memiliki catatan yang lebih jelas saat berdiskusi dengan tenaga kesehatan. FootGuard menyatukan foto, informasi klinis, dan hasil review dalam satu alur.</p><div className="intro-points"><span><Check size={18} /> Dibuat untuk pasien diabetes</span><span><Check size={18} /> Riwayat tersimpan dan mudah dibuka kembali</span><span><Check size={18} /> Hasil AI dan keputusan klinis dibedakan</span></div></div></section>
      <section id="cara-kerja" className="section redesign-process"><div className="section-heading"><span className="eyebrow">02 / CARA KERJA</span><h2>Jelas pada setiap langkah.</h2><p>Dari foto pertama hingga catatan tindak lanjut.</p></div><div className="process-grid">{steps.map(({ title, description, icon: Icon }, index) => <article className="process-item" key={title}><div className="process-top"><span>{String(index + 1).padStart(2, '0')}</span><Icon size={23} strokeWidth={1.6} /></div><h3>{title}</h3><p>{description}</p></article>)}</div></section>
      <section id="fitur" className="section redesign-features"><div className="section-heading"><span className="eyebrow">03 / FITUR UTAMA</span><h2>Satu ruang untuk merawat setiap langkah.</h2><p>Fitur yang berangkat dari kebutuhan pasien dan tenaga kesehatan.</p></div><div className="feature-grid">{features.map(({ title, description, icon: Icon }) => <article className="feature-card" key={title}><Icon size={22} strokeWidth={1.6} /><h3>{title}</h3><p>{description}</p></article>)}</div></section>
      <section className="monitoring-band"><div><span className="eyebrow">MONITORING DARI WAKTU KE WAKTU</span><h2>Satu foto memberi gambaran hari ini. Riwayat memberi konteks.</h2></div><p>Setiap pemeriksaan menyimpan tanggal, sisi kaki, foto, hasil visual, serta status penilaian dan review yang tersedia. Anda dapat membukanya kembali saat dibutuhkan.</p></section>
      <section id="kejelasan-ai" className="ai-transparency"><div><span className="eyebrow light">04 / KEJELASAN AI</span><h2>AI membantu melihat.<br /><em>Tenaga medis membantu menilai.</em></h2></div><div><p>AI membantu menganalisis area visual pada foto dan bukan alat diagnosis mandiri. Kategori risiko kaki diabetik mempertimbangkan informasi klinis pasien dan penilaian tenaga kesehatan.</p><Link className="inline-link light-link" to="/education">Baca panduan perawatan <ArrowRight size={16} /></Link></div></section>
      <section className="closing-cta"><span className="eyebrow light">MULAI DARI HARI INI</span><h2>Mulai memantau kondisi kaki Anda.</h2><p>Catat pemeriksaan pertama dengan alur yang sederhana dan hasil yang dapat dibuka kembali.</p><ButtonLink to="/patient/assessment">Mulai Pemeriksaan</ButtonLink></section>
    </main><footer className="public-footer"><Logo /><span>FootGuard mendukung pemantauan kaki diabetik, bukan diagnosis mandiri.</span><span>© 2026 FootGuard</span></footer>
  </div>
}

export function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const navigate = useNavigate()
  const location = useLocation()
  const routeState = location.state as { from?: string; registered?: boolean; role?: 'patient' | 'provider' } | null
  const { user, loading: sessionLoading, signIn, signOut } = useAuth()
  const [role, setRole] = useState<'patient' | 'provider'>(routeState?.role === 'provider' ? 'provider' : 'patient')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  if (sessionLoading) return <div className="auth-loading"><LoadingState label="Memeriksa sesi Anda..." /></div>
  if (user) return <Navigate to={user.role === 'provider' ? '/provider/dashboard' : '/patient/dashboard'} replace />
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
        if (profile.role !== role) {
          signOut()
          setError(profile.role === 'provider' ? 'Akun ini terdaftar sebagai tenaga kesehatan. Pilih akses tenaga kesehatan.' : 'Akun ini terdaftar sebagai pasien. Pilih akses pasien.')
          return
        }
        const target = profile.role === 'provider' ? '/provider/dashboard' : '/patient/dashboard'
        const requested = routeState?.from
        navigate(requested?.startsWith(`/${profile.role}/`) ? requested : target, { replace: true })
      }
    } catch (err) { setError(login && err instanceof ApiError && err.status === 401 ? 'Email atau kata sandi tidak sesuai.' : errorText(err)) }
    finally { setSubmitting(false) }
  }
  const login = mode === 'login'
  const patient = role === 'patient'
  const chooseRole = (nextRole: 'patient' | 'provider') => { setRole(nextRole); setError('') }
  return <div className="auth-page"><div className="auth-form-panel"><div className="auth-top"><Logo /><Link to="/">Kembali ke beranda <ArrowRight size={15} /></Link></div><div className="auth-inner"><span className="eyebrow">{login ? 'AKSES FOOTGUARD' : 'PILIH JENIS AKUN'}</span><h1>{login ? `Masuk sebagai ${patient ? 'pasien' : 'tenaga kesehatan'}` : patient ? 'Buat akun pasien' : 'Akses tenaga kesehatan'}</h1><p className="muted">{login ? patient ? 'Lanjutkan pemantauan dan buka kembali hasil pemeriksaan Anda.' : 'Tinjau pemeriksaan pasien dan catat tindak lanjut klinis.' : patient ? 'Simpan pemeriksaan dan pantau riwayat kondisi kaki Anda.' : 'Akses klinis diberikan melalui akun yang dikelola administrator.'}</p><div className="auth-role-picker" role="group" aria-label="Pilih jenis akun"><button type="button" className={patient ? 'selected' : ''} onClick={() => chooseRole('patient')} aria-pressed={patient}><UserRound size={18} /><span><strong>Pasien</strong><small>Pemantauan pribadi</small></span></button><button type="button" className={!patient ? 'selected' : ''} onClick={() => chooseRole('provider')} aria-pressed={!patient}><Stethoscope size={18} /><span><strong>Tenaga kesehatan</strong><small>Akses klinis</small></span></button></div>{login && routeState?.registered && <p className="success-message" role="status">Akun pasien berhasil dibuat. Silakan masuk.</p>}{!login && !patient ? <div className="provider-access-notice"><span className="provider-access-icon"><ShieldCheck size={21} /></span><div><h2>Akun klinis dikelola administrator</h2><p>Hubungi administrator FootGuard di institusi Anda untuk mendapatkan akun tenaga kesehatan. Cara ini menjaga akses data pasien tetap terbatas pada petugas yang berwenang.</p></div><Link className="button" to="/login" state={{ role: 'provider' }}>Sudah punya akun <ArrowRight size={16} /></Link></div> : <><form onSubmit={submit} noValidate>{!login && <label className="field">Nama lengkap<input name="name" autoComplete="name" maxLength={100} placeholder="Nama lengkap" required /></label>}<label className="field">Alamat email<input name="email" type="email" autoComplete="email" placeholder="nama@email.com" required /></label><label className="field">Kata sandi<input name="password" type="password" autoComplete={login ? 'current-password' : 'new-password'} placeholder={login ? 'Kata sandi Anda' : 'Minimal 8 karakter'} minLength={login ? 1 : 8} maxLength={72} required /></label>{error && <p className="form-error" role="alert">{error}</p>}<button className="button form-submit" type="submit" disabled={submitting}>{submitting ? 'Memproses...' : login ? `Masuk sebagai ${patient ? 'Pasien' : 'Tenaga Kesehatan'}` : 'Buat Akun Pasien'} {!submitting && <ArrowRight size={16} />}</button></form><p className="auth-switch">{login ? 'Belum punya akun?' : 'Sudah punya akun?'} <Link to={login ? '/register' : '/login'} state={{ role }}>{login ? 'Pilih cara mendaftar' : 'Masuk'}</Link></p></>}<p className="demo-note"><ShieldCheck size={16} /> Akses disesuaikan dengan peran akun dan dilindungi autentikasi.</p></div></div><aside className="auth-visual" style={{ backgroundImage: `url(${hero})` }} aria-label="Foto kaki dalam suasana tenang"><div className="auth-visual-content"><span>FOOTGUARD / SEE TODAY, HEALTHIER TOMORROW</span><h2>Langkah kecil hari ini,<br /><em>untuk esok yang lebih baik.</em></h2><p>Catatan yang jelas membantu percakapan perawatan yang lebih baik.</p></div></aside></div>
}
