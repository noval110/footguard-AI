import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowRight, Search, ShieldCheck } from 'lucide-react'
import { errorText } from '../api/client'
import { createRiskResult, getProviderExamination, listProviderPatients, saveMedicalReview } from '../api/provider'
import type { ExaminationDetail, ProviderPatient, ReviewStatus, RiskCategory } from '../api/types'
import { ErrorState, LoadingState } from '../components/Feedback'
import { EmptyState, PageHeader, ReviewBadge, RiskBadge } from '../components/UI'
import { useResource } from '../hooks/useResource'
import { dateLabel, examStatusLabel } from '../utils/format'
import { VisualAnalysis } from '../components/VisualAnalysis'
import { ExaminationCard, MetricCard } from '../components/ExaminationUI'
import { visualSummary } from '../utils/examination'

const factors = [
  ['has_lops', 'LOPS / neuropati'], ['has_pad', 'Penyakit arteri perifer (PAD)'],
  ['foot_deformity', 'Deformitas kaki'], ['previous_ulcer', 'Riwayat ulkus'],
  ['previous_amputation', 'Riwayat amputasi'], ['kidney_failure', 'Gagal ginjal / ESRD'],
] as const
function age(birth: string | null) {
  if (!birth) return 'Belum diisi'
  const born = new Date(birth)
  const today = new Date()
  const years = today.getFullYear() - born.getFullYear() - (today.getMonth() < born.getMonth() || (today.getMonth() === born.getMonth() && today.getDate() < born.getDate()) ? 1 : 0)
  return `${years} th`
}
const latestStatus = (item: ProviderPatient) => item.latest_review ? <ReviewBadge value={item.latest_review.review_status} /> : <span>Belum direview</span>

export function ProviderDashboard() {
  const { value, loading, error, reload } = useResource(async () => {
    const patients = await listProviderPatients()
    const queue = patients.filter(item => item.latest_examination && !item.latest_review).slice(0, 6)
    const details = await Promise.all(queue.map(item => getProviderExamination(item.latest_examination!.id)))
    return { patients, queue: queue.map((item, index) => ({ item, detail: details[index] })) }
  })
  if (loading) return <LoadingState label="Memuat dashboard tenaga kesehatan..." />
  if (error || !value) return <ErrorState message={error || 'Dashboard belum tersedia.'} retry={reload} />
  const exams = value.patients.filter(item => item.latest_examination)
  const needsReview = exams.filter(item => !item.latest_review)
  const reviewed = exams.filter(item => !!item.latest_review)
  const newExams = exams.filter(item => item.latest_examination?.status === 'pending')
  return <><section className="dashboard-welcome provider-welcome"><div><span className="eyebrow">RUANG TENAGA KESEHATAN</span><h1>Tinjauan Pemeriksaan</h1><p>Mulai dari pemeriksaan yang membutuhkan perhatian Anda.</p></div><div className="dashboard-welcome-action"><span>Antrean saat ini</span><strong>{needsReview.length} perlu ditinjau</strong><Link className="button button-light" to="#reviews">Lihat Antrean <ArrowRight size={16} /></Link></div></section><section className="provider-metrics"><MetricCard label="Perlu ditinjau" value={String(needsReview.length)} description="Pemeriksaan terakhir tanpa review" /><MetricCard label="Pemeriksaan baru" value={String(newExams.length)} description="Pemeriksaan yang masih diproses" /><MetricCard label="Review tercatat" value={String(reviewed.length)} description="Pada pemeriksaan terakhir pasien" /></section><section className="provider-worklist" id="reviews"><div className="section-title-row"><div><span className="eyebrow">PRIORITAS KERJA</span><h2>Perlu Ditinjau</h2><p className="muted">Temuan AI membantu melihat foto. Keputusan klinis tetap dicatat oleh tenaga kesehatan.</p></div><Link className="inline-link" to="/provider/patients">Lihat semua pasien <ArrowRight size={16} /></Link></div>{value.queue.length ? <div className="provider-queue-list">{value.queue.map(({ item, detail }) => <div className="provider-queue-item" key={item.patient.id}><div className="provider-queue-person"><span className="mini-avatar">{item.name.split(' ').slice(0, 2).map(part => part[0]).join('')}</span><div><strong>{item.name}</strong><small>{item.email}</small></div></div><ExaminationCard detail={detail} provider /></div>)}</div> : <div className="card"><EmptyState text="Belum ada pemeriksaan yang menunggu review." /></div>}</section><section className="card provider-context"><div><span className="eyebrow">CATATAN KLINIS</span><h2>Data visual dan faktor klinis saling melengkapi.</h2><p>Periksa foto asli, visualisasi AI, informasi kesehatan pasien, lalu catat penilaian risiko dan review secara terpisah.</p></div><ShieldCheck size={41} strokeWidth={1.3} /></section></>
}

