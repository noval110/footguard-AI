import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { ArrowRight, BookOpen, Camera, CircleAlert, ClipboardCheck, Download, FileText, HeartHandshake, Home, Info } from 'lucide-react'
import { getProfile } from '../api/auth'
import { createAssessment, getLatestAssessment } from '../api/assessments'
import { errorText, isNotFound } from '../api/client'
import { createExamination, getExamination, listExaminations } from '../api/examinations'
import { getPatient, updatePatient } from '../api/patient'
import type { Assessment, AssessmentInput, ExaminationDetail, Patient, PatientUpdate, User } from '../api/types'
import { useAuth } from '../auth/useAuth'
import { ErrorState, LoadingState, NoExaminations } from '../components/Feedback'
import { ButtonLink, EmptyState, FootImageCard, Logo, PageHeader, ReviewBadge, RiskBadge, SafetyNote } from '../components/UI'
import { education } from '../data/education'
import { useResource } from '../hooks/useResource'
import { dateLabel, examStatusLabel } from '../utils/format'
import { VisualAnalysis } from '../components/VisualAnalysis'
import { ExaminationCard, MetricCard, StatusBadge } from '../components/ExaminationUI'
import { latestPhoto, visualSummary } from '../utils/examination'

const questions: { key: ClinicalKey; label: string; help: string }[] = [
  { key: 'previous_ulcer', label: 'Pernah mengalami ulkus kaki sebelumnya?', help: 'Termasuk luka yang sudah sembuh.' },
  { key: 'has_lops', label: 'Memiliki neuropati atau penurunan sensasi?', help: 'Misalnya mati rasa atau sulit merasakan sentuhan.' },
  { key: 'has_pad', label: 'Memiliki penyakit arteri perifer (PAD)?', help: 'Gangguan aliran darah ke tungkai yang pernah dinyatakan tenaga medis.' },
  { key: 'foot_deformity', label: 'Terdapat deformitas kaki?', help: 'Perubahan bentuk kaki yang telah diketahui.' },
  { key: 'previous_amputation', label: 'Pernah mengalami amputasi?', help: 'Termasuk sebagian jari atau kaki.' },
  { key: 'kidney_failure', label: 'Memiliki gagal ginjal atau ESRD?', help: 'Riwayat gagal ginjal tahap akhir.' },
]
type ClinicalKey = Exclude<keyof AssessmentInput, 'notes'>
type DashboardData = { user: User; patient: Patient; assessment: Assessment | null; examinationCount: number; examinations: ExaminationDetail[] }
async function loadDashboard(): Promise<DashboardData> {
  const [user, patient, assessment, exams] = await Promise.all([
    getProfile(), getPatient(), getLatestAssessment().catch(error => { if (isNotFound(error)) return null; throw error }), listExaminations(),
  ])
  const examinations = await Promise.all(exams.slice(0, 8).map(exam => getExamination(exam.id)))
  return { user, patient, assessment, examinationCount: exams.length, examinations }
}

