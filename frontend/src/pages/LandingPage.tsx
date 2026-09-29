import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDown, ArrowRight, CalendarDays, Camera, ChartNoAxesColumnIncreasing, Check, ChevronRight, ClipboardCheck, Footprints, Hand, Menu, ScanLine, ShieldCheck, Stethoscope, Users, X } from 'lucide-react'
import { ButtonLink, Logo } from '../components/UI'
import { ApplicationPreview, AreaPreview, HistoryPreview, ProviderPreview, ResultPreview, type PreviewView } from '../components/LandingPreviews'
import hero from '../assets/editorial-feet.png'
import '../styles/landing.css'

const navigation = [
  { id: 'beranda', label: 'Beranda' },
  { id: 'fitur', label: 'Fitur' },
  { id: 'cara-kerja', label: 'Cara Kerja' },
  { id: 'tenaga-kesehatan', label: 'Untuk Tenaga Kesehatan' },
  { id: 'tentang', label: 'Tentang' },
]

function LandingHeader() {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState('beranda')
  const [scrolled, setScrolled] = useState(false)
  const toggle = useRef<HTMLButtonElement>(null)
  const header = useRef<HTMLElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      const visible = entries.filter(entry => entry.isIntersecting)
      if (visible.length) setActive(visible[0].target.id)
    }, { rootMargin: '-80px 0px -55% 0px', threshold: 0 })
    navigation.forEach(({ id }) => {
      const section = document.getElementById(id)
      if (section) observer.observe(section)
    })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const updateScroll = () => setScrolled(window.scrollY > 12)
    updateScroll()
    window.addEventListener('scroll', updateScroll, { passive: true })
    return () => window.removeEventListener('scroll', updateScroll)
  }, [])

  useEffect(() => {
    if (!open) return
    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !header.current?.contains(event.target)) setOpen(false)
    }
    const desktop = window.matchMedia('(min-width: 1061px)')
    const closeOnDesktop = () => { if (desktop.matches) setOpen(false) }
    document.addEventListener('pointerdown', closeOutside)
    desktop.addEventListener('change', closeOnDesktop)
    return () => {
      document.removeEventListener('pointerdown', closeOutside)
      desktop.removeEventListener('change', closeOnDesktop)
    }
  }, [open])

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === 'Escape' && open) {
      setOpen(false)
      toggle.current?.focus()
    }
  }

  function followSection(id: string) {
    setOpen(false)
    setActive(id)
    document.getElementById(id)?.focus({ preventScroll: true })
  }

  return <header className={`lp-header${scrolled ? ' is-scrolled' : ''}`} ref={header} onKeyDown={handleKeyDown} onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false)
  }}>
    <div className="lp-container lp-header-inner">
      <Logo compact />
      <nav id="landing-navigation" className={`lp-nav${open ? ' is-open' : ''}`} aria-label="Navigasi utama">
        {navigation.map(({ id, label }) => <a key={id} href={`#${id}`} onClick={() => followSection(id)} aria-current={active === id ? 'location' : undefined}>{label}</a>)}
        <div className="lp-mobile-auth"><Link to="/login">Masuk</Link><Link to="/register">Daftar</Link></div>
      </nav>
      <div className="lp-header-actions"><Link className="lp-login" to="/login">Masuk</Link><Link className="lp-register" to="/register">Daftar <ArrowRight size={15} aria-hidden="true" /></Link></div>
      <button ref={toggle} className="lp-menu-toggle" type="button" aria-label={open ? 'Tutup menu' : 'Buka menu'} aria-expanded={open} aria-controls="landing-navigation" onClick={() => setOpen(!open)}>{open ? <X /> : <Menu />}</button>
    </div>
  </header>
}

