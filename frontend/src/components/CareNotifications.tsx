import { useEffect, useId, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell, BellOff, CalendarCheck, CalendarClock, CalendarX, CheckCheck, ClipboardCheck, MessageSquare, X } from 'lucide-react'
import { readNotification } from '../api/consultations'
import { useAuth } from '../auth/useAuth'
import { useCare } from '../care/useCare'

const labels: Record<string, string> = { message: 'Pesan konsultasi baru', appointment_requested: 'Permintaan jadwal konsultasi', appointment_confirmed: 'Jadwal dikonfirmasi', appointment_cancelled: 'Jadwal dibatalkan', appointment_completed: 'Konsultasi selesai', examination_reviewed: 'Pemeriksaan telah ditinjau' }
const icons: Record<string, typeof Bell> = { message: MessageSquare, appointment_requested: CalendarClock, appointment_confirmed: CalendarCheck, appointment_cancelled: CalendarX, appointment_completed: CheckCheck, examination_reviewed: ClipboardCheck }
const notificationDate = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
export function CareNotifications() {
  const care = useCare()
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const container = useRef<HTMLDivElement>(null)
  const toggle = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLElement>(null)
  const panelId = useId()
  const unread = care.notifications.filter(n => !n.read_at).length

  useEffect(() => {
    if (!open) return
    panel.current?.querySelector<HTMLButtonElement>('button')?.focus()
    function onPointerDown(event: PointerEvent) {
      if (!container.current?.contains(event.target as Node)) setOpen(false)
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') { setOpen(false); toggle.current?.focus() }
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => { document.removeEventListener('pointerdown', onPointerDown); document.removeEventListener('keydown', onKeyDown) }
  }, [open])

  function close() { setOpen(false); toggle.current?.focus() }

  return <div className="care-notifications" ref={container} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false) }}>
    <button ref={toggle} type="button" className="notification-toggle" aria-label={`Notifikasi${unread ? `, ${unread} belum dibaca` : ''}`} aria-expanded={open} aria-controls={open ? panelId : undefined} onClick={() => setOpen(!open)}>
      <Bell size={18} aria-hidden="true" /><span className="notification-toggle-label">Notifikasi</span>{unread > 0 && <span className="notification-count" aria-hidden="true">{unread > 99 ? '99+' : unread}</span>}
    </button>
    {open && <section ref={panel} id={panelId} className="notification-popover" aria-label="Notifikasi terbaru">
      <div className="notification-header"><div><h2>Notifikasi</h2><p>{unread ? `${unread} notifikasi belum dibaca` : 'Anda sudah membaca semua notifikasi'}</p></div><button type="button" className="notification-close" onClick={close} aria-label="Tutup notifikasi"><X size={18} aria-hidden="true" /></button></div>
      {error && <p className="notification-error" role="alert">{error}</p>}
      <div className="notification-list">
        {!care.notifications.length && <div className="notification-empty"><span><BellOff size={24} aria-hidden="true" /></span><strong>Belum ada notifikasi</strong><p>Pembaruan jadwal, pemeriksaan, dan pesan akan muncul di sini.</p></div>}
        {care.notifications.map(n => {
          const Icon = icons[n.kind] || Bell
          const to = n.conversation_id ? `/${user?.role}/consultation?conversation=${n.conversation_id}` : n.examination_id ? (user?.role === 'provider' ? `/provider/examinations/${n.examination_id}` : `/patient/result/${n.examination_id}`) : `/${user?.role}/schedule`
          return <Link key={n.id} className={`notification-item${!n.read_at ? ' is-unread' : ''}`} to={to} onClick={() => { setOpen(false); setError(''); void readNotification(n.id).then(care.refresh).catch(() => setError('Notifikasi belum dapat ditandai dibaca.')) }}>
            <span className="notification-icon" aria-hidden="true"><Icon size={19} /></span><span className="notification-content"><span className="notification-title">{labels[n.kind] || 'Pembaruan konsultasi'}</span><time dateTime={n.created_at}>{notificationDate.format(new Date(n.created_at))}</time></span>{!n.read_at && <span className="notification-new">Baru</span>}
          </Link>
        })}
      </div>
      {care.notifications.length > 0 && <div className="notification-footer">Pembaruan konsultasi dan pemeriksaan Anda</div>}
    </section>}
  </div>
}