export function PatientListPage() {
  const { value, loading, error, reload } = useResource(listProviderPatients)
  const [search, setSearch] = useState('')
  const [risk, setRisk] = useState('all')
  const [review, setReview] = useState('all')
  if (loading) return <LoadingState label="Memuat daftar pasien..." />
  if (error || !value) return <ErrorState message={error || 'Daftar pasien belum tersedia.'} retry={reload} />
  const rows = value.filter(item => item.name.toLowerCase().includes(search.toLowerCase()) && (risk === 'all' || item.latest_risk_result?.risk_category === risk) && (review === 'all' || item.latest_review?.review_status === review))
  return <><PageHeader eyebrow="MANAJEMEN PASIEN" title="Daftar pasien" description="Temukan pemeriksaan terakhir dan status review pasien." /><div className="card table-card"><div className="card-heading"><h3>Pasien terpantau</h3><span className="muted small">{rows.length} pasien</span></div><div className="filters"><label className="search-field"><Search size={16} /><input placeholder="Cari nama pasien..." value={search} onChange={e => setSearch(e.target.value)} aria-label="Cari nama pasien" /></label><label>Risiko<select value={risk} onChange={e => setRisk(e.target.value)}><option value="all">Semua risiko</option><option value="low">Rendah</option><option value="moderate">Sedang</option><option value="high">Tinggi</option></select></label><label>Status review<select value={review} onChange={e => setReview(e.target.value)}><option value="all">Semua status</option><option value="pending">Menunggu</option><option value="approved">Disetujui</option><option value="needs_followup">Perlu tindak lanjut</option></select></label></div>{rows.length ? <div className="table-wrap"><table><thead><tr><th>Nama</th><th>Usia</th><th>Pemeriksaan terakhir</th><th>Kategori risiko</th><th>Status review</th><th>Aksi</th></tr></thead><tbody>{rows.map(item => <tr key={item.patient.id}><td data-label="Nama"><span className="patient-name"><span className="mini-avatar">{item.name.split(' ').slice(0, 2).map(part => part[0]).join('')}</span>{item.name}</span></td><td data-label="Usia">{age(item.patient.birth_date)}</td><td data-label="Pemeriksaan terakhir">{item.latest_examination ? dateLabel(item.latest_examination.examined_at) : 'Belum ada'}</td><td data-label="Kategori risiko">{item.latest_risk_result ? <RiskBadge value={item.latest_risk_result.risk_category} /> : 'Belum ada'}</td><td data-label="Status review">{latestStatus(item)}</td><td data-label="Aksi"><Link to={`/provider/patients/${item.patient.id}`} className="table-link">Lihat <ArrowRight size={14} /></Link></td></tr>)}</tbody></table></div> : <EmptyState text="Tidak ada pasien yang cocok dengan filter." />}</div></>
}