function HeroSection() {
  return <section className="lp-hero" id="beranda" tabIndex={-1} aria-labelledby="landing-title">
    <div className="lp-hero-copy">
      <span className="lp-pill"><ShieldCheck size={14} aria-hidden="true" />Langkah kecil untuk hidup lebih sehat</span>
      <h1 id="landing-title">Pantau Kesehatan<br />Kaki Diabetik<br /><span>dengan Lebih Tenang.</span></h1>
      <p>Kenali kondisi kaki Anda melalui analisis foto, penilaian risiko klinis, dan review tenaga kesehatan. Satu tempat untuk pemantauan yang lebih teratur.</p>
      <div className="lp-hero-actions"><ButtonLink to="/patient/assessment">Mulai Sekarang</ButtonLink><a className="lp-learn-link" href="#cara-kerja"><span><ArrowDown size={17} aria-hidden="true" /></span>Pelajari Lebih Lanjut</a></div>
      <span className="lp-hero-note"><Users size={17} aria-hidden="true" />Mendampingi pasien dan tenaga kesehatan<br />dalam setiap langkah perawatan.</span>
    </div>
    <div className="lp-hero-visual">
      <img className="lp-hero-photo" src={hero} alt="Kaki melangkah di ruangan dengan cahaya alami" width="1774" height="887" fetchPriority="high" />
      <div className="lp-photo-caption"><span>PERHATIAN HARI INI</span><p>Untuk langkah<br />yang lebih baik<br /><em>esok hari.</em></p></div>
      <div className="lp-hero-phone"><ResultPreview phone /></div>
      <div className="lp-photo-note"><ShieldCheck size={16} aria-hidden="true" /><span>Teknologi yang mendampingi.<br /><strong>Perawatan yang tetap manusiawi.</strong></span></div>
    </div>
  </section>
}

const benefits = [
  { icon: Camera, title: 'Pemeriksaan lebih praktis', text: 'Dokumentasikan kondisi kaki melalui foto.' },
  { icon: ChartNoAxesColumnIncreasing, title: 'Riwayat tersimpan', text: 'Pantau kondisi kaki dari waktu ke waktu.' },
  { icon: Users, title: 'Review tenaga kesehatan', text: 'Hasil dapat ditinjau tenaga kesehatan.' },
  { icon: ShieldCheck, title: 'Area yang perlu diperhatikan', text: 'Visualisasi jelas untuk membantu peninjauan.' },
]

function TrustStrip() {
  return <div className="lp-trust"><div className="lp-container lp-trust-grid">{benefits.map(({ icon: Icon, title, text }) => <div className="lp-trust-item" key={title}><span className="lp-icon"><Icon size={24} strokeWidth={1.8} aria-hidden="true" /></span><div><h2>{title}</h2><p>{text}</p></div></div>)}</div></div>
}

const steps = [
  { icon: Camera, title: 'Ambil Foto Kaki', text: 'Lengkapi data klinis, lalu unggah foto kaki kiri atau kanan dengan pencahayaan yang cukup.' },
  { icon: ScanLine, title: 'Analisis Sistem', text: 'AI membantu mengenali temuan visual dan menandai area yang perlu diperhatikan.' },
  { icon: ClipboardCheck, title: 'Penilaian Risiko Kaki Diabetik', text: 'Informasi klinis melengkapi pemeriksaan untuk penilaian risiko kaki diabetik.' },
  { icon: Stethoscope, title: 'Review Tenaga Kesehatan', text: 'Tenaga kesehatan dapat meninjau pemeriksaan dan memberikan catatan tindak lanjut.' },
]

function HowItWorks() {
  return <section className="lp-section lp-container" id="cara-kerja" tabIndex={-1} aria-labelledby="process-title">
    <div className="lp-section-heading"><div><span className="lp-eyebrow">PROSES SEDERHANA</span><h2 id="process-title">Cara Kerja FootGuard</h2><p>Dari dokumentasi kaki hingga tindak lanjut.<br />Kenali setiap langkah pemeriksaan Anda.</p></div><a className="lp-text-link" href="#cuplikan">Kenali aplikasinya <ArrowRight size={16} aria-hidden="true" /></a></div>
    <ol className="lp-steps">{steps.map(({ icon: Icon, title, text }, index) => <li className="lp-step" key={title}><div className="lp-step-top"><span className="lp-step-number">0{index + 1}</span><Icon size={29} strokeWidth={1.5} aria-hidden="true" /></div><h3>{title}</h3><p>{text}</p>{index < 3 && <span className="lp-step-arrow" aria-hidden="true"><ArrowRight size={19} /></span>}</li>)}</ol>
  </section>
}