export function PatientDashboard() {
  const { value, loading, error, reload } = useResource(loadDashboard)
  if (loading) return <LoadingState label="Memuat dashboard Anda..." />
  if (error || !value) return <ErrorState message={error || 'Dashboard belum tersedia.'} retry={reload} />
  const latest = value.examinations[0]
  const name = value.user.name.split(' ')[0]
  const next = !latest
    ? { title: 'Mulai pemeriksaan pertama', text: 'Lengkapi informasi kesehatan dan ambil foto kaki Anda.', to: '/patient/assessment', label: 'Mulai Pemeriksaan' }
    : latest.examination.status === 'reviewed'
      ? { title: 'Lanjutkan pemantauan berkala', text: 'Hasil terakhir telah ditinjau. Buat catatan baru saat diperlukan.', to: '/patient/assessment', label: 'Pemeriksaan Baru' }
      : !latestPhoto(latest, 'left') || !latestPhoto(latest, 'right')
        ? { title: 'Lengkapi foto kaki', text: 'Tambahkan foto sisi kaki yang belum diperiksa.', to: `/patient/scan?examination=${latest.examination.id}`, label: 'Tambah Foto Kaki' }
        : !latest.medical_review
          ? { title: 'Pantau hasil review', text: 'Hasil visual tersimpan. Penilaian dan catatan tenaga kesehatan akan tampil setelah tersedia.', to: `/patient/result/${latest.examination.id}`, label: 'Lihat Pemeriksaan' }
          : { title: 'Lihat hasil terbaru', text: 'Baca kembali catatan pemeriksaan dan langkah lanjutan.', to: `/patient/result/${latest.examination.id}`, label: 'Lihat Hasil' }
  return <>
    <section className="dashboard-welcome">
      <div><span className="eyebrow">RUANG PASIEN</span><h1>Selamat datang, {name}</h1><p>Lihat kondisi pemeriksaan terakhir dan langkah yang perlu Anda lakukan berikutnya.</p></div>
      <div className="dashboard-welcome-action"><span>{latest ? 'Pemeriksaan terbaru' : 'Mulai pemantauan'}</span>{latest ? <StatusBadge status={latest.examination.status} /> : <strong>Belum ada pemeriksaan</strong>}<ButtonLink to="/patient/assessment">Pemeriksaan Baru</ButtonLink></div>
    </section>
    <section className="dashboard-overview" aria-label="Ringkasan kondisi terbaru">
      <MetricCard label="Pemeriksaan terakhir" value={latest ? dateLabel(latest.examination.examined_at) : 'Belum ada'} description={latest ? examStatusLabel[latest.examination.status] : 'Mulai pemeriksaan pertama Anda'} />
      <MetricCard label="Hasil visual" value={latest ? visualSummary(latest.ai_results) : 'Belum ada'} description="Berdasarkan foto yang sudah dianalisis" />
      <MetricCard label="Penilaian risiko" value={latest?.risk_result ? { low: 'Rendah', moderate: 'Sedang', high: 'Tinggi' }[latest.risk_result.risk_category] : 'Belum dinilai'} description="Ditentukan melalui penilaian klinis" />
      <MetricCard label="Review tenaga kesehatan" value={latest?.medical_review ? { pending: 'Menunggu', approved: 'Disetujui', needs_followup: 'Perlu tindak lanjut' }[latest.medical_review.review_status] : 'Belum ditinjau'} description="Catatan tenaga kesehatan" />
    </section>
    <div className="dashboard-main"><section className="card next-action"><span className="eyebrow">LANGKAH SELANJUTNYA</span><h2>{next.title}</h2><p>{next.text}</p><ButtonLink to={next.to}>{next.label}</ButtonLink></section><section className="card latest-summary"><div className="card-heading"><div><span className="eyebrow">PEMERIKSAAN TERAKHIR</span><h3>{latest ? dateLabel(latest.examination.examined_at) : 'Belum ada pemeriksaan'}</h3></div>{latest && <StatusBadge status={latest.examination.status} />}</div>{latest ? <><div className="foot-pair"><FootImageCard side="Kiri" small src={latestPhoto(latest, 'left')?.image_url} /><FootImageCard side="Kanan" small src={latestPhoto(latest, 'right')?.image_url} /></div><p className="visual-summary">{visualSummary(latest.ai_results)}</p><div className="data-line"><span>Risiko klinis</span>{latest.risk_result ? <RiskBadge value={latest.risk_result.risk_category} /> : <strong>Belum dinilai</strong>}</div><div className="data-line"><span>Review</span>{latest.medical_review ? <ReviewBadge value={latest.medical_review.review_status} /> : <strong>Belum ditinjau</strong>}</div><Link className="inline-link" to={`/patient/result/${latest.examination.id}`}>Lihat hasil lengkap <ArrowRight size={16} /></Link></> : <NoExaminations />}</section></div>
    {value.examinations.length > 1 && <section className="recent-history"><div className="section-title-row"><div><span className="eyebrow">RIWAYAT SINGKAT</span><h2>Pemeriksaan sebelumnya</h2></div><Link className="inline-link" to="/patient/history">Semua riwayat <ArrowRight size={16} /></Link></div><div className="examination-list">{value.examinations.slice(1, 4).map(detail => <ExaminationCard key={detail.examination.id} detail={detail} />)}</div></section>}
    {!value.patient.birth_date && <div className="safety-note"><Info size={18} /><span>Profil kesehatan Anda belum lengkap. <Link to="/patient/profile" className="inline-link">Lengkapi profil <ArrowRight size={14} /></Link></span></div>}
  </>
}