export function ProviderPatientPage() {
  const { id } = useParams()
  const { value, loading, error, reload } = useResource(async () => {
    const patients = await listProviderPatients()
    const item = patients.find(record => record.patient.id === Number(id))
    const detail = item?.latest_examination ? await getProviderExamination(item.latest_examination.id) : null
    return { item, detail }
  }, id)
  if (loading) return <LoadingState label="Memuat profil pasien..." />
  if (error || !value) return <ErrorState message={error || 'Profil pasien belum tersedia.'} retry={reload} />
  const { item, detail } = value
  if (!item) return <ErrorState message="Pasien tidak ditemukan." />
  return <><Link className="back-link" to="/provider/patients">← Kembali ke daftar pasien</Link><PageHeader eyebrow={`PASIEN / ${item.patient.id}`} title={item.name} description={`${age(item.patient.birth_date)} · ${item.patient.diabetes_type ? `Diabetes ${item.patient.diabetes_type}` : 'Informasi diabetes belum lengkap'}`} /><section className="card provider-patient-summary"><div><span className="eyebrow">RINGKASAN PASIEN</span><h2>Informasi yang tersedia</h2></div><div className="provider-patient-facts"><div><span>Tanggal lahir</span><strong>{item.patient.birth_date ? dateLabel(item.patient.birth_date) : 'Belum diisi'}</strong></div><div><span>Telepon</span><strong>{item.patient.phone || 'Belum diisi'}</strong></div><div><span>Email</span><strong>{item.email}</strong></div></div></section><section className="provider-patient-latest"><div className="section-title-row"><div><span className="eyebrow">PEMERIKSAAN TERAKHIR</span><h2>Catatan terbaru</h2></div></div>{detail ? <><ExaminationCard detail={detail} provider /><div className="provider-patient-columns"><section className="card"><span className="eyebrow">ANALISIS VISUAL</span><h3>{visualSummary(detail.ai_results)}</h3><p className="muted">Hasil foto membantu review dan bukan diagnosis mandiri.</p></section><section className="card"><span className="eyebrow">PENILAIAN KLINIS</span><h3>{detail.risk_result ? 'Risiko telah dinilai' : 'Risiko belum dinilai'}</h3>{detail.risk_result ? <RiskBadge value={detail.risk_result.risk_category} /> : <p className="muted">Belum ada kategori risiko klinis.</p>}{detail.medical_review && <p className="muted">Catatan review: {detail.medical_review.notes}</p>}</section></div></> : <div className="card"><EmptyState text="Pasien belum membuat pemeriksaan." /></div>}</section><div className="safety-note"><ShieldCheck size={18} />Daftar pasien saat ini menyediakan pemeriksaan terakhir. Riwayat lengkap pasien belum tersedia pada API tenaga kesehatan.</div></>
}

function ClinicalRiskForm({ id, onSaved }: { id: number; onSaved: () => void }) {
  const [category, setCategory] = useState<RiskCategory | ''>('')
  const [explanation, setExplanation] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  async function submit(e: FormEvent<HTMLFormElement>) { e.preventDefault(); if (saving || !category) return; setSaving(true); setError(''); try { await createRiskResult(id, { risk_category: category, explanation }); onSaved() } catch (err) { setError(errorText(err)) } finally { setSaving(false) } }
  return <form className="card" onSubmit={submit}><span className="eyebrow">04 — CLINICAL RISK ASSESSMENT</span><h3>Tetapkan kategori risiko klinis</h3><p className="muted">Masukkan penilaian berdasarkan faktor klinis. Sistem tidak menghitung kategori secara otomatis.</p><label className="field">Kategori risiko<select value={category} onChange={e => setCategory(e.target.value as RiskCategory)} required><option value="">Pilih kategori</option><option value="low">Rendah</option><option value="moderate">Sedang</option><option value="high">Tinggi</option></select></label><label className="field">Penjelasan klinis<textarea rows={4} value={explanation} onChange={e => setExplanation(e.target.value)} maxLength={5000} required placeholder="Jelaskan dasar penilaian klinis..." /></label>{error && <p className="form-error" role="alert">{error}</p>}<button className="button" type="submit" disabled={saving || !category || !explanation.trim()}>{saving ? 'Menyimpan...' : 'Simpan Risiko Klinis'}</button></form>
}