const features = [
  { icon: ShieldCheck, title: 'Hasil Pemeriksaan', text: 'Temuan visual dan risiko klinis disajikan dengan jelas.', preview: <ResultPreview /> },
  { icon: CalendarDays, title: 'Riwayat Pemeriksaan', text: 'Buka kembali catatan kondisi kaki Anda dari waktu ke waktu.', preview: <HistoryPreview /> },
  { icon: ScanLine, title: 'Area yang Ditandai', text: 'Visualisasi area pada foto untuk membantu peninjauan.', preview: <AreaPreview /> },
  { icon: Users, title: 'Dashboard Tenaga Kesehatan', text: 'Tinjau pemeriksaan pasien dan catat tindak lanjut klinis.', preview: <ProviderPreview /> },
]

function FeaturesSection() {
  return <section className="lp-feature-section" id="fitur" tabIndex={-1} aria-labelledby="features-title"><div className="lp-container lp-section">
    <div className="lp-section-heading"><div><span className="lp-eyebrow">SOLUSI LENGKAP</span><h2 id="features-title">Fitur Utama FootGuard</h2><p>Catatan yang saling terhubung.<br />Pemantauan yang lebih mudah dipahami.</p></div><span className="lp-example-note">Pratinjau dengan data ilustrasi</span></div>
    <div className="lp-features">{features.map(({ icon: Icon, title, text, preview }) => <article className="lp-feature" key={title}><div className="lp-feature-heading"><span className="lp-icon"><Icon size={21} aria-hidden="true" /></span><div><h3>{title}</h3><p>{text}</p></div></div><div className="lp-feature-preview">{preview}</div></article>)}</div>
  </div></section>
}

function WhyFootGuard() {
  return <section className="lp-why lp-container" id="tentang" tabIndex={-1} aria-labelledby="why-title"><div><span className="lp-eyebrow">KEPERCAYAAN UNTUK SETIAP LANGKAH</span><h2 id="why-title">Mengapa Memilih<br />FootGuard?</h2><p>Teknologi yang dekat dengan kebutuhan Anda, dengan perawatan sebagai pusatnya.</p></div><div className="lp-values">{[
    { icon: Hand, title: 'Mudah digunakan', text: 'Alur sederhana untuk memulai dan melihat hasil pemeriksaan.' },
    { icon: CalendarDays, title: 'Monitoring berkala', text: 'Catatan tersimpan untuk mendukung pemantauan rutin.' },
    { icon: Stethoscope, title: 'Dukungan tenaga kesehatan', text: 'Peninjauan klinis tetap menjadi bagian dari perawatan.' },
    { icon: ScanLine, title: 'Hasil visual yang jelas', text: 'Foto dan area yang ditandai lebih mudah dipahami.' },
  ].map(({ icon: Icon, title, text }) => <div className="lp-value" key={title}><span className="lp-icon"><Icon size={22} strokeWidth={1.7} aria-hidden="true" /></span><h3>{title}</h3><p>{text}</p></div>)}</div></section>
}

const previewTabs: { id: PreviewView; label: string }[] = [
  { id: 'patient', label: 'Dashboard Pasien' },
  { id: 'result', label: 'Hasil Pemeriksaan' },
  { id: 'history', label: 'Riwayat Pemeriksaan' },
  { id: 'provider', label: 'Tenaga Kesehatan' },
]

