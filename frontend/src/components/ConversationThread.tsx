import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { listMessages, readMessages, sendMessage, type Conversation, type Message } from '../api/consultations'
import { getExamination } from '../api/examinations'
import { getProviderExamination } from '../api/provider'
import { errorText } from '../api/client'
import { useAuth } from '../auth/useAuth'
import { useCare } from '../care/useCare'
import { useResource } from '../hooks/useResource'
import { EmptyState, ReviewBadge, RiskBadge } from './UI'
import { AppointmentList, AppointmentRequest } from './AppointmentList'
import { dateLabel } from '../utils/format'

export function ConversationThread({ conversation, onBack }: { conversation: Conversation; onBack: () => void }) {
  const { user } = useAuth()
  const care = useCare()
  const { subscribe, connected } = care.realtime
  const { refresh: refreshCare } = care
  const [messages, setMessages] = useState<Message[]>([])
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [hasOlder, setHasOlder] = useState(false)
  const [olderBusy, setOlderBusy] = useState(false)
  const [schedule, setSchedule] = useState(false)
  const [appointmentVersion, setAppointmentVersion] = useState(0)
  const bottom = useRef<HTMLDivElement>(null)
  const list = useRef<HTMLDivElement>(null)
  const provider = user?.role === 'provider'
  const context = useResource(async () => conversation.examination_id ? (provider ? getProviderExamination : getExamination)(conversation.examination_id) : null, conversation.id)
  const received = useRef(0)
  useEffect(() => {
    let active = true
    let inFlight = false
    async function refresh() {
      if (inFlight) return
      inFlight = true
      try {
        const latest = await listMessages(conversation.id)
        if (!active) return
        const ordered = [...latest].reverse()
        setMessages(previous => { const merged = new Map(previous.map(m => [m.id, m])); ordered.forEach(m => merged.set(m.id, m)); return [...merged.values()].sort((a, b) => a.id - b.id).slice(-500) })
        if (!received.current) setHasOlder(latest.length === 50)
        const incoming = latest.find(m => m.sender_id !== user?.id && !m.read_at)
        if (document.visibilityState === 'visible' && document.hasFocus() && incoming && incoming.id > received.current) {
          await readMessages(conversation.id, latest[0].id)
          received.current = incoming.id
          refreshCare()
        }
        setError('')
      } catch (err) { if (active) setError(errorText(err)) } finally { inFlight = false; if (active) setLoading(false) }
    }
    void refresh()
    const unsubscribe = subscribe(event => {
      if ((event.kind === 'message' || event.kind === 'messages_read') && event.payload?.conversation_id === conversation.id) void refresh()
    })
    const interval = setInterval(refresh, connected ? 30000 : 5000)
    const visibility = () => { if (document.visibilityState === 'visible') void refresh() }
    window.addEventListener('focus', visibility); document.addEventListener('visibilitychange', visibility)
    return () => { active = false; unsubscribe(); clearInterval(interval); window.removeEventListener('focus', visibility); document.removeEventListener('visibilitychange', visibility) }
  }, [conversation.id, subscribe, connected, user?.id, refreshCare])
  const latestMessageId = messages.at(-1)?.id
  useEffect(() => {
    if (!olderBusy && (!list.current || list.current.scrollHeight - list.current.scrollTop - list.current.clientHeight < 300 || sending)) bottom.current?.scrollIntoView({ block: 'nearest' })
  }, [latestMessageId, loading, olderBusy, sending])
  async function older() {
    setOlderBusy(true); setError('')
    try { const page = await listMessages(conversation.id, messages[0]?.id); setMessages(previous => [...page.reverse(), ...previous]); setHasOlder(page.length === 50) }
    catch (err) { setError(errorText(err)) } finally { setOlderBusy(false) }
  }
  async function submit(event: FormEvent) {
    event.preventDefault(); if (sending || !draft.trim()) return
    setSending(true); setError('')
    try { const message = await sendMessage(conversation.id, draft); setMessages(previous => [...previous.filter(m => m.id !== message.id), message].sort((a, b) => a.id - b.id)); setDraft(''); refreshCare(); bottom.current?.scrollIntoView({ block: 'nearest' }) }
    catch { setError('Gagal mengirim pesan. Coba lagi.') } finally { setSending(false) }
  }
  return <section className="conversation-thread" aria-label="Percakapan konsultasi"><header className="conversation-header"><button className="button button-secondary chat-back" onClick={onBack}>Kembali ke percakapan</button><div className="conversation-heading"><div><h2>{provider ? conversation.patient_name : conversation.provider_name}</h2>
    <p className="muted">{provider ? 'Pasien' : 'Tenaga Kesehatan'}</p></div>
    <div className="consultation-actions">{!provider && <button className="button button-secondary" aria-expanded={schedule} onClick={() => setSchedule(!schedule)}>Jadwalkan konsultasi</button>}<button className="button" disabled={!care.realtime.connected || !['idle', 'ended', 'failed'].includes(care.voice.state)} onClick={() => void care.voice.start(conversation)}>Panggilan suara</button></div></div>
    {conversation.examination_id && <div className="conversation-context"><Link to={provider ? `/provider/examinations/${conversation.examination_id}` : `/patient/result/${conversation.examination_id}`}>Lihat pemeriksaan #{conversation.examination_id}</Link>
      {context.loading ? <span>Memuat konteks...</span> : context.error ? <span role="alert">Konteks pemeriksaan tidak dapat dimuat.</span> : context.value && <><span>{dateLabel(context.value.examination.examined_at)}</span><RiskBadge value={context.value.risk_result?.risk_category} /><ReviewBadge value={context.value.medical_review?.review_status} /></>}
    </div>}
  </header>
    <div className="message-list" ref={list} aria-label="Riwayat pesan" tabIndex={0}>
      {hasOlder && <button className="button button-secondary" disabled={olderBusy} onClick={() => void older()}>{olderBusy ? 'Memuat...' : 'Muat pesan sebelumnya'}</button>}
      {loading && <p role="status">Memuat pesan...</p>}{!loading && !messages.length && <EmptyState text="Belum ada pesan. Mulai konsultasi melalui pesan teks." />}
      {messages.map(message => <article className={`message-bubble ${message.sender_id === user?.id ? 'is-own' : ''}`} key={message.id}><strong>{message.sender_name}</strong><p className="message-content">{message.message}</p><small>{new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(message.created_at))}{message.sender_id === user?.id && ` · ${message.read_at ? 'Dibaca' : 'Terkirim'}`}</small></article>)}
      <div ref={bottom} />
    </div>
    {error && <p className="form-error" role="alert">{error}</p>}
    <form className="message-composer" onSubmit={submit}><label className="sr-only" htmlFor="message-draft">Tulis pesan konsultasi</label><textarea id="message-draft" rows={2} placeholder="Tulis pesan..." value={draft} maxLength={3000} onChange={e => setDraft(e.target.value)} required /><button className="button" disabled={sending || !draft.trim()}>{sending ? 'Mengirim...' : 'Kirim'}</button></form>
    {!care.realtime.connected && <p className="muted small" role="status">Menghubungkan layanan waktu nyata. Pesan tetap tersimpan dan diperbarui berkala.</p>}
    {schedule && <AppointmentRequest conversationId={conversation.id} onSaved={() => { setSchedule(false); setAppointmentVersion(v => v + 1); refreshCare() }} />}
    <AppointmentList key={appointmentVersion} conversationId={conversation.id} />
  </section>
}