export function AssessmentPage() {
  const navigate = useNavigate()
  const [answers, setAnswers] = useState<Partial<Record<ClinicalKey, boolean>>>({})
  const [assessmentId, setAssessmentId] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const complete = questions.every(q => answers[q.key] !== undefined)
  async function continueFlow() {
    if (!complete || submitting) return
    setSubmitting(true); setError('')
    try {
      const id = assessmentId ?? (await createAssessment(answers as AssessmentInput)).id
      setAssessmentId(id)
      const exam = await createExamination(id)
      navigate(`/patient/scan?examination=${exam.id}`)
    } catch (err) { setError(errorText(err)) }
    finally { setSubmitting(false) }
  }
  return <><PageHeader eyebrow="PEMERIKSAAN BARU / INFORMASI KESEHATAN" title="Pemeriksaan Kaki Diabetik" description="Dokumentasikan kondisi kaki Anda dan gunakan analisis AI untuk membantu menemukan area yang perlu diperhatikan." /><div className="flow-card"><div className="assessment-context"><Info size={18} /><span>Analisis AI tidak menentukan apakah seseorang menderita diabetes. FootGuard membantu pemantauan kaki pada pasien diabetes.</span></div><div className="flow-intro"><h2>Mulai dari informasi kesehatan Anda</h2><p>Jawab sesuai informasi yang Anda ketahui. Jika ragu, bicarakan dengan tenaga kesehatan.</p></div><div className="question-list">{questions.map(({ key, label, help }, i) => <div className="question-row" key={key}><div><span className="question-number">{String(i + 1).padStart(2, '0')}</span><strong>{label}</strong><small>{help}</small></div><div className="choice-group" role="group" aria-label={label}><button type="button" className={answers[key] === false ? 'chosen' : ''} onClick={() => setAnswers({ ...answers, [key]: false })}>Tidak</button><button type="button" className={answers[key] === true ? 'chosen' : ''} onClick={() => setAnswers({ ...answers, [key]: true })}>Ya</button></div></div>)}</div>{error && <p className="form-error" role="alert">{error}</p>}<div className="flow-actions"><Link to="/patient/dashboard" className="button button-secondary">Sebelumnya</Link><button className="button" onClick={continueFlow} disabled={!complete || submitting}>{submitting ? 'Menyimpan...' : 'Lanjutkan ke Foto'} {!submitting && <ArrowRight size={16} />}</button></div><p className="form-hint">{Object.keys(answers).length} dari {questions.length} pertanyaan terjawab.</p></div></>
}

