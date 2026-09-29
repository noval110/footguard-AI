import { useEffect, useRef, useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { ArrowRight, BookOpen, ClipboardList, Footprints, History, Home, LayoutDashboard, LogOut, Menu, ScanLine, ShieldCheck, UserRound, Users, X } from 'lucide-react'
import { useAuth } from '../auth/useAuth'

const patientMenu = [
  { label: 'Dashboard', path: '/patient/dashboard', icon: LayoutDashboard },
  { label: 'Pemeriksaan Baru', path: '/patient/assessment', icon: ScanLine },
  { label: 'Riwayat Pemeriksaan', path: '/patient/history', icon: History },
  { label: 'Edukasi Perawatan', path: '/patient/education', icon: BookOpen },
  { label: 'Profil Saya', path: '/patient/profile', icon: UserRound },
]
const providerMenu = [
  { label: 'Dashboard', path: '/provider/dashboard', icon: LayoutDashboard },
  { label: 'Daftar Pasien', path: '/provider/patients', icon: Users },
  { label: 'Antrean Review', path: '/provider/dashboard#triage', icon: ClipboardList },
  { label: 'Edukasi Perawatan', path: '/education', icon: BookOpen },
]

export function AppLayout({ role = 'patient' }: { role?: 'patient' | 'provider' }) {
  const { user, signOut } = useAuth()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)
  const drawer = useRef<HTMLElement>(null)
  const toggle = useRef<HTMLButtonElement>(null)
  const patient = role === 'patient'
  const menu = patient ? patientMenu : providerMenu
  const name = user?.name || (patient ? 'Pasien' : 'Tenaga Kesehatan')
  const initials = name.split(' ').filter(Boolean).slice(0, 2).map(part => part[0].toUpperCase()).join('')
  const current = menu.find(item => item.path === location.pathname + location.hash)
  const title = current?.label || (location.pathname.includes('/scan') ? 'Foto Kaki' : location.pathname.includes('/result') ? 'Hasil Pemeriksaan' : location.pathname.includes('/examinations') ? 'Review Pemeriksaan' : 'Detail Pasien')

  useEffect(() => {
    if (!location.hash) return
    const scrollToSection = () => {
      const section = document.getElementById(location.hash.slice(1))
      if (section) { section.scrollIntoView({ block: 'start' }); return true }
      return false
    }
    if (scrollToSection()) return
    const observer = new MutationObserver(() => { if (scrollToSection()) observer.disconnect() })
    const content = document.getElementById('app-content')
    if (content) observer.observe(content, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [location.pathname, location.hash])

  useEffect(() => {
    if (!mobileOpen) return
    const toggleButton = toggle.current
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    drawer.current?.querySelector<HTMLElement>('button, a')?.focus()
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setMobileOpen(false)
      if (event.key !== 'Tab') return
      const items = Array.from(drawer.current?.querySelectorAll<HTMLElement>('a, button') || [])
      const first = items[0]
      const last = items[items.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }
    const desktop = window.matchMedia('(min-width: 901px)')
    const resize = () => { if (desktop.matches) setMobileOpen(false) }
    document.addEventListener('keydown', onKey)
    desktop.addEventListener('change', resize)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKey)
      desktop.removeEventListener('change', resize)
      toggleButton?.focus()
    }
  }, [mobileOpen])

  return <div className="footguard-shell fresh-shell">
    <a className="app-skip" href="#app-content">Lewati ke konten utama</a>
    {mobileOpen && <button className="fresh-drawer-backdrop" type="button" tabIndex={-1} onClick={() => setMobileOpen(false)} aria-label="Tutup navigasi" />}
    <aside ref={drawer} id="app-navigation" className={`fresh-sidebar${mobileOpen ? ' is-open' : ''}`} role={mobileOpen ? 'dialog' : undefined} aria-modal={mobileOpen || undefined} aria-label="Navigasi FootGuard">
      <div className="fresh-brand-row"><Link className="fresh-brand" to={`/${role}/dashboard`} onClick={() => setMobileOpen(false)}><Footprints size={28} /><span>FootGuard<small>Pemantauan kaki diabetik</small></span></Link><button type="button" className="fresh-drawer-close" onClick={() => setMobileOpen(false)} aria-label="Tutup menu navigasi"><X size={20} /></button></div>
      <span className="fresh-nav-label">{patient ? 'RUANG PASIEN' : 'RUANG TENAGA KESEHATAN'}</span>
      <nav aria-label="Menu utama">{menu.map(({ label, path, icon: Icon }) => {
        const active = path === location.pathname + location.hash
        return <Link key={path} to={path} className={active ? 'is-active' : ''} aria-current={active ? 'page' : undefined} onClick={() => setMobileOpen(false)}><Icon size={19} strokeWidth={1.8} /><span>{label}</span></Link>
      })}<Link className="fresh-home-nav-link" to="/" onClick={() => setMobileOpen(false)}><Home size={19} strokeWidth={1.8} /><span>Beranda FootGuard</span></Link></nav>
      <div className="fresh-sidebar-note"><ShieldCheck size={25} strokeWidth={1.5} /><strong>Setiap langkah berarti.</strong><p>Catatan yang jelas untuk mendampingi perawatan kaki.</p><Link to={patient ? '/patient/assessment' : '/provider/patients'} onClick={() => setMobileOpen(false)}>{patient ? 'Mulai pemeriksaan' : 'Lihat daftar pasien'}<ArrowRight size={15} /></Link></div>
      <div className="fresh-sidebar-footer"><span className="fresh-avatar">{initials}</span><div><strong>{name}</strong><small>{patient ? 'Akun pasien' : 'Tenaga kesehatan'}</small></div><button type="button" onClick={signOut} aria-label="Keluar dari akun" title="Keluar"><LogOut size={18} /></button></div>
    </aside>
    <div className="fresh-main" inert={mobileOpen}>
      <header className="fresh-topbar"><div><button ref={toggle} className="fresh-menu-toggle" type="button" aria-label="Buka menu navigasi" aria-controls="app-navigation" aria-expanded={mobileOpen} onClick={() => setMobileOpen(true)}><Menu size={21} /></button><span className="fresh-breadcrumb">{patient ? 'Ruang Pasien' : 'Tenaga Kesehatan'}<span>/</span><strong>{title}</strong></span></div><div className="fresh-topbar-actions"><Link className="fresh-home-link" to="/" aria-label="Ke beranda FootGuard" title="Ke beranda FootGuard"><Home size={16} /><span>Beranda</span></Link><Link className="fresh-topbar-link" to={patient ? '/patient/profile' : '/provider/patients'}><span className="fresh-avatar">{initials}</span><span>{patient ? 'Profil Saya' : 'Daftar Pasien'}</span></Link></div></header>
      <main className="footguard-outlet-wrapper fresh-content" id="app-content" tabIndex={-1}><Outlet /></main>
      <footer className="fresh-app-footer"><span>© {new Date().getFullYear()} FootGuard</span><span>See Today, Healthier Tomorrow.</span></footer>
    </div>
  </div>
}

export default AppLayout
