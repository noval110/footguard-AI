import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpDown,
  Bell,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Eye,
  ClipboardCheck,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react'
import { errorText } from '../api/client'
import { createRiskResult, getProviderExamination, listProviderPatients, saveMedicalReview } from '../api/provider'
import type { ExaminationDetail, ProviderPatient, ReviewStatus, RiskCategory } from '../api/types'
import { ErrorState, LoadingState } from '../components/Feedback'
import { EmptyState, PageHeader, ReviewBadge, RiskBadge } from '../components/UI'
import { useAuth } from '../auth/useAuth'
import { useResource } from '../hooks/useResource'
import { dateLabel, examStatusLabel } from '../utils/format'
import { VisualAnalysis } from '../components/VisualAnalysis'
import { ExaminationCard } from '../components/ExaminationUI'
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

function getDoctorInitials(name?: string) {
  if (!name) return 'DR'
  const clean = name.replace(/^Dr\.\s*/i, '').replace(/^dr\.\s*/i, '').trim()
  const parts = clean.split(' ').filter(Boolean)
  if (parts.length === 0) return 'DR'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

function getMaxConfidence(detail?: ExaminationDetail): number | null {
  if (!detail || !detail.ai_results || detail.ai_results.length === 0) return null
  const confidences = detail.ai_results.map(r => r.confidence || 0)
  const max = Math.max(...confidences)
  return max > 0 ? Math.round(max * 100) : null
}

const latestStatus = (item: ProviderPatient) => item.latest_review ? <ReviewBadge value={item.latest_review.review_status} /> : <span>Belum direview</span>


export function ProviderDashboard() {
  const { user } = useAuth()
  const { value, loading, error, reload } = useResource(async () => {
    const patients = await listProviderPatients()
    // Priority triage queue: patients with latest examination needing review
    // Sorted by clinical priority: high risk first, then moderate, then low
    const riskPriority: Record<string, number> = { high: 3, moderate: 2, low: 1 }
    const pendingQueue = patients
      .filter(item => item.latest_examination && !item.latest_review)
      .sort((a, b) => {
        const rA = a.latest_risk_result?.risk_category ? riskPriority[a.latest_risk_result.risk_category] : 0
        const rB = b.latest_risk_result?.risk_category ? riskPriority[b.latest_risk_result.risk_category] : 0
        if (rB !== rA) return rB - rA
        const dA = a.latest_examination ? new Date(a.latest_examination.examined_at).getTime() : 0
        const dB = b.latest_examination ? new Date(b.latest_examination.examined_at).getTime() : 0
        return dB - dA
      })
      .slice(0, 8)

    const details = await Promise.all(
      pendingQueue.map(item => getProviderExamination(item.latest_examination!.id))
    )
    return {
      patients,
      queue: pendingQueue.map((item, index) => ({ item, detail: details[index] })),
    }
  })

  // Search, filter & sorting states for Section 4
  const [search, setSearch] = useState('')
  const [filterRisk, setFilterRisk] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'risk'>('date')
  const [sortAsc, setSortAsc] = useState<boolean>(false)

  // Responsive collapsible state for Tablet / Mobile
  const [triageCollapsed, setTriageCollapsed] = useState(false)
  const [directoryCollapsed, setDirectoryCollapsed] = useState(false)

  if (loading) return <LoadingState label="Memuat dashboard tenaga kesehatan..." variant="dashboard" />
  if (error || !value) return <ErrorState message={error || 'Dashboard belum tersedia.'} retry={reload} />

  // Computations for KPI
  const totalPatients = value.patients.length
  const exams = value.patients.filter(item => item.latest_examination)
  const needsReview = exams.filter(item => !item.latest_review)
  const highRiskCases = value.patients.filter(p => p.latest_risk_result?.risk_category === 'high')
  const completedAssessments = exams.filter(item => item.latest_review !== null)

  // Doctor greeting calculations
  const hour = new Date().getHours()
  const timeGreeting = hour < 12 ? 'Selamat pagi' : hour < 18 ? 'Selamat siang' : 'Selamat malam'
  const rawName = user?.name || 'Tenaga Kesehatan'
  const doctorName = rawName
  const doctorInitials = getDoctorInitials(user?.name)

  // Filtered & sorted patients for Section 4
  const filteredPatients = value.patients
    .filter(item => {
      const q = search.trim().toLowerCase()
      const matchSearch =
        !q ||
        item.name.toLowerCase().includes(q) ||
        item.email.toLowerCase().includes(q) ||
        String(item.patient.id).includes(q)

      const patientRisk = item.latest_risk_result?.risk_category || 'unassessed'
      const matchRisk = filterRisk === 'all' || patientRisk === filterRisk

      const reviewStatus = item.latest_review?.review_status || 'unreviewed'
      const matchStatus = filterStatus === 'all' || reviewStatus === filterStatus

      return matchSearch && matchRisk && matchStatus
    })
    .sort((a, b) => {
      let cmp = 0
      if (sortBy === 'name') {
        cmp = a.name.localeCompare(b.name)
      } else if (sortBy === 'risk') {
        const riskRank: Record<string, number> = { high: 3, moderate: 2, low: 1 }
        const rA = a.latest_risk_result?.risk_category ? riskRank[a.latest_risk_result.risk_category] : 0
        const rB = b.latest_risk_result?.risk_category ? riskRank[b.latest_risk_result.risk_category] : 0
        cmp = rA - rB
      } else if (sortBy === 'date') {
        const dA = a.latest_examination ? new Date(a.latest_examination.examined_at).getTime() : 0
        const dB = b.latest_examination ? new Date(b.latest_examination.examined_at).getTime() : 0
        cmp = dA - dB
      }
      return sortAsc ? cmp : -cmp
    })

  const toggleSort = (field: 'name' | 'date' | 'risk') => {
    if (sortBy === field) {
      setSortAsc(!sortAsc)
    } else {
      setSortBy(field)
      setSortAsc(false)
    }
  }

  return (
    <div className="provider-command-layout">
      {/* SECTION 1 — HEADER */}
      <section className="provider-command-header" aria-label="Clinical Command Center Header">
        <div className="provider-header-main">
          <div className="provider-eyebrow-pill">
            <span className="pulse-indicator" />
            <span>DASHBOARD TENAGA KESEHATAN</span>
          </div>
          <h1 className="provider-header-title">{timeGreeting}, {doctorName}</h1>
          <p className="provider-header-subtitle">
            Tinjau kondisi kaki pasien, hasil pemeriksaan, dan catatan tindak lanjut.
          </p>
        </div>

        <div className="provider-header-meta">
          <a href="#triage" className="provider-notification-pill" title="Pemeriksaan menunggu review">
            <Bell size={16} />
            <span>{needsReview.length} belum ditinjau</span>
            {needsReview.length > 0 && <span className="notification-counter">{needsReview.length}</span>}
          </a>

          <div className="provider-profile-capsule">
            <div className="provider-avatar-circle">{doctorInitials}</div>
            <div className="provider-profile-text">
              <span className="provider-profile-name">{doctorName}</span>
              <span className="provider-role-badge">
                <ShieldCheck size={12} /> Tenaga Kesehatan
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 2 — CLINICAL KPI OVERVIEW */}
      <section className="clinical-kpi-grid" aria-label="Clinical Key Performance Indicators">
        {/* Card 1: Total Pasien */}
        <div className="clinical-kpi-card">
          <div className="kpi-card-header">
            <span className="kpi-card-label">Total Pasien</span>
            <div className="kpi-card-icon kpi-icon-teal">
              <Users size={18} />
            </div>
          </div>
          <div className="kpi-card-body">
            <div className="kpi-card-number">{totalPatients}</div>
          </div>
          <div className="kpi-card-footer">
            <span className="kpi-status-pill kpi-status-neutral">Aktif Terdaftar</span>
            <span className="kpi-card-explanation">Pasien dalam daftar</span>
          </div>
        </div>

        {/* Card 2: Pasien Risiko Tinggi */}
        <div className="clinical-kpi-card">
          <div className="kpi-card-header">
            <span className="kpi-card-label">Pasien Risiko Tinggi</span>
            <div className="kpi-card-icon kpi-icon-danger">
              <AlertTriangle size={18} />
            </div>
          </div>
          <div className="kpi-card-body">
            <div className={`kpi-card-number ${highRiskCases.length > 0 ? 'danger' : ''}`}>
              {highRiskCases.length}
            </div>
          </div>
          <div className="kpi-card-footer">
            <span className={`kpi-status-pill ${highRiskCases.length > 0 ? 'kpi-status-danger' : 'kpi-status-success'}`}>
              {highRiskCases.length > 0 ? 'Perlu perhatian' : 'Tidak tercatat'}
            </span>
            <span className="kpi-card-explanation">Risiko komplikasi tinggi</span>
          </div>
        </div>

        {/* Card 3: Belum Ditinjau */}
        <div className="clinical-kpi-card">
          <div className="kpi-card-header">
            <span className="kpi-card-label">Belum Ditinjau</span>
            <div className="kpi-card-icon kpi-icon-warning">
              <Clock size={18} />
            </div>
          </div>
          <div className="kpi-card-body">
            <div className={`kpi-card-number ${needsReview.length > 0 ? 'warning' : ''}`}>
              {needsReview.length}
            </div>
          </div>
          <div className="kpi-card-footer">
            <span className={`kpi-status-pill ${needsReview.length > 0 ? 'kpi-status-warning' : 'kpi-status-neutral'}`}>
              {needsReview.length > 0 ? 'Perlu ditinjau' : 'Antrean Bersih'}
            </span>
            <span className="kpi-card-explanation">Menunggu validasi dokter</span>
          </div>
        </div>

        {/* Card 4: Memiliki Catatan Review */}
        <div className="clinical-kpi-card">
          <div className="kpi-card-header">
            <span className="kpi-card-label">Memiliki Catatan Review</span>
            <div className="kpi-card-icon kpi-icon-success">
              <CheckCircle2 size={18} />
            </div>
          </div>
          <div className="kpi-card-body">
            <div className="kpi-card-number">{completedAssessments.length}</div>
          </div>
          <div className="kpi-card-footer">
            <span className="kpi-status-pill kpi-status-success">Terdokumentasi</span>
            <span className="kpi-card-explanation">Review pemeriksaan terakhir</span>
          </div>
        </div>
      </section>

      {/* SECTION 3 — PRIORITY TRIAGE QUEUE */}
      <section className="priority-triage-card" id="triage" aria-label="Antrean Prioritas Review">
        <div className="triage-header-row">
          <div className="triage-title-group">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span className="eyebrow" style={{ margin: 0 }}>PRIORITAS KLINIS</span>
              {value.queue.length > 0 && (
                <span className="triage-urgency-badge">
                  <ShieldAlert size={13} /> {value.queue.length} Kasus Perlu Ditinjau
                </span>
              )}
            </div>
            <h2>Antrean Prioritas Review</h2>
            <p className="muted" style={{ margin: '4px 0 0', fontSize: '13px' }}>
              Pemeriksaan pasien yang memerlukan validasi klinis tenaga kesehatan. Diurutkan berdasarkan tingkat risiko tertinggi.
            </p>
          </div>

          <button
            type="button"
            className="section-toggle-btn"
            onClick={() => setTriageCollapsed(!triageCollapsed)}
            aria-expanded={!triageCollapsed}
          >
            {triageCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
            {triageCollapsed ? 'Buka Antrean' : 'Ciutkan Antrean'}
          </button>
        </div>

        {!triageCollapsed && (
          value.queue.length > 0 ? (
            <div className="clinical-table-wrapper">
              <table className="clinical-triage-table">
                <thead>
                  <tr>
                    <th>Pasien</th>
                    <th>Risiko</th>
                    <th>Temuan Visual</th>
                    <th>Status Review</th>
                    <th>Pemeriksaan Terakhir</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {value.queue.map(({ item, detail }) => {
                    const initials = getDoctorInitials(item.name)
                    const finding = visualSummary(detail.ai_results)
                    const hasUlcer = detail.ai_results.some(r => r.ulcer_detected === true)
                    const maxConf = getMaxConfidence(detail)

                    return (
                      <tr key={item.patient.id}>
                        <td data-label="Pasien">
                          <div className="triage-patient-cell">
                            <span className="patient-cell-avatar">{initials}</span>
                            <div className="patient-cell-info">
                              <span className="patient-cell-name">{item.name}</span>
                              <span className="patient-cell-meta">
                                {age(item.patient.birth_date)} · {item.email}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td data-label="Risiko">
                          <RiskBadge value={item.latest_risk_result?.risk_category} />
                        </td>
                        <td data-label="Temuan Visual">
                          <span className={`ai-finding-tag ${hasUlcer ? 'alert' : ''}`}>
                            <Sparkles size={13} />
                            <span>{finding}</span>
                            {maxConf ? <small>({maxConf}%)</small> : null}
                          </span>
                        </td>
                        <td data-label="Status Review">
                          <ReviewBadge value={item.latest_review?.review_status} />
                        </td>
                        <td data-label="Pemeriksaan Terakhir">
                          <span style={{ fontSize: '12px', color: 'var(--fg-text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                            <Calendar size={13} />
                            {item.latest_examination ? dateLabel(item.latest_examination.examined_at) : 'Belum ada'}
                          </span>
                        </td>
                        <td data-label="Aksi">
                          <div className="triage-actions-cell">
                            <Link
                              to={`/provider/patients/${item.patient.id}`}
                              className="button-link-subtle"
                              title="Lihat Profil Pasien"
                            >
                              <Eye size={13} />
                              <span>Lihat Pasien</span>
                            </Link>
                            {item.latest_examination && (
                              <Link
                                to={`/provider/examinations/${item.latest_examination.id}`}
                                className="button-link-action"
                                title="Tinjau Pemeriksaan Medis"
                              >
                                <ClipboardCheck size={13} />
                                <span>Tinjau Pemeriksaan</span>
                              </Link>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState text="Belum ada pemeriksaan dalam antrean review." />
          )
        )}
      </section>

      {/* SECTION 4 & 5 — WORKSPACE SPLIT LAYOUT */}
      <div className="clinical-workspace-grid">
        {/* SECTION 4 — PATIENT TABLE */}
        <section className="patient-directory-card" aria-label="Patient Directory Table">
          <div className="directory-header-row">
            <div className="directory-title-group">
              <span className="eyebrow" style={{ margin: 0 }}>DIREKTORI PASIEN</span>
              <h3>Daftar Pasien Terpantau</h3>
              <p className="muted" style={{ margin: '4px 0 0', fontSize: '13px' }}>
                Total {filteredPatients.length} dari {totalPatients} pasien terdaftar
              </p>
            </div>

            <button
              type="button"
              className="section-toggle-btn"
              onClick={() => setDirectoryCollapsed(!directoryCollapsed)}
              aria-expanded={!directoryCollapsed}
            >
              {directoryCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
              {directoryCollapsed ? 'Buka Tabel' : 'Ciutkan Tabel'}
            </button>
          </div>

          {!directoryCollapsed && (
            <>
              {/* Features: Search, Filter Risk, Filter Status, Sorting */}
              <div className="directory-toolbar">
                <div className="directory-search-box">
                  <Search size={16} style={{ color: 'var(--fg-text-muted)' }} />
                  <input
                    type="search"
                    placeholder="Cari nama, email, atau ID pasien..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    aria-label="Cari pasien"
                  />
                </div>

                <div className="directory-filters-group">
                  <label className="filter-select-wrapper">
                    <span>Risiko:</span>
                    <select
                      value={filterRisk}
                      onChange={e => setFilterRisk(e.target.value)}
                      aria-label="Filter kategori risiko"
                    >
                      <option value="all">Semua Risiko</option>
                      <option value="high">Tinggi (High)</option>
                      <option value="moderate">Sedang (Moderate)</option>
                      <option value="low">Rendah (Low)</option>
                      <option value="unassessed">Belum Dinilai</option>
                    </select>
                  </label>

                  <label className="filter-select-wrapper">
                    <span>Status:</span>
                    <select
                      value={filterStatus}
                      onChange={e => setFilterStatus(e.target.value)}
                      aria-label="Filter status review"
                    >
                      <option value="all">Semua Status</option>
                      <option value="pending">Menunggu Review</option>
                      <option value="approved">Disetujui</option>
                      <option value="needs_followup">Perlu Tindak Lanjut</option>
                      <option value="unreviewed">Belum Ditinjau</option>
                    </select>
                  </label>

                  <label className="filter-select-wrapper">
                    <span>Urutan:</span>
                    <select
                      value={`${sortBy}-${sortAsc ? 'asc' : 'desc'}`}
                      onChange={e => {
                        const [f, o] = e.target.value.split('-')
                        setSortBy(f as 'name' | 'date' | 'risk')
                        setSortAsc(o === 'asc')
                      }}
                      aria-label="Pilih pengurutan"
                    >
                      <option value="date-desc">Scan Terbaru</option>
                      <option value="date-asc">Scan Terlama</option>
                      <option value="risk-desc">Risiko Tertinggi</option>
                      <option value="name-asc">Nama (A-Z)</option>
                      <option value="name-desc">Nama (Z-A)</option>
                    </select>
                  </label>
                </div>
              </div>

              {filteredPatients.length > 0 ? (
                <div className="clinical-table-wrapper">
                  <table className="patient-directory-table">
                    <thead>
                      <tr>
                        <th className="sortable-th" aria-sort={sortBy === 'name' ? sortAsc ? 'ascending' : 'descending' : 'none'}><button className="table-sort-button" type="button" onClick={() => toggleSort('name')}>
                          <span className="sortable-th-inner">
                            Nama Pasien <ArrowUpDown size={12} />
                          </span></button>
                        </th>
                        <th className="sortable-th" aria-sort={sortBy === 'date' ? sortAsc ? 'ascending' : 'descending' : 'none'}><button className="table-sort-button" type="button" onClick={() => toggleSort('date')}>
                          <span className="sortable-th-inner">
                            Pemeriksaan Terakhir <ArrowUpDown size={12} />
                          </span></button>
                        </th>
                        <th className="sortable-th" aria-sort={sortBy === 'risk' ? sortAsc ? 'ascending' : 'descending' : 'none'}><button className="table-sort-button" type="button" onClick={() => toggleSort('risk')}>
                          <span className="sortable-th-inner">
                            Kategori Risiko <ArrowUpDown size={12} />
                          </span></button>
                        </th>
                        <th>Hasil Visual</th>
                        <th>Review Klinis</th>
                        <th style={{ textAlign: 'right' }}>Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPatients.map(item => {
                        const initials = getDoctorInitials(item.name)
                        const exam = item.latest_examination
                        const aiStatus = exam
                          ? exam.status === 'completed' || exam.status === 'reviewed'
                            ? 'Analisis AI Selesai'
                            : 'Dalam Pemrosesan'
                          : 'Belum Ada Scan'

                        return (
                          <tr key={item.patient.id}>
                            <td data-label="Nama Pasien">
                              <div className="triage-patient-cell">
                                <span className="patient-cell-avatar">{initials}</span>
                                <div className="patient-cell-info">
                                  <span className="patient-cell-name">{item.name}</span>
                                  <span className="patient-cell-meta">
                                    {age(item.patient.birth_date)} · {item.email}
                                  </span>
                                </div>
                              </div>
                            </td>

                            <td data-label="Pemeriksaan Terakhir">
                              <span style={{ fontSize: '12px', color: 'var(--fg-text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                                <Calendar size={13} />
                                {exam ? dateLabel(exam.examined_at) : 'Belum ada'}
                              </span>
                            </td>

                            <td data-label="Kategori Risiko">
                              <RiskBadge value={item.latest_risk_result?.risk_category} />
                            </td>

                            <td data-label="Hasil Visual">
                              <span className="ai-finding-tag" style={{ fontSize: '11px' }}>
                                <Sparkles size={12} />
                                {aiStatus}
                              </span>
                            </td>

                            <td data-label="Review Klinis">
                              <ReviewBadge value={item.latest_review?.review_status} />
                            </td>

                            <td data-label="Aksi" style={{ textAlign: 'right' }}>
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                {exam ? (
                                  <Link
                                    to={`/provider/examinations/${exam.id}`}
                                    className="button-link-action"
                                    style={{ padding: '5px 10px', fontSize: '11px' }}
                                    title="Tinjau Pemeriksaan"
                                  >
                                    <span>Tinjau</span>
                                    <ArrowRight size={12} />
                                  </Link>
                                ) : (
                                  <Link
                                    to={`/provider/patients/${item.patient.id}`}
                                    className="button-link-subtle"
                                    style={{ padding: '5px 10px', fontSize: '11px' }}
                                    title="Lihat Profil Pasien"
                                  >
                                    <span>Profil</span>
                                    <ArrowRight size={12} />
                                  </Link>
                                )}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState text="Tidak ada pasien yang cocok dengan filter pencarian." />
              )}
            </>
          )}
        </section>

        {/* SECTION 5 — CLINICAL REVIEW PANEL */}
        <aside className="clinical-review-sidebar" aria-label="Clinical Review Panel">
          <div className="review-panel-header">
            <div className="review-panel-title-group">
              <span className="eyebrow" style={{ margin: 0 }}>PANEL REVIEW CEPAT</span>
              <h3>Pemeriksaan Belum Ditinjau</h3>
            </div>
            {value.queue.length > 0 && (
              <span className="review-panel-count-pill">{value.queue.length} antrean</span>
            )}
          </div>

          <p className="muted" style={{ fontSize: '12px', margin: 0 }}>
            Pemeriksaan terbaru yang memerlukan validasi dokter dan penetapan risiko klinis.
          </p>

          <div className="review-cards-list">
            {value.queue.length > 0 ? (
              value.queue.slice(0, 5).map(({ item, detail }) => {
                const initials = getDoctorInitials(item.name)
                const maxConf = getMaxConfidence(detail)

                return (
                  <article className="review-card-item" key={item.patient.id}>
                    <div className="review-card-top">
                      <div className="review-card-patient">
                        <span className="patient-cell-avatar">{initials}</span>
                        <div>
                          <strong className="review-card-patient-name">{item.name}</strong>
                          <span style={{ display: 'block', fontSize: '10px', color: 'var(--fg-text-muted)' }}>
                            ID #{item.patient.id} · {age(item.patient.birth_date)}
                          </span>
                        </div>
                      </div>
                      <RiskBadge value={item.latest_risk_result?.risk_category} />
                    </div>

                    <div className="review-card-details">
                      <span className="review-detail-chip">
                        <Calendar size={12} />
                        {item.latest_examination ? dateLabel(item.latest_examination.examined_at) : 'Belum ada'}
                      </span>
                      {maxConf && (
                        <span className="review-detail-chip ai-confidence-chip">
                          <Sparkles size={12} />
                          {maxConf}% Keyakinan AI
                        </span>
                      )}
                    </div>

                    {item.latest_examination && (
                      <div className="review-card-action">
                        <Link
                          to={`/provider/examinations/${item.latest_examination.id}`}
                          className="btn-review-now"
                          title={`Tinjau pemeriksaan pasien ${item.name}`}
                        >
                          <span>Tinjau Pemeriksaan</span>
                          <ArrowRight size={13} />
                        </Link>
                      </div>
                    )}
                  </article>
                )
              })
            ) : (
              <EmptyState text="Belum ada pemeriksaan yang menunggu review." />
            )}
          </div>

          <div style={{ borderTop: '1px solid var(--fg-border-subtle)', paddingTop: '14px' }}>
            <Link to="/provider/patients" className="inline-link" style={{ fontSize: '12px' }}>
              Lihat Seluruh Direktori Pasien <ArrowRight size={14} />
            </Link>
          </div>
        </aside>
      </div>

      {/* Clinical Guidance Note */}
      <section className="card provider-context" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span className="eyebrow">STANDAR PRAKTIK KLINIS</span>
          <h2 style={{ fontSize: '1.25rem', margin: '4px 0 8px' }}>Integrasi Hasil Visual AI & Faktor Klinis</h2>
          <p className="muted" style={{ margin: 0, fontSize: '13px', maxWidth: '680px' }}>
            Temuan visual AI berfungsi sebagai alat bantu skrining dan observasi foto kaki. Keputusan diagnostik, penetapan kategori risiko kaki diabetik, serta instruksi tata laksana klinis tetap merupakan wewenang mandiri dokter dan tenaga kesehatan.
          </p>
        </div>
        <ShieldCheck size={40} strokeWidth={1.4} style={{ color: 'var(--fg-secondary)', flexShrink: 0 }} />
      </section>
    </div>
  )
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