export function ResultPage() {
  const { id } = useParams()
  const examId = Number(id)
  const validId = Number.isSafeInteger(examId) && examId > 0
  const { value: detail, loading, error, reload } = useResource(() => getExamination(examId), validId ? examId : 'invalid')
  if (!validId) return <ErrorState message="ID pemeriksaan tidak valid." />
  if (loading) return <LoadingState label="Memuat hasil pemeriksaan..." />
  if (error || !detail) return <ErrorState message={error || 'Hasil tidak tersedia.'} retry={reload} />
  const examination = detail
  const ai = examination.ai_results
  const risk = examination.risk_result
  const sides = [latestPhoto(examination, 'left') && 'Kiri', latestPhoto(examination, 'right') && 'Kanan'].filter(Boolean).join(' & ') || 'Belum ada foto'
  function download() {
    const report = `FootGuard — Ringkasan pemeriksaan
Tanggal: ${dateLabel(examination.examination.examined_at)}
Status: ${examStatusLabel[examination.examination.status]}
Hasil visual: ${visualSummary(ai)}
Kategori risiko klinis: ${risk?.risk_category || 'Belum tersedia'}
Penjelasan klinis: ${risk?.explanation || '-'}
Review tenaga kesehatan: ${examination.medical_review?.notes || 'Belum tersedia'}

Hasil ini bukan diagnosis mandiri.`
    const url = URL.createObjectURL(new Blob([report], { type: 'text/plain;charset=utf-8' }))
    const link = document.createElement('a'); link.href = url; link.download = `footguard-${examId}.txt`; link.click(); URL.revokeObjectURL(url)
  }
  return <>
    <PageHeader eyebrow={`PEMERIKSAAN #${examId}`} title="Hasil Pemeriksaan Kaki" description={`${dateLabel(detail.examination.examined_at)} · ${sides}`} action={<StatusBadge status={detail.examination.status} />} />
    <section className="card examination-overview"><div className="section-title-row"><div><span className="eyebrow">RINGKASAN PEMERIKSAAN</span><h2>Gambaran utama</h2></div><span className="small muted">Hasil tersimpan dan dapat dibuka kembali</span></div><div className="overview-grid"><div><span>Sisi kaki</span><strong>{sides}</strong></div><div><span>Hasil visual</span><strong>{visualSummary(ai)}</strong></div><div><span>Penilaian risiko</span>{risk ? <RiskBadge value={risk.risk_category} /> : <strong>Belum dinilai</strong>}</div><div><span>Status review</span>{detail.medical_review ? <ReviewBadge value={detail.medical_review.review_status} /> : <strong>Belum ditinjau</strong>}</div></div></section>
    <section className="card visual-section"><div className="section-title-row"><div><span className="eyebrow">01 / ANALISIS VISUAL</span><h2>Foto dan visualisasi AI</h2></div></div><VisualAnalysis detail={detail} results={ai} /></section>
    <div className="result-support-grid"><section className="card"><span className="eyebrow">02 / PENILAIAN KLINIS</span><h2>Penilaian Risiko Kaki Diabetik</h2>{risk ? <><RiskBadge value={risk.risk_category} /><p>{risk.explanation}</p></> : <><p className="empty-inline">Penilaian risiko belum lengkap.</p><p className="muted">Kategori risiko ditentukan dari informasi klinis pasien dan tidak hanya berdasarkan foto. Tenaga kesehatan akan mencatatnya setelah meninjau pemeriksaan.</p>{!detail.assessment && <Link className="button button-secondary" to="/patient/assessment">Lengkapi Penilaian Risiko <ArrowRight size={16} /></Link>}</>}</section><section className="card"><span className="eyebrow">03 / TINDAK LANJUT</span><h2>Review Tenaga Kesehatan</h2>{detail.medical_review ? <><ReviewBadge value={detail.medical_review.review_status} /><p className="review-date">Ditinjau {dateLabel(detail.medical_review.reviewed_at)}</p><p>{detail.medical_review.notes}</p></> : <><p className="empty-inline">Belum ditinjau tenaga kesehatan.</p><p className="muted">Status dan catatan tindak lanjut akan tampil di sini setelah review tersedia.</p></>}</section></div>
    <SafetyNote /><div className="flow-actions"><button className="button button-secondary" onClick={download}><Download size={16} /> Unduh Ringkasan</button>{detail.examination.status !== 'reviewed' && <Link className="button button-secondary" to={`/patient/scan?examination=${examId}`}>Tambah foto kaki</Link>}<ButtonLink to="/patient/history">Lihat Riwayat</ButtonLink></div>
  </>
}

export function HistoryPage() {
  const resource = useResource(async () => Promise.all((await listExaminations()).map(exam => getExamination(exam.id))))
  const [risk, setRisk] = useState('all')
  const [review, setReview] = useState('all')
  const [date, setDate] = useState('')
  if (resource.loading) return <LoadingState label="Memuat riwayat pemeriksaan..." />
  if (resource.error || !resource.value) return <ErrorState message={resource.error || 'Riwayat belum tersedia.'} retry={resource.reload} />
  const items = resource.value
  const rows = items.filter(item => (risk === 'all' || item.risk_result?.risk_category === risk) && (review === 'all' || item.medical_review?.review_status === review) && (!date || item.examination.examined_at.slice(0, 10) === date))
  return <><PageHeader eyebrow="PEMANTAUAN" title="Riwayat Pemeriksaan" description="Pantau perubahan kondisi kaki Anda dari waktu ke waktu." action={<ButtonLink to="/patient/assessment">Pemeriksaan Baru</ButtonLink>} />
    {items.length === 0 ? <div className="card"><NoExaminations /></div> : <><section className="history-intro"><div><span className="eyebrow light">CATATAN ANDA</span><h2>Setiap pemeriksaan memberi gambaran yang lebih jelas.</h2><p>Foto, hasil visual, risiko klinis, dan review tersimpan bersama tanggalnya.</p></div><strong>{items.length}<small>pemeriksaan tercatat</small></strong></section><section className="card history-filter-card"><div className="section-title-row"><div><span className="eyebrow">JELAJAHI RIWAYAT</span><h2>Daftar pemeriksaan</h2></div><span className="small muted">{rows.length} ditampilkan</span></div><div className="filters"><label>Tanggal<input type="date" value={date} onChange={e => setDate(e.target.value)} /></label><label>Risiko klinis<select value={risk} onChange={e => setRisk(e.target.value)}><option value="all">Semua risiko</option><option value="low">Rendah</option><option value="moderate">Sedang</option><option value="high">Tinggi</option></select></label><label>Status review<select value={review} onChange={e => setReview(e.target.value)}><option value="all">Semua status</option><option value="pending">Menunggu</option><option value="approved">Disetujui</option><option value="needs_followup">Perlu tindak lanjut</option></select></label></div></section>{rows.length ? <div className="examination-list">{rows.map(item => <ExaminationCard key={item.examination.id} detail={item} />)}</div> : <EmptyState text="Tidak ada pemeriksaan yang cocok dengan filter." />}</>}
  </>
}

