import { PatientOverview } from '../dashboard/PatientOverview'
import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowRight,
  BookOpen,
  Camera,
  CircleAlert,
  ClipboardCheck,
  Download,
  HeartHandshake,
  Home,
  Info,
  HeartPulse,
  UserRound,
  Check,
  ShieldCheck,
} from 'lucide-react'
import { getProfile } from '../api/auth'
import { createAssessment, getLatestAssessment } from '../api/assessments'
import { errorText, isNotFound } from '../api/client'
import { createExamination, getExamination, listExaminations } from '../api/examinations'
import { getPatient, updatePatient } from '../api/patient'
import type {
  Assessment,
  AssessmentInput,
  ExaminationDetail,
  Patient,
  PatientUpdate,
  User
} from '../api/types'
import { ErrorState, LoadingState } from '../components/Feedback'
import {
  ButtonLink,
  EmptyState,
  FootImageCard,
  Logo,
  PageHeader,
  ReviewBadge,
  RiskBadge,
  SafetyNote
} from '../components/UI'
import { education } from '../data/education'
import { useResource } from '../hooks/useResource'
import { dateLabel, examStatusLabel } from '../utils/format'
import { VisualAnalysis } from '../components/VisualAnalysis'
import { StatusBadge } from '../components/ExaminationUI'
import { latestPhoto, visualSummary } from '../utils/examination'
import { ExaminationComparison } from '../components/ExaminationComparison'
import { ProfileIdentity } from '../components/ProfileIdentity'

// --------------------------------------------------------------------------
// Clinical questionnaire questions & types
// --------------------------------------------------------------------------
const questions: { key: ClinicalKey; label: string; help: string }[] = [
  { key: 'previous_ulcer', label: 'Pernah mengalami ulkus kaki sebelumnya?', help: 'Termasuk luka yang sudah sembuh.' },
  { key: 'has_lops', label: 'Memiliki neuropati atau penurunan sensasi?', help: 'Misalnya mati rasa atau sulit merasakan sentuhan.' },
  { key: 'has_pad', label: 'Memiliki penyakit arteri perifer (PAD)?', help: 'Gangguan aliran darah ke tungkai yang pernah dinyatakan tenaga medis.' },
  { key: 'foot_deformity', label: 'Terdapat deformitas kaki?', help: 'Perubahan bentuk kaki yang telah diketahui.' },
  { key: 'previous_amputation', label: 'Pernah mengalami amputasi?', help: 'Termasuk sebagian jari atau kaki.' },
  { key: 'kidney_failure', label: 'Memiliki gagal ginjal atau ESRD?', help: 'Riwayat gagal ginjal tahap akhir.' },
]

type ClinicalKey = Exclude<keyof AssessmentInput, 'notes'>

type DashboardData = {
  user: User
  patient: Patient
  assessment: Assessment | null
  examinationCount: number
  examinations: ExaminationDetail[]
}

async function loadDashboard(): Promise<DashboardData> {
  const [user, patient, assessment, exams] = await Promise.all([
    getProfile(),
    getPatient(),
    getLatestAssessment().catch(error => {
      if (isNotFound(error)) return null
      throw error
    }),
    listExaminations(),
  ])
  const examinations = await Promise.all(exams.slice(0, 8).map(exam => getExamination(exam.id)))
  return { user, patient, assessment, examinationCount: exams.length, examinations }
}

