import { useResource } from '../hooks/useResource'
import { getComparison } from '../api/consultations'
import type { ExaminationDetail } from '../api/types'
import { ErrorState, LoadingState } from './Feedback'
import { ProtectedImage, ReviewBadge, RiskBadge } from './UI'
import { dateLabel } from '../utils/format'

function ComparisonPanel({ detail, label }: { detail: ExaminationDetail; label: string }) {
  return <article className="card comparison-panel"><h3>{label}</h3><p>{dateLabel(detail.examination.examined_at)} · #{detail.examination.id}</p>
    <p>Risiko <RiskBadge value={detail.risk_result?.risk_category} /></p>
    {detail.foot_images.filter(image => image.image_type === 'photo').map(image => {
      const results = detail.ai_results.filter(result => result.foot_image_id === image.id)
      return <section key={image.id}><div className="comparison-image"><ProtectedImage src={image.image_url} alt={`Foto asli kaki, ${label}`} /></div>
        {results.map(result => <div key={result.id}>{result.mask_url && <div className="comparison-image"><ProtectedImage src={result.mask_url} alt={`Area yang ditandai, ${label}`} /></div>}
          <dl className="monitoring-metrics"><div><dt>Klasifikasi AI</dt><dd>{result.finding_type}</dd></div><div><dt>Keyakinan AI</dt><dd>{(result.confidence * 100).toFixed(1)}%</dd></div>
          <div><dt>Area yang ditandai</dt><dd>{result.ulcer_area_percent == null ? 'Belum tersedia' : `${result.ulcer_area_percent.toFixed(2)}%`}</dd></div></dl>
        </div>)}
      </section>
    })}
    {!detail.foot_images.length && <p className="muted">Foto belum tersedia.</p>}
    <ReviewBadge value={detail.medical_review?.review_status} />
    {detail.medical_review && <div className="comparison-review"><p>{detail.medical_review.notes}</p>{detail.medical_review.conclusion && <p><strong>Kesimpulan tenaga kesehatan:</strong> {detail.medical_review.conclusion}</p>}{detail.medical_review.followup_recommendation && <p><strong>Tindak lanjut:</strong> {detail.medical_review.followup_recommendation}</p>}</div>}
  </article>
}

export function ExaminationComparison({ id }: { id: number }) {
  const resource = useResource(() => getComparison(id), id)
  if (resource.loading) return <LoadingState label="Memuat perbandingan pemeriksaan..." />
  if (resource.error || !resource.value) return <ErrorState message={resource.error || 'Perbandingan belum tersedia.'} retry={resource.reload} />
  const { current, previous } = resource.value
  return <section aria-label="Perbandingan pemeriksaan"><h2>Perbandingan Pemeriksaan</h2><p className="muted">Bandingkan dokumentasi dan nilai yang tersimpan. Sudut foto, pencahayaan, dan area foto dapat berbeda.</p>
    {previous ? <div className="comparison-grid"><ComparisonPanel detail={previous} label="Pemeriksaan sebelumnya" /><ComparisonPanel detail={current} label="Pemeriksaan dipilih" /></div> : <p className="card">Belum ada pemeriksaan sebelumnya untuk dibandingkan.</p>}
  </section>
}