function ProductPreview() {
  const [view, setView] = useState<PreviewView>('patient')
  function navigateTabs(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next = index
    if (event.key === 'ArrowRight') next = (index + 1) % previewTabs.length
    else if (event.key === 'ArrowLeft') next = (index + previewTabs.length - 1) % previewTabs.length
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = previewTabs.length - 1
    else return
    event.preventDefault()
    setView(previewTabs[next].id)
    document.getElementById(`preview-tab-${previewTabs[next].id}`)?.focus()
  }
  return <section className="lp-product-section lp-container" id="cuplikan" tabIndex={-1} aria-labelledby="preview-title">
    <div className="lp-product-copy"><span className="lp-eyebrow">TAMPILAN APLIKASI</span><h2 id="preview-title">Lebih dekat dengan<br />FootGuard.</h2><p>Dari pemeriksaan pertama hingga riwayat perawatan. Semua tersusun dalam tampilan yang mudah Anda ikuti.</p><div className="lp-preview-tabs" role="tablist" aria-label="Cuplikan aplikasi">{previewTabs.map(({ id, label }, index) => <button key={id} id={`preview-tab-${id}`} role="tab" type="button" aria-selected={view === id} aria-controls="application-preview-panel" tabIndex={view === id ? 0 : -1} onClick={() => setView(id)} onKeyDown={event => navigateTabs(event, index)}><span>{label}</span><ChevronRight size={16} aria-hidden="true" /></button>)}</div></div>
    <div className="lp-product-window" id="application-preview-panel" role="tabpanel" aria-labelledby={`preview-tab-${view}`} tabIndex={0}><ApplicationPreview view={view} /></div>
  </section>
}

function ProviderSection() {
  return <section className="lp-provider-section" id="tenaga-kesehatan" tabIndex={-1} aria-labelledby="provider-title"><div className="lp-container lp-provider-inner"><span className="lp-provider-symbol"><Stethoscope size={38} strokeWidth={1.4} aria-hidden="true" /></span><div><span className="lp-eyebrow">UNTUK TENAGA KESEHATAN</span><h2 id="provider-title">Konteks lebih lengkap.<br />Peninjauan lebih terarah.</h2><p>Satukan foto, informasi klinis, dan riwayat pasien untuk membantu proses review dan pencatatan tindak lanjut.</p></div><div className="lp-provider-access"><Link className="button" to="/login" state={{ role: 'provider' }}>Masuk sebagai Tenaga Kesehatan <ArrowRight size={16} aria-hidden="true" /></Link><span><Check size={14} aria-hidden="true" />Akses melalui akun dari administrator institusi.</span></div></div></section>
}

function FinalCTA() {
  return <section className="lp-final"><div className="lp-container lp-final-inner"><span className="lp-final-icon"><ShieldCheck size={32} strokeWidth={1.5} aria-hidden="true" /></span><div><h2>Satu langkah hari ini.<br />Perhatian yang berarti untuk esok.</h2><p>FootGuard membantu skrining dan pemantauan kaki diabetik.<br />Hasil AI tidak menggantikan pemeriksaan tenaga kesehatan.</p></div><ButtonLink to="/patient/assessment">Mulai Pemeriksaan</ButtonLink></div></section>
}

function LandingFooter() {
  return <footer className="lp-footer lp-container"><div className="lp-footer-main"><div className="lp-footer-brand"><Logo compact /><p>Setiap langkah berarti.<br />Untuk hidup yang lebih baik.</p></div><div><h2>Produk</h2><a href="#fitur">Fitur</a><a href="#cara-kerja">Cara Kerja</a><a href="#tenaga-kesehatan">Untuk Tenaga Kesehatan</a></div><div><h2>Kenali FootGuard</h2><a href="#tentang">Tentang FootGuard</a><a href="#cuplikan">Cuplikan Aplikasi</a><Link to="/education">Edukasi Perawatan Kaki</Link></div><div><h2>Mulai Bersama Kami</h2><Link to="/login">Masuk ke Akun <ArrowRight size={13} aria-hidden="true" /></Link><Link to="/register">Daftar sebagai Pasien <ArrowRight size={13} aria-hidden="true" /></Link></div></div><div className="lp-footer-bottom"><span>© {new Date().getFullYear()} FootGuard. Semua hak dilindungi.</span><span><Footprints size={14} aria-hidden="true" />See Today, Healthier Tomorrow.</span></div></footer>
}

export function Landing() {
  return <div className="fg-landing"><a className="lp-skip-link" href="#landing-main">Lewati ke konten utama</a><LandingHeader /><main id="landing-main" tabIndex={-1}><HeroSection /><TrustStrip /><HowItWorks /><FeaturesSection /><WhyFootGuard /><ProductPreview /><ProviderSection /><FinalCTA /></main><LandingFooter /></div>
}