export function EducationPage() {
  const location = useLocation()
  const [category, setCategory] = useState('all')
  const standalone = location.pathname === '/education'
  const topics = [{ id: 'all', label: 'Semua panduan', icon: BookOpen }, { id: 'care', label: 'Perawatan harian', icon: ClipboardCheck }, { id: 'signs', label: 'Perubahan yang diperhatikan', icon: CircleAlert }, { id: 'photo', label: 'Panduan foto', icon: Camera }, { id: 'help', label: 'Mencari bantuan', icon: HeartHandshake }]
  const topicFor = (id: string) => id === 'ed1' ? 'signs' : id === 'ed4' ? 'help' : id === 'ed6' ? 'photo' : 'care'
  const filtered = education.filter(item => category === 'all' || topicFor(item.id) === category)
  const content = <div className="education-redesign"><section className="education-lead"><div className="education-lead-copy"><span className="eyebrow light">PANDUAN PASIEN</span><h1>Rawat dengan tenang.<br /><em>Amati dengan teratur.</em></h1><p>Panduan singkat untuk membantu pasien diabetes merawat kaki, mendokumentasikan perubahan, dan menyiapkan informasi saat berbicara dengan tenaga kesehatan.</p><div className="education-lead-actions"><a className="button button-light" href="#panduan">Lihat Panduan <ArrowRight size={16} /></a><Link className="education-text-link" to="/patient/assessment">Mulai pemeriksaan</Link></div></div><aside className="education-lead-index" aria-label="Ringkasan perpustakaan"><div><strong>{education.length}</strong><span>Panduan singkat</span></div><div><strong>{topics.length - 1}</strong><span>Topik utama</span></div><p>Materi membantu Anda membuat catatan yang lebih jelas. Informasi ini tidak menggantikan pemeriksaan tenaga kesehatan.</p></aside></section><section className="education-library" id="panduan"><div className="education-library-heading"><div><span className="eyebrow">PERPUSTAKAAN FOOTGUARD</span><h2>Temukan panduan yang Anda perlukan</h2><p>Pilih topik untuk menyaring materi. Setiap panduan dirancang agar dapat dibaca dalam beberapa menit.</p></div><span className="education-count">{filtered.length} panduan</span></div><div className="topic-filters" aria-label="Filter topik edukasi">{topics.map(({ id, label, icon: Icon }) => <button type="button" key={id} className={category === id ? 'active' : ''} onClick={() => setCategory(id)} aria-pressed={category === id}><Icon size={15} />{label}</button>)}</div><div className="education-grid">{filtered.map((item, index) => { const topic = topics.find(entry => entry.id === topicFor(item.id))!; const Icon = topic.icon; return <article className={`education-card ${index === 0 && category === 'all' ? 'education-card-featured' : ''}`} key={item.id}><div className="education-card-top"><span className="education-card-icon"><Icon size={20} /></span><span>{String(education.findIndex(entry => entry.id === item.id) + 1).padStart(2, '0')}</span></div><div className="education-card-meta"><span>{topic.label}</span><span>{item.readMinutes} menit baca</span></div><h3>{item.title}</h3><p>{item.summary}</p><div className="education-card-footer"><span>Ringkasan praktis</span><BookOpen size={16} /></div></article> })}</div></section><SafetyNote /></div>
  if (!standalone) return content
  return <div className="education-public-page"><header className="education-public-header"><Logo /><nav><Link to="/" className="education-home-link"><Home size={15} /> Beranda</Link><Link to="/login" className="button">Masuk <ArrowRight size={15} /></Link></nav></header><main className="education-public-main">{content}</main><footer className="education-public-footer"><Logo /><p>Panduan pasien untuk pemantauan kaki diabetik.</p><span>© 2026 FootGuard</span></footer></div>
}