function MedicalReviewForm({ detail, onSaved }: { detail: ExaminationDetail; onSaved: () => void }) {
  const [notes, setNotes] = useState(detail.medical_review?.notes || '')
  const [status, setStatus] = useState<ReviewStatus>(detail.medical_review?.review_status || 'pending')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  async function submit(e: FormEvent<HTMLFormElement>) { e.preventDefault(); if (saving || !detail.risk_result) return; setSaving(true); setError(''); setMessage(''); try { await saveMedicalReview(detail.examination.id, { notes, review_status: status }); setMessage('Review berhasil disimpan.'); onSaved() } catch (err) { setError(errorText(err)) } finally { setSaving(false) } }
  return <form className="card review-form" onSubmit={submit}><span className="eyebrow">06 — HEALTHCARE PROVIDER REVIEW</span><h3>Review tenaga kesehatan</h3>{!detail.risk_result && <p className="muted">Simpan kategori risiko klinis sebelum membuat review.</p>}<label className="field">Catatan klinis<textarea value={notes} onChange={e => setNotes(e.target.value)} rows={5} maxLength={5000} required placeholder="Tuliskan temuan dan tindak lanjut..." /></label><label className="field">Status review<select value={status} onChange={e => setStatus(e.target.value as ReviewStatus)}><option value="pending">Menunggu</option><option value="approved">Disetujui</option><option value="needs_followup">Perlu tindak lanjut</option></select></label>{error && <p className="form-error" role="alert">{error}</p>}{message && <p className="success-message" role="status">{message}</p>}<button className="button" type="submit" disabled={saving || !detail.risk_result || !notes.trim()}>{saving ? 'Menyimpan...' : 'Simpan Review'} <ArrowRight size={16} /></button></form>
}

export function ExaminationPage() {
  const { id } = useParams()
  const examId = Number(id)
  const validId = Number.isSafeInteger(examId) && examId > 0
  const resource = useResource(async () => {
    const [detail, patients] = await Promise.all([getProviderExamination(examId), listProviderPatients()])
    return { detail, name: patients.find(item => item.patient.id === detail.patient.id)?.name || `Pasien #${detail.patient.id}` }
  }, validId ? examId : 'invalid')
  if (!validId) return <ErrorState message="ID pemeriksaan tidak valid." />
  if (resource.loading) return <LoadingState label="Memuat detail pemeriksaan..." />
  if (resource.error || !resource.value) return <ErrorState message={resource.error || 'Pemeriksaan tidak tersedia.'} retry={resource.reload} />
  const { detail, name: patientName } = resource.value
  return <><Link className="back-link" to={`/provider/patients/${detail.patient.id}`}>← Kembali ke profil pasien</Link><PageHeader eyebrow={`REVIEW PEMERIKSAAN / #${examId}`} title="Tinjau Pemeriksaan Kaki" description={`${patientName} · ${dateLabel(detail.examination.examined_at)} · ${examStatusLabel[detail.examination.status]}`} /><section className="card provider-review-summary"><div><span className="eyebrow">RINGKASAN REVIEW</span><h2>{patientName}</h2><p>{visualSummary(detail.ai_results)}</p></div><div><span>Risiko klinis</span>{detail.risk_result ? <RiskBadge value={detail.risk_result.risk_category} /> : <strong>Belum dinilai</strong>}<span>Review</span>{detail.medical_review ? <ReviewBadge value={detail.medical_review.review_status} /> : <strong>Belum ditinjau</strong>}</div></section><section className="card provider-visual"><span className="eyebrow">01 / FOTO & ANALISIS AI</span><h2>Dokumentasi visual</h2><VisualAnalysis detail={detail} results={detail.ai_results} /></section><div className="provider-review-grid"><section className="card"><span className="eyebrow">02 / FAKTOR KLINIS</span><h2>Informasi kesehatan</h2>{detail.assessment ? <div className="factor-list">{factors.map(([key, label]) => <div key={key}><span>{label}</span><strong className={detail.assessment?.[key] ? 'factor-yes' : ''}>{detail.assessment?.[key] ? 'Ya' : 'Tidak'}</strong></div>)}</div> : <p className="muted">Belum ada penilaian klinis terkait pemeriksaan ini.</p>}</section>{detail.risk_result ? <section className="card"><span className="eyebrow">03 / RISIKO KLINIS</span><h2>Penilaian Risiko Kaki Diabetik</h2><RiskBadge value={detail.risk_result.risk_category} /><p>{detail.risk_result.explanation}</p></section> : <ClinicalRiskForm id={examId} onSaved={resource.reload} />}</div><div className="provider-review-form-area"><MedicalReviewForm key={`${examId}-${detail.medical_review?.id || 'new'}`} detail={detail} onSaved={resource.reload} /></div><div className="safety-note"><ShieldCheck size={18} />Analisis AI adalah alat bantu keputusan dan tidak menggantikan penilaian klinis.</div></>
}
