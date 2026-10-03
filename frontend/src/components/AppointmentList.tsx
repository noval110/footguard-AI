import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays, Check, ClipboardList, Clock3, MessageSquare, Phone, UserRound, X } from 'lucide-react'
import { appointmentLabel, createAppointment, getConversation, listAppointments, updateAppointment, type AppointmentStatus } from '../api/consultations'
import { useAuth } from '../auth/useAuth'
import { useCare } from '../care/useCare'
import { useResource } from '../hooks/useResource'
import { ErrorState, LoadingState } from './Feedback'
import { EmptyState } from './UI'
import { errorText } from '../api/client'

export function AppointmentRequest({ conversationId, onSaved }: { conversationId: number; onSaved: () => void }) {
  const [scheduled, setScheduled] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone
  async function submit(event: FormEvent) {
    event.preventDefault(); if (busy) return
    setBusy(true); setError('')
    try { await createAppointment(conversationId, new Date(scheduled).toISOString(), notes); setScheduled(''); setNotes(''); onSaved() }
    catch (err) { setError(errorText(err)) } finally { setBusy(false) }
  }
  return <form className="card appointment-request" onSubmit={submit}><h3>Jadwalkan konsultasi</h3><p className="muted">Waktu mengikuti zona perangkat Anda: {zone}. Tenaga kesehatan akan mengonfirmasi permintaan.</p>
    <label className="field">Tanggal dan waktu<input type="datetime-local" value={scheduled} onChange={e => setScheduled(e.target.value)} required /></label>
    <label className="field">Catatan (opsional)<textarea rows={2} maxLength={3000} value={notes} onChange={e => setNotes(e.target.value)} /></label>
    {error && <p className="form-error" role="alert">{error}</p>}<button className="button" disabled={busy}>{busy ? 'Mengirim...' : 'Minta jadwal'}</button>
  </form>
}

export function AppointmentList({ conversationId }: { conversationId?: number }) {
  const { user } = useAuth()
  const provider = user?.role === 'provider'
  const care = useCare()
  const resource = useResource(listAppointments)
  const { reload } = resource
  const { subscribe } = care.realtime
  const [now, setNow] = useState(() => Date.now())
  const [error, setError] = useState('')
  const [busy, setBusy] = useState<number | null>(null)
  useEffect(() => {
    const unsubscribe = subscribe(event => { if (event.kind === 'appointment') reload() })
    const interval = setInterval(() => { setNow(Date.now()); reload() }, 30000)
    return () => { unsubscribe(); clearInterval(interval) }
  }, [subscribe, reload])
  async function change(id: number, status: AppointmentStatus) {
    setBusy(id); setError('')
    try { await updateAppointment(id, status); resource.reload(); care.refresh() } catch (err) { setError(errorText(err)) } finally { setBusy(null) }
  }
  if (resource.loading && !resource.value) return <LoadingState label="Memuat jadwal konsultasi..." />
  if (resource.error || !resource.value) return <ErrorState message={resource.error || 'Jadwal tidak tersedia.'} retry={resource.reload} />
  const appointments = resource.value.filter(a => !conversationId || a.conversation_id === conversationId)
  return <section className="appointment-list" aria-label="Jadwal konsultasi"><h2>{provider ? 'Permintaan dan jadwal pasien' : 'Konsultasi Mendatang'}</h2>
    {error && <p className="form-error" role="alert">{error}</p>}
    {!appointments.length && <EmptyState text="Belum ada jadwal konsultasi." />}
    {appointments.map(a => {
      const active = a.status === 'requested' || a.status === 'confirmed'
      const until = new Date(a.scheduled_at).getTime() - now
      const scheduled = new Date(a.scheduled_at)
      return <article className={`card appointment-card appointment-card--${a.status}${provider ? ' appointment-card--provider' : ''}`} key={a.id}>
        <div className="appointment-card-main">
          <div className="appointment-date-tile" aria-hidden="true"><span>{new Intl.DateTimeFormat('id-ID', { month: 'short' }).format(scheduled)}</span><strong>{scheduled.getDate()}</strong><small>{scheduled.getFullYear()}</small></div>
          <div className="appointment-details">
            <div className="appointment-card-heading"><h3><CalendarDays size={16} aria-hidden="true" /><time dateTime={a.scheduled_at}>{new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(scheduled)}</time></h3><span className={`appointment-status appointment-status--${a.status}`}><span aria-hidden="true" />{provider && a.status === 'requested' ? 'Menunggu konfirmasi' : appointmentLabel[a.status]}</span></div>
            <p className="appointment-time"><Clock3 size={15} aria-hidden="true" />{new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' }).format(scheduled)}</p>
            <p className="appointment-participant"><UserRound size={15} aria-hidden="true" /><span><small>{user?.role === 'patient' ? 'Tenaga kesehatan' : 'Pasien'}</small><strong>{user?.role === 'patient' ? a.provider_name : a.patient_name}</strong></span></p>
            {a.notes && <div className="appointment-note"><span>Catatan konsultasi</span><p>{a.notes}</p></div>}
          </div>
        </div>
        <div className="appointment-card-actions"><div className="appointment-navigation"><Link className={`button${provider ? ' button-secondary' : ''}`} to={`/${user?.role}/consultation?conversation=${a.conversation_id}`}><MessageSquare size={16} aria-hidden="true" />Buka percakapan</Link>
          {a.examination_id && <Link className="button button-secondary" to={user?.role === 'provider' ? `/provider/examinations/${a.examination_id}` : `/patient/result/${a.examination_id}`}><ClipboardList size={16} aria-hidden="true" />Lihat pemeriksaan</Link>}
          </div>
          {active && <div className="appointment-controls">
          {provider && a.status === 'requested' && <button className="button" disabled={busy !== null} onClick={() => void change(a.id, 'confirmed')}><Check size={16} aria-hidden="true" />Konfirmasi</button>}
          {a.status === 'confirmed' && until <= 15 * 60000 && until >= -60 * 60000 && <button className="button" disabled={!care.realtime.connected || !['idle', 'ended', 'failed'].includes(care.voice.state)} onClick={() => { void getConversation(a.conversation_id).then(c => care.voice.start(c, a.id)).catch(err => setError(errorText(err))) }}><Phone size={16} aria-hidden="true" />Mulai panggilan</button>}
          {provider && a.status === 'confirmed' && until <= 0 && <button className="button button-secondary" disabled={busy !== null} onClick={() => void change(a.id, 'completed')}><Check size={16} aria-hidden="true" />Tandai selesai</button>}
          <button className="button appointment-cancel" disabled={busy !== null} onClick={() => void change(a.id, 'cancelled')}><X size={16} aria-hidden="true" />{busy === a.id ? 'Memproses...' : 'Batalkan'}</button>
          </div>}
        </div>
      </article>
    })}
  </section>
}