function ProfileForm({ patient, onSaved }: { patient: Patient; onSaved: (patient: Patient) => void }) {
  const [form, setForm] = useState<PatientUpdate>({ birth_date: patient.birth_date?.slice(0, 10) || '', gender: patient.gender || 'male', diabetes_type: patient.diabetes_type || 'type2', diagnosis_year: patient.diagnosis_year || new Date().getFullYear(), phone: patient.phone || '', address: patient.address || '' })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  async function submit(e: FormEvent<HTMLFormElement>) { e.preventDefault(); if (saving) return; setSaving(true); setError(''); setMessage(''); try { onSaved(await updatePatient(form)); setMessage('Profil berhasil disimpan.') } catch (err) { setError(errorText(err)) } finally { setSaving(false) } }
  return <form className="card profile-form" onSubmit={submit}><span className="eyebrow">DATA PROFIL</span><h2>Informasi Anda</h2><p className="muted">Gunakan informasi yang sesuai dengan kondisi Anda saat ini.</p><fieldset><legend>Informasi dasar</legend><div className="profile-fields"><label className="field">Tanggal lahir<input type="date" required value={form.birth_date} onChange={e => setForm({ ...form, birth_date: e.target.value })} /></label><label className="field">Jenis kelamin<select value={form.gender} onChange={e => setForm({ ...form, gender: e.target.value as PatientUpdate['gender'] })}><option value="male">Laki-laki</option><option value="female">Perempuan</option><option value="other">Lainnya</option></select></label><label className="field">Telepon<input value={form.phone} maxLength={30} onChange={e => setForm({ ...form, phone: e.target.value })} /></label><label className="field">Alamat<input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} /></label></div></fieldset><fieldset><legend>Informasi kesehatan</legend><div className="profile-fields"><label className="field">Tipe diabetes<select value={form.diabetes_type} onChange={e => setForm({ ...form, diabetes_type: e.target.value as PatientUpdate['diabetes_type'] })}><option value="type1">Tipe 1</option><option value="type2">Tipe 2</option><option value="other">Lainnya</option></select></label><label className="field">Tahun diagnosis<input type="number" min="1900" max={new Date().getFullYear()} required value={form.diagnosis_year} onChange={e => setForm({ ...form, diagnosis_year: Number(e.target.value) })} /></label></div></fieldset>{error && <p className="form-error" role="alert">{error}</p>}{message && <p className="success-message" role="status">{message}</p>}<button className="button" type="submit" disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan Perubahan'} <ArrowRight size={16} /></button></form>
}

export function ProfilePage() {
  const { user } = useAuth()
  const { value, loading, error, reload } = useResource(getPatient)
  const [updated, setUpdated] = useState<Patient | null>(null)
  if (loading) return <LoadingState label="Memuat profil..." />
  if (error || !value) return <ErrorState message={error || 'Profil belum tersedia.'} retry={reload} />
  const patient = updated || value
  const initials = (user?.name || 'P').split(' ').slice(0, 2).map(word => word[0]).join('').toUpperCase()
  const complete = !!(patient.birth_date && patient.gender && patient.diabetes_type && patient.diagnosis_year)
  return <><PageHeader eyebrow="AKUN PASIEN" title="Profil Saya" description="Informasi dasar dan kesehatan yang memberi konteks pada pemeriksaan." /><div className={`profile-completion ${complete ? 'is-complete' : ''}`}><ClipboardCheck size={21} /><div><strong>{complete ? 'Informasi utama lengkap' : 'Informasi utama belum lengkap'}</strong><p>{complete ? 'Perbarui data bila ada perubahan.' : 'Lengkapi tanggal lahir, jenis kelamin, tipe diabetes, dan tahun diagnosis.'}</p></div></div><div className="profile-redesign-grid"><aside className="card profile-identity"><span className="avatar avatar-large">{initials}</span><h2>{user?.name}</h2><p>Pasien FootGuard</p><span className="profile-id">ID Pasien · {patient.id}</span><div className="profile-account"><h3>Pengaturan akun</h3><div className="data-line"><span>Email</span><strong>{user?.email}</strong></div><div className="data-line"><span>Telepon</span><strong>{patient.phone || 'Belum diisi'}</strong></div></div><div className="profile-links"><Link to="/patient/history"><FileText size={18} /> Riwayat pemeriksaan <ArrowRight size={16} /></Link><Link to="/patient/education"><BookOpen size={18} /> Ruang edukasi <ArrowRight size={16} /></Link></div></aside><ProfileForm key={patient.id} patient={patient} onSaved={setUpdated} /></div></>
}