// ==========================================================================
// 1. PATIENT DASHBOARD (Redesigned with 5 sections)
// ==========================================================================
export function PatientDashboard() {
  const { value, loading, error, reload } = useResource(loadDashboard)
  if (loading) return <LoadingState label="Memuat dashboard pasien DIA SCAN..." variant="dashboard" />
  if (error || !value) return <ErrorState message={error || 'Dashboard belum tersedia.'} retry={reload} />
  return <PatientOverview user={value.user} examinationCount={value.examinationCount} examinations={value.examinations} />
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
    setSubmitting(true)
    setError('')
    try {
      const id = assessmentId ?? (await createAssessment(answers as AssessmentInput)).id
      setAssessmentId(id)
      const exam = await createExamination(id)
      navigate(`/patient/scan?examination=${exam.id}`)
    } catch (err) {
      setError(errorText(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="PEMERIKSAAN BARU / INFORMASI KESEHATAN"
        title="Pemeriksaan Kaki Diabetik"
        description="Dokumentasikan kondisi kaki Anda dan gunakan analisis AI untuk membantu menemukan area yang perlu diperhatikan."
      />
      <div className="flow-card">
        <div className="assessment-context">
          <Info size={18} />
          <span>Analisis AI tidak menentukan apakah seseorang menderita diabetes. DIA SCAN membantu pemantauan kaki pada pasien diabetes.</span>
        </div>

        <div className="flow-intro">
          <h2>Mulai dari informasi kesehatan Anda</h2>
          <p>Jawab sesuai informasi yang Anda ketahui. Jika ragu, bicarakan dengan tenaga kesehatan.</p>
        </div>

        <div className="question-list">
          {questions.map(({ key, label, help }, i) => (
            <div className="question-row" key={key}>
              <div>
                <span className="question-number">{String(i + 1).padStart(2, '0')}</span>
                <strong>{label}</strong>
                <small>{help}</small>
              </div>
              <div className="choice-group" role="group" aria-label={label}>
                <button
                  type="button"
                  className={answers[key] === false ? 'chosen' : ''}
                  onClick={() => setAnswers({ ...answers, [key]: false })}
                >
                  Tidak
                </button>
                <button
                  type="button"
                  className={answers[key] === true ? 'chosen' : ''}
                  onClick={() => setAnswers({ ...answers, [key]: true })}
                >
                  Ya
                </button>
              </div>
            </div>
          ))}
        </div>

        {error && <p className="form-error" role="alert">{error}</p>}

        <div className="flow-actions">
          <Link to="/patient/dashboard" className="button button-secondary">
            Sebelumnya
          </Link>
          <button
            className="button"
            onClick={continueFlow}
            disabled={!complete || submitting}
          >
            {submitting ? 'Menyimpan...' : 'Lanjutkan ke Foto'} {!submitting && <ArrowRight size={16} />}
          </button>
        </div>
        <p className="form-hint">{Object.keys(answers).length} dari {questions.length} pertanyaan terjawab.</p>
      </div>
    </>
  )
}

// ==========================================================================
// 3. RESULT PAGE
// ==========================================================================
export function ResultPage() {
  const { id } = useParams()
  const examId = Number(id)
  const validId = Number.isSafeInteger(examId) && examId > 0

  const { value: detail, loading, error, reload } = useResource(
    () => getExamination(examId),
    validId ? examId : 'invalid'
  )

  if (!validId) return <ErrorState message="ID pemeriksaan tidak valid." />
  if (loading) return <LoadingState label="Memuat hasil pemeriksaan..." />
  if (error || !detail) return <ErrorState message={error || 'Hasil tidak tersedia.'} retry={reload} />

  const examination = detail
  const ai = examination.ai_results
  const risk = examination.risk_result
  const photoStatus = latestPhoto(examination) ? 'Foto kaki tersedia' : 'Belum ada foto'

  function download() {
    const report = `DIA SCAN — Ringkasan pemeriksaan
Tanggal: ${dateLabel(examination.examination.examined_at)}
Status: ${examStatusLabel[examination.examination.status]}
Hasil visual: ${visualSummary(ai)}
Kategori risiko klinis: ${risk?.risk_category || 'Belum tersedia'}
Penjelasan klinis: ${risk?.explanation || '-'}
Review tenaga kesehatan: ${examination.medical_review?.notes || 'Belum tersedia'}
Kesimpulan tenaga kesehatan: ${examination.medical_review?.conclusion || '-'}
Rekomendasi tindak lanjut: ${examination.medical_review?.followup_recommendation || '-'}

Hasil ini bukan diagnosis mandiri.`
    const url = URL.createObjectURL(new Blob([report], { type: 'text/plain;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `footguard-${examId}.txt`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <PageHeader
        eyebrow={`PEMERIKSAAN #${examId}`}
        title="Hasil Pemeriksaan Kaki"
        description={`${dateLabel(detail.examination.examined_at)} · ${photoStatus}`}
        action={<StatusBadge status={detail.examination.status} />}
      />

      <section className="card examination-overview">
        <div className="section-title-row">
          <div>
            <span className="eyebrow">RINGKASAN PEMERIKSAAN</span>
            <h2>Gambaran utama</h2>
          </div>
          <span className="small muted">Hasil tersimpan dan dapat dibuka kembali</span>
        </div>
        <div className="overview-grid">
          <div>
            <span>Foto kaki</span>
            <strong>{photoStatus}</strong>
          </div>
          <div>
            <span>Hasil visual</span>
            <strong>{visualSummary(ai)}</strong>
          </div>
          <div>
            <span>Penilaian risiko</span>
            {risk ? <RiskBadge value={risk.risk_category} /> : <strong>Belum dinilai</strong>}
          </div>
          <div>
            <span>Status review</span>
            {detail.medical_review ? (
              <ReviewBadge value={detail.medical_review.review_status} />
            ) : (
              <strong>Belum ditinjau</strong>
            )}
          </div>
        </div>
      </section>

      <section className="card visual-section">
        <div className="section-title-row">
          <div>
            <span className="eyebrow">01 / ANALISIS VISUAL</span>
            <h2>Foto dan visualisasi AI</h2>
          </div>
        </div>
        <VisualAnalysis detail={detail} results={ai} />
      </section>

      <div className="result-support-grid">
        <section className="card">
          <span className="eyebrow">02 / PENILAIAN KLINIS</span>
          <h2>Penilaian Risiko Kaki Diabetik</h2>
          {risk ? (
            <>
              <RiskBadge value={risk.risk_category} />
              <p>{risk.explanation}</p>
            </>
          ) : (
            <>
              <p className="empty-inline">Penilaian risiko belum lengkap.</p>
              <p className="muted">
                Kategori risiko ditentukan dari informasi klinis pasien dan tidak hanya berdasarkan foto. Tenaga kesehatan akan mencatatnya setelah meninjau pemeriksaan.
              </p>
              {!detail.assessment && (
                <Link className="button button-secondary" to="/patient/assessment">
                  Lengkapi Penilaian Risiko <ArrowRight size={16} />
                </Link>
              )}
            </>
          )}
        </section>

        <section className="card">
          <span className="eyebrow">03 / TINDAK LANJUT</span>
          <h2>Review Tenaga Kesehatan</h2>
          {detail.medical_review ? (
            <>
              <ReviewBadge value={detail.medical_review.review_status} />
              <p className="review-date">Ditinjau {dateLabel(detail.medical_review.reviewed_at)}</p>
              <p>{detail.medical_review.notes}</p>
              {detail.medical_review.conclusion && <p className="message-content"><strong>Kesimpulan tenaga kesehatan:</strong> {detail.medical_review.conclusion}</p>}
              {detail.medical_review.followup_recommendation && <p className="message-content"><strong>Rekomendasi tindak lanjut:</strong> {detail.medical_review.followup_recommendation}</p>}
            </>
          ) : (
            <>
              <p className="empty-inline">Belum ditinjau tenaga kesehatan.</p>
              <p className="muted">Status dan catatan tindak lanjut akan tampil di sini setelah review tersedia.</p>
            </>
          )}
        </section>
      </div>

      <ExaminationComparison id={detail.examination.id} />
      <SafetyNote />

      <div className="flow-actions"><Link className="button button-secondary" to={`/patient/consultation?examination=${detail.examination.id}`}>Konsultasikan pemeriksaan</Link>
        <button className="button button-secondary" onClick={download}>
          <Download size={16} /> Unduh Ringkasan
        </button>
        <Link className="button button-secondary" to="/patient/assessment">Pemeriksaan Baru</Link>
        <ButtonLink to="/patient/progress">Perkembangan Kondisi</ButtonLink><ButtonLink to="/patient/history">Lihat Riwayat</ButtonLink>
      </div>
    </>
  )
}

// ==========================================================================
// 4. HISTORY PAGE
// ==========================================================================
export function HistoryPage() {
  const resource = useResource(async () =>
    Promise.all((await listExaminations()).map(exam => getExamination(exam.id)))
  )
  const [risk, setRisk] = useState('all')
  const [review, setReview] = useState('all')
  const [date, setDate] = useState('')

  if (resource.loading) return <LoadingState label="Memuat riwayat pemeriksaan..." />
  if (resource.error || !resource.value) return <ErrorState message={resource.error || 'Riwayat belum tersedia.'} retry={resource.reload} />

  const rows = resource.value.filter(item => {
    const riskMatch = risk === 'all' || item.risk_result?.risk_category === risk
    const reviewMatch =
      review === 'all' ||
      (review === 'none' && !item.medical_review) ||
      item.medical_review?.review_status === review
    const dateMatch = !date || item.examination.examined_at.startsWith(date)
    return riskMatch && reviewMatch && dateMatch
  })

  return (
    <>
      <PageHeader
        eyebrow="RIWAYAT PASIEN"
        title="Riwayat Pemeriksaan"
        description="Buka kembali foto kaki, hasil analisis AI, dan review tenaga kesehatan dari waktu ke waktu."
        action={<ButtonLink to="/patient/assessment">Pemeriksaan Baru</ButtonLink>}
      />

      <div className="card table-card">
        <div className="card-heading">
          <h3>Daftar Pemeriksaan</h3>
          <span className="muted small">{rows.length} catatan</span>
        </div>

        <div className="filters">
          <label>
            Tanggal
            <input type="date" value={date} onChange={e => setDate(e.target.value)} />
          </label>
          <label>
            Risiko
            <select value={risk} onChange={e => setRisk(e.target.value)}>
              <option value="all">Semua risiko</option>
              <option value="low">Rendah</option>
              <option value="moderate">Sedang</option>
              <option value="high">Tinggi</option>
            </select>
          </label>
          <label>
            Status review
            <select value={review} onChange={e => setReview(e.target.value)}>
              <option value="all">Semua status</option>
              <option value="none">Belum ditinjau</option>
              <option value="pending">Menunggu</option>
              <option value="approved">Disetujui</option>
              <option value="needs_followup">Perlu tindak lanjut</option>
            </select>
          </label>
        </div>

        {rows.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>Foto Kaki</th>
                  <th>Kategori Risiko</th>
                  <th>Status Review</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(item => (
                  <tr key={item.examination.id}>
                    <td data-label="Tanggal">{dateLabel(item.examination.examined_at)}</td>
                    <td data-label="Foto Kaki">
                      <FootImageCard small src={latestPhoto(item)?.image_url} />
                    </td>
                    <td data-label="Kategori Risiko">
                      {item.risk_result ? <RiskBadge value={item.risk_result.risk_category} /> : <span className="small muted">Belum dinilai</span>}
                    </td>
                    <td data-label="Status Review">
                      {item.medical_review ? (
                        <ReviewBadge value={item.medical_review.review_status} />
                      ) : (
                        <span className="small muted">Belum ditinjau</span>
                      )}
                    </td>
                    <td data-label="Aksi">
                      <Link to={`/patient/result/${item.examination.id}`} className="table-link">
                        Lihat <ArrowRight size={14} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState text="Tidak ada pemeriksaan yang sesuai dengan filter." />
        )}
      </div>
    </>
  )
}

// ==========================================================================
// 5. EDUCATION PAGE
// ==========================================================================
export function EducationPage() {
  const location = useLocation()
  const [category, setCategory] = useState('all')
  const standalone = location.pathname === '/education'

  const topics = [
    { id: 'all', label: 'Semua panduan', icon: BookOpen },
    { id: 'care', label: 'Perawatan harian', icon: ClipboardCheck },
    { id: 'signs', label: 'Perubahan yang diperhatikan', icon: CircleAlert },
    { id: 'photo', label: 'Panduan foto', icon: Camera },
    { id: 'help', label: 'Mencari bantuan', icon: HeartHandshake }
  ]

  const topicFor = (id: string) =>
    id === 'ed1' ? 'signs' : id === 'ed4' ? 'help' : id === 'ed6' ? 'photo' : 'care'

  const filtered = education.filter(item => category === 'all' || topicFor(item.id) === category)

  const content = (
    <div className="education-redesign">
      <section className="education-lead">
        <div className="education-lead-copy">
          <span className="eyebrow light">PANDUAN PASIEN</span>
          <h1>Rawat dengan tenang.<br /><em>Amati dengan teratur.</em></h1>
          <p>Panduan singkat untuk membantu pasien diabetes merawat kaki, mendokumentasikan perubahan, dan menyiapkan informasi saat berbicara dengan tenaga kesehatan.</p>
          <div className="education-lead-actions">
            <a className="button button-light" href="#panduan">
              Lihat Panduan <ArrowRight size={16} />
            </a>
            <Link className="education-text-link" to="/patient/assessment">
              Mulai pemeriksaan
            </Link>
          </div>
        </div>
        <aside className="education-lead-index" aria-label="Ringkasan perpustakaan">
          <div><strong>{education.length}</strong><span>Panduan singkat</span></div>
          <div><strong>{topics.length - 1}</strong><span>Topik utama</span></div>
          <p>Materi membantu Anda membuat catatan yang lebih jelas. Informasi ini tidak menggantikan pemeriksaan tenaga kesehatan.</p>
        </aside>
      </section>

      <section className="education-library" id="panduan">
        <div className="education-library-heading">
          <div>
            <span className="eyebrow">PERPUSTAKAAN DIA SCAN</span>
            <h2>Temukan panduan yang Anda perlukan</h2>
            <p>Pilih topik untuk menyaring materi. Setiap panduan dirancang agar dapat dibaca dalam beberapa menit.</p>
          </div>
          <span className="education-count">{filtered.length} panduan</span>
        </div>

        <div className="topic-filters" aria-label="Filter topik edukasi">
          {topics.map(({ id, label, icon: Icon }) => (
            <button
              type="button"
              key={id}
              className={category === id ? 'active' : ''}
              onClick={() => setCategory(id)}
              aria-pressed={category === id}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </div>

        <div className="education-grid">
          {filtered.map((item, index) => {
            const topic = topics.find(entry => entry.id === topicFor(item.id))!
            const Icon = topic.icon
            return (
              <article
                className={`education-card ${index === 0 && category === 'all' ? 'education-card-featured' : ''}`}
                key={item.id}
              >
                <div className="education-card-top">
                  <span className="education-card-icon"><Icon size={20} /></span>
                  <span>{String(education.findIndex(entry => entry.id === item.id) + 1).padStart(2, '0')}</span>
                </div>
                <div className="education-card-meta">
                  <span>{topic.label}</span>
                  <span>{item.readMinutes} menit baca</span>
                </div>
                <h3>{item.title}</h3>
                <p>{item.summary}</p>
                <div className="education-card-footer">
                  <span>Ringkasan praktis</span>
                  <BookOpen size={16} />
                </div>
              </article>
            )
          })}
        </div>
      </section>
      <SafetyNote />
    </div>
  )

  if (!standalone) return content

  return (
    <div className="education-public-page">
      <header className="education-public-header">
        <Logo />
        <nav>
          <Link to="/" className="education-home-link"><Home size={15} /> Beranda</Link>
          <Link to="/login" className="button">Masuk <ArrowRight size={15} /></Link>
        </nav>
      </header>
      <main className="education-public-main">{content}</main>
      <footer className="education-public-footer">
        <Logo />
        <p>Panduan pasien untuk pemantauan kaki diabetik.</p>
        <span>© 2026 DIA SCAN</span>
      </footer>
    </div>
  )
}

// ==========================================================================
// 6. PROFILE PAGE & FORM
// ==========================================================================
function ProfileForm({ patient, onSaved }: { patient: Patient; onSaved: (patient: Patient) => void }) {
  const [form, setForm] = useState<Omit<PatientUpdate, 'gender' | 'diabetes_type' | 'diagnosis_year'> & { gender: PatientUpdate['gender'] | ''; diabetes_type: PatientUpdate['diabetes_type'] | ''; diagnosis_year: number | '' }>({
    birth_date: patient.birth_date?.slice(0, 10) || '',
    gender: patient.gender || '',
    diabetes_type: patient.diabetes_type || '',
    diagnosis_year: patient.diagnosis_year || '',
    phone: patient.phone || '',
    address: patient.address || ''
  })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (saving) return
    if (!form.gender || !form.diabetes_type || !form.diagnosis_year) { setError('Lengkapi informasi kesehatan dan jenis kelamin.'); return }
    setSaving(true)
    setError('')
    setMessage('')
    try {
      onSaved(await updatePatient({ ...form, gender: form.gender, diabetes_type: form.diabetes_type, diagnosis_year: form.diagnosis_year }))
      setMessage('Profil berhasil disimpan.')
    } catch (err) {
      setError(errorText(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="card profile-form" onSubmit={submit}>
      <span className="eyebrow">DATA DIRI & KESEHATAN</span>
      <h2>Informasi Anda</h2>
      <p className="muted">Gunakan informasi yang sesuai dengan kondisi Anda saat ini.</p>
      <fieldset>
        <legend><UserRound size={18} />Informasi dasar</legend>
        <div className="profile-fields">
          <label className="field">
            Tanggal lahir
            <input
              type="date"
              required
              max={new Date().toLocaleDateString('en-CA')}
              value={form.birth_date}
              onChange={e => setForm({ ...form, birth_date: e.target.value })}
            />
          </label>
          <label className="field">
            Jenis kelamin
            <select
              required
              value={form.gender}
              onChange={e => setForm({ ...form, gender: e.target.value as PatientUpdate['gender'] })}
            >
              <option value="" disabled>Pilih jenis kelamin</option>
              <option value="male">Laki-laki</option>
              <option value="female">Perempuan</option>
              <option value="other">Lainnya</option>
            </select>
          </label>
          <label className="field">
            Telepon
            <input
              type="tel"
              autoComplete="tel"
              placeholder="Contoh: 081234567890"
              value={form.phone}
              maxLength={30}
              onChange={e => setForm({ ...form, phone: e.target.value })}
            />
          </label>
          <label className="field">
            Alamat
            <input
              autoComplete="street-address"
              maxLength={5000}
              placeholder="Alamat tempat tinggal"
              value={form.address}
              onChange={e => setForm({ ...form, address: e.target.value })}
            />
          </label>
        </div>
      </fieldset>
      <fieldset>
        <legend><HeartPulse size={18} />Informasi kesehatan</legend>
        <div className="profile-fields">
          <label className="field">
            Tipe diabetes
            <select
              required
              value={form.diabetes_type}
              onChange={e => setForm({ ...form, diabetes_type: e.target.value as PatientUpdate['diabetes_type'] })}
            >
              <option value="" disabled>Pilih tipe diabetes</option>
              <option value="type1">Tipe 1</option>
              <option value="type2">Tipe 2</option>
              <option value="other">Lainnya</option>
            </select>
          </label>
          <label className="field">
            Tahun diagnosis
            <input
              type="number"
              min="1900"
              max={new Date().getFullYear()}
              required
              value={form.diagnosis_year}
              placeholder="Contoh: 2020"
              onChange={e => setForm({ ...form, diagnosis_year: e.target.value ? Number(e.target.value) : '' })}
            />
          </label>
        </div>
      </fieldset>
      {error && <p className="form-error" role="alert">{error}</p>}
      {message && <p className="success-message" role="status">{message}</p>}
      <div className="profile-form-footer"><p><ShieldCheck size={16} />Data ini membantu tenaga kesehatan memahami kondisi Anda.</p><button className="button" type="submit" disabled={saving}>
        <Check size={16} />{saving ? 'Menyimpan...' : 'Simpan Perubahan'}
      </button></div>
    </form>
  )
}

export function ProfilePage() {
  const { value, loading, error, reload } = useResource(getPatient)
  const [updated, setUpdated] = useState<Patient | null>(null)

  if (loading) return <LoadingState label="Memuat profil..." />
  if (error || !value) return <ErrorState message={error || 'Profil belum tersedia.'} retry={reload} />

  const patient = updated || value
  const complete = !!(patient.birth_date && patient.gender && patient.diabetes_type && patient.diagnosis_year)
  const completedFields = [patient.birth_date, patient.gender, patient.diabetes_type, patient.diagnosis_year].filter(Boolean).length

  return (
    <div className="profile-page">
      <PageHeader
        eyebrow="AKUN PASIEN"
        title="Profil Saya"
        description="Kelola identitas, foto profil, dan informasi kesehatan Anda."
      />
      <div className={`profile-completion ${complete ? 'is-complete' : ''}`}>
        <ClipboardCheck size={21} />
        <div>
          <strong>{complete ? 'Informasi utama lengkap' : 'Informasi utama belum lengkap'}</strong>
          <p>{complete ? 'Perbarui data bila ada perubahan.' : 'Lengkapi tanggal lahir, jenis kelamin, tipe diabetes, dan tahun diagnosis.'}</p>
        </div>
        <span className="profile-completion-count">{completedFields}/4 data utama</span>
      </div>
      <div className="profile-redesign-grid">
        <ProfileIdentity patientId={patient.id} phone={patient.phone} />
        <ProfileForm key={patient.id} patient={patient} onSaved={setUpdated} />
      </div>
    </div>
  )
}
