import { useEffect, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { createConversation, getConversation, listConversations, listConsultationProviders, type Conversation } from '../api/consultations'
import { listProviderPatients } from '../api/provider'
import { errorText } from '../api/client'
import { useAuth } from '../auth/useAuth'
import { useCare } from '../care/useCare'
import { useResource } from '../hooks/useResource'
import { ErrorState, LoadingState } from '../components/Feedback'
import { EmptyState, PageHeader } from '../components/UI'
import { ConversationThread } from '../components/ConversationThread'
import { AppointmentList } from '../components/AppointmentList'

export function ConsultationPage() {
  const { user } = useAuth()
  const care = useCare()
  const [params, setParams] = useSearchParams()
  const resource = useResource(listConversations)
  const { reload } = resource
  const { subscribe } = care.realtime
  const [selected, setSelected] = useState<Conversation | null>(null)
  const [error, setError] = useState('')
  const [showNew, setShowNew] = useState(Boolean(params.get('examination')))
  const id = Number(params.get('conversation'))
  useEffect(() => {
    let active = true
    if (id > 0) getConversation(id).then(c => { if (active) { setSelected(c); setError('') } }).catch(() => { if (active) { setSelected(null); setError('Anda tidak memiliki akses ke percakapan ini atau percakapan tidak tersedia.') } })

    return () => { active = false }
  }, [id])
  useEffect(() => {
    const unsubscribe = subscribe(event => { if (['message', 'messages_read', 'appointment'].includes(event.kind)) reload() })
    const interval = setInterval(reload, 30000)
    return () => { unsubscribe(); clearInterval(interval) }
  }, [subscribe, reload])
  const activeConversation = id > 0 && selected?.id === id ? selected : null
  const select = (c: Conversation) => { setSelected(c); setParams({ conversation: String(c.id) }) }
  if (resource.loading && !resource.value) return <LoadingState label="Memuat percakapan..." />
  if (resource.error || !resource.value) return <ErrorState message={resource.error || 'Percakapan tidak tersedia.'} retry={resource.reload} />
  return <><PageHeader title={user?.role === 'provider' ? 'Pesan & Konsultasi' : 'Konsultasi'} description="Tindak lanjut pemeriksaan bersama tenaga kesehatan." action={<button className="button button-secondary" onClick={() => setShowNew(!showNew)} aria-expanded={showNew}>Percakapan baru</button>} />
    <p className="safety-note">Fitur konsultasi DIA SCAN digunakan untuk tindak lanjut pemeriksaan. Untuk kondisi darurat, segera hubungi layanan kesehatan terdekat.</p>
    {showNew && <NewConversation initialExam={params.get('examination') || ''} onCreated={c => { select(c); setShowNew(false); resource.reload() }} />}
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className={`consultation-workspace ${activeConversation ? 'has-selection' : ''}`}><aside className="conversation-list card" aria-label="Daftar percakapan"><h2>Percakapan</h2>
      {!resource.value.length && <EmptyState text="Belum ada percakapan." />}
      {resource.value.map(c => <button className={`conversation-item ${id === c.id ? 'is-active' : ''}`} key={c.id} onClick={() => select(c)} aria-pressed={id === c.id}><strong>{user?.role === 'provider' ? c.patient_name : c.provider_name}</strong><span className="conversation-preview">{c.last_message || 'Belum ada pesan'}</span><small>{new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(c.updated_at))}{c.examination_id ? ` · Pemeriksaan #${c.examination_id}` : ''}</small>{c.unread_count > 0 && <span className="badge" aria-label={`${c.unread_count} pesan belum dibaca`}>{c.unread_count} baru</span>}</button>)}
    </aside>{activeConversation ? <ConversationThread key={activeConversation.id} conversation={activeConversation} onBack={() => { setSelected(null); setParams({}) }} /> : <div className="card conversation-placeholder"><EmptyState text="Pilih percakapan atau mulai konsultasi baru." /></div>}</div>
  </>
}

function NewConversation({ onCreated, initialExam }: { initialExam: string; onCreated: (conversation: Conversation) => void }) {
  const { user } = useAuth()
  const provider = user?.role === 'provider'
  const options = useResource(async () => provider ? (await listProviderPatients()).map(p => ({ id: p.patient.id, name: p.name })) : listConsultationProviders())
  const [participant, setParticipant] = useState('')
  const [exam, setExam] = useState(initialExam)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function submit(event: FormEvent) {
    event.preventDefault(); if (busy) return
    setBusy(true); setError('')
    try { onCreated(await createConversation({ [provider ? 'patient_id' : 'provider_id']: Number(participant), examination_id: exam ? Number(exam) : undefined })) }
    catch (err) { setError(errorText(err)) } finally { setBusy(false) }
  }
  return <form className="card new-conversation" onSubmit={submit}><h2>Percakapan baru</h2>{options.loading ? <p role="status">Memuat peserta...</p> : options.error ? <ErrorState message={options.error} retry={options.reload} /> : <label className="field">{provider ? 'Pasien' : 'Tenaga Kesehatan'}<select value={participant} onChange={e => setParticipant(e.target.value)} required><option value="">Pilih peserta</option>{options.value?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>}
    <label className="field">Nomor pemeriksaan (opsional)<input type="number" min={1} step={1} value={exam} onChange={e => setExam(e.target.value)} /></label>
    <p className="muted small">Pemeriksaan harus milik pasien dalam percakapan ini.</p>{error && <p role="alert" className="form-error">{error}</p>}
    <button className="button" disabled={busy || !participant}>{busy ? 'Membuat...' : 'Mulai percakapan'}</button>
  </form>
}

export function SchedulePage() { return <><PageHeader title="Jadwal Konsultasi" description="Permintaan, konfirmasi, dan tindak lanjut konsultasi." /><AppointmentList /></> }
