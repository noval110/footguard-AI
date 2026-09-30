import { ArrowRight, CalendarDays, Footprints } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { ExaminationDetail } from '../api/types'
import { dateLabel, examStatusLabel } from '../utils/format'
import { latestPhoto, visualSummary } from '../utils/examination'
import { FootImageCard, ReviewBadge, RiskBadge } from './UI'

export function StatusBadge({ status }: { status: ExaminationDetail['examination']['status'] }) {
  return <span className={`status-badge status-${status}`}><span className="status-dot" />{examStatusLabel[status]}</span>
}

export function MetricCard({ label, value, description }: { label: string; value: string; description?: string }) {
  return <div className="metric-card"><span>{label}</span><strong>{value}</strong>{description && <small>{description}</small>}</div>
}

export function StepIndicator({ current }: { current: number }) {
  return <ol className="care-steps" aria-label="Tahapan pemeriksaan">{['Siapkan foto', 'Ambil foto', 'Analisis AI', 'Penilaian risiko', 'Hasil'].map((label, index) => <li key={label} className={index + 1 === current ? 'current' : index + 1 < current ? 'done' : ''} aria-current={index + 1 === current ? 'step' : undefined}><span>{String(index + 1).padStart(2, '0')}</span><span>{label}</span></li>)}</ol>
}

export function ExaminationCard({ detail, provider = false }: { detail: ExaminationDetail; provider?: boolean }) {
  const id = detail.examination.id
  return <article className="examination-card">
    <div className="examination-card-top"><span className="eyebrow"><CalendarDays size={14} /> {dateLabel(detail.examination.examined_at)}</span><StatusBadge status={detail.examination.status} /></div>
    <div className="examination-card-body"><div className="examination-thumbs"><FootImageCard small src={latestPhoto(detail)?.image_url} /></div><div className="examination-card-detail"><h3>Pemeriksaan #{id}</h3><p className="visual-summary"><Footprints size={15} />{visualSummary(detail.ai_results)}</p><div className="examination-tags"><span>Risiko {detail.risk_result ? <RiskBadge value={detail.risk_result.risk_category} /> : <b>Belum dinilai</b>}</span><span>Review {detail.medical_review ? <ReviewBadge value={detail.medical_review.review_status} /> : <b>Belum ditinjau</b>}</span></div></div></div>
    <Link className="inline-link" to={provider ? `/provider/examinations/${id}` : `/patient/result/${id}`}>{provider ? 'Tinjau pemeriksaan' : 'Lihat detail'} <ArrowRight size={16} /></Link>
  </article>
}
