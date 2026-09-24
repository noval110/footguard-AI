import { useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { BookOpen, ClipboardList, Footprints, History, Home, LayoutDashboard, LogOut, Menu, UserRound, Users, X } from 'lucide-react'
import { Logo } from '../components/UI'
import { useAuth } from '../auth/useAuth'

const patientLinks = [
  { to: '/patient/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/patient/assessment', label: 'Pemeriksaan Baru', icon: Footprints },
  { to: '/patient/history', label: 'Riwayat', icon: History },
  { to: '/patient/education', label: 'Edukasi', icon: BookOpen },
  { to: '/patient/profile', label: 'Profil', icon: UserRound },
]
const providerLinks = [
  { to: '/provider/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/provider/patients', label: 'Pasien', icon: Users },
  { to: '/provider/dashboard#reviews', label: 'Perlu Ditinjau', icon: ClipboardList },
]

export function AppLayout({ role }: { role: 'patient' | 'provider' }) {
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const { user, signOut } = useAuth()
  const links = role === 'patient' ? patientLinks : providerLinks
  const name = user?.name || 'Pengguna'
  const initials = name.split(' ').filter(Boolean).slice(0, 2).map(part => part[0].toUpperCase()).join('')
  return <div className="app-shell">
    <button type="button" className="mobile-nav-button" onClick={() => setOpen(true)} aria-label="Buka navigasi" aria-expanded={open}><Menu size={22} /></button>
    {open && <button type="button" className="drawer-backdrop" onClick={() => setOpen(false)} aria-label="Tutup navigasi" />}
    <aside className={`sidebar ${open ? 'sidebar-open' : ''}`}><div className="sidebar-top"><Logo compact /><button type="button" className="drawer-close" onClick={() => setOpen(false)} aria-label="Tutup navigasi"><X size={20} /></button></div><p className="sidebar-role">{role === 'patient' ? 'RUANG PASIEN' : 'RUANG TENAGA KESEHATAN'}</p><nav aria-label="Navigasi utama">{links.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} onClick={() => setOpen(false)} className={() => `side-link ${location.pathname + location.hash === to || (!to.includes('#') && location.pathname === to && !location.hash) ? 'selected' : ''}`}><Icon size={18} strokeWidth={1.8} />{label}</NavLink>)}</nav><div className="sidebar-bottom"><div className="sidebar-help"><span className="tiny-line" />Perhatian kecil hari ini membantu langkah esok.</div><button type="button" onClick={signOut} className="side-link logout-button"><LogOut size={18} />Keluar</button></div></aside>
    <main className="app-main"><div className="app-topbar"><div className="topbar-context"><Link to="/" className="home-link" aria-label="Kembali ke halaman awal"><Home size={15} /><span>Halaman awal</span></Link><span className="topbar-divider" aria-hidden="true" /><span>{role === 'patient' ? 'Pemantauan Kaki Diabetik' : 'Tinjauan Klinis'}</span></div><div className="topbar-person"><span className="avatar">{initials}</span><div><strong>{name}</strong><small>{role === 'patient' ? 'Pasien' : 'Tenaga kesehatan'}</small></div></div></div><div className="app-content"><Outlet /></div></main>
  </div>
}
