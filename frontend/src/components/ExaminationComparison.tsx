import { useResource } from '../hooks/useResource'
import { getComparison } from '../api/consultations'
import type { ExaminationDetail } from '../api/types'
import { ErrorState, LoadingState } from './Feedback'
import { ProtectedImage, ReviewBadge, RiskBadge } from './UI'
import { dateLabel } from '../utils/format'

const formatConfidence = (value: number) => {
  if (!Number.isFinite(value)) return 'Belum tersedia'

  const percent = value * 100

  return percent >= 99.995
    ? '>99.99%'
    : `${percent.toFixed(2)}%`
}

function ComparisonPanel({ detail, label }: { detail: ExaminationDetail; label: string }) {
  const photos = detail.foot_images.filter(image => image.image_type === 'photo')

  return (
    <article className="card comparison-panel">
      <header className="comparison-panel-header">
        <h3>{label}</h3>
        <p className="comparison-date">
          <span>{dateLabel(detail.examination.examined_at)}</span>
          <span className="comparison-exam-id">#{detail.examination.id}</span>
        </p>
        <div className="comparison-risk"><span>Risiko klinis</span><RiskBadge value={detail.risk_result?.risk_category} /></div>
      </header>

      <div className="comparison-photos">
        {photos.map((image, photoIndex) => {
          const results = detail.ai_results.filter(result => result.foot_image_id === image.id)

          return (
            <section className="comparison-photo" key={image.id} aria-label={`Dokumentasi foto ${photoIndex + 1}, ${label}`}>
              {photos.length > 1 && <h4 className="comparison-photo-title">Foto {photoIndex + 1}</h4>}
              <div className="comparison-media-grid">
                <figure className="comparison-media">
                  <div className="comparison-image"><ProtectedImage src={image.image_url} alt={`Foto asli kaki, ${label}`} /></div>
                  <figcaption>Foto asli</figcaption>
                </figure>
                {results.length ? results.map((result, resultIndex) => (
                  <figure className="comparison-media" key={result.id}>
                    <div className="comparison-image">
                      {result.mask_url
                        ? <ProtectedImage src={result.mask_url} alt={`Visualisasi AI, ${label}, hasil ${resultIndex + 1}`} />
                        : <span className="comparison-placeholder">Visualisasi AI belum tersedia.</span>}
                    </div>
                    <figcaption>Visualisasi AI{results.length > 1 ? ` · ${resultIndex + 1}` : ''}</figcaption>
                  </figure>
                )) : (
                  <figure className="comparison-media">
                    <div className="comparison-image"><span className="comparison-placeholder">Foto belum dianalisis.</span></div>
                    <figcaption>Visualisasi AI</figcaption>
                  </figure>
                )}
              </div>

              {results.map((result, resultIndex) => (
                <div className="comparison-result" key={result.id}>
                  {results.length > 1 && <p className="comparison-result-label">Hasil AI {resultIndex + 1}</p>}
                  <dl className="monitoring-metrics comparison-metrics">
                    <div><dt>Klasifikasi AI</dt><dd>{result.finding_type || 'Belum tersedia'}</dd></div>
                    <div><dt>Keyakinan Klasifikasi</dt><dd>{formatConfidence(result.confidence)}</dd></div>
                    <div><dt>Area Visual Terdeteksi</dt><dd>{result.ulcer_area_percent == null ? 'Belum tersedia' : `${result.ulcer_area_percent.toFixed(2)}%`}</dd></div>
                  </dl>
                </div>
              ))}
              {!results.length && <p className="comparison-empty">Hasil AI belum tersedia untuk foto ini.</p>}
            </section>
          )
        })}
        {!photos.length && <p className="comparison-empty">Foto belum tersedia.</p>}
      </div>

      <footer className="comparison-review">
        <div className="comparison-review-heading"><span>Review tenaga kesehatan</span><ReviewBadge value={detail.medical_review?.review_status} /></div>
        {detail.medical_review && (
          <div className="comparison-review-notes">
            {detail.medical_review.notes && <p>{detail.medical_review.notes}</p>}
            {detail.medical_review.conclusion && <p><strong>Kesimpulan:</strong> {detail.medical_review.conclusion}</p>}
            {detail.medical_review.followup_recommendation && <p><strong>Tindak lanjut:</strong> {detail.medical_review.followup_recommendation}</p>}
          </div>
        )}
      </footer>
    </article>
  )
}

export function ExaminationComparison({ id }: { id: number }) {
  const resource = useResource(() => getComparison(id), id)
  if (resource.loading) return <LoadingState label="Memuat perbandingan pemeriksaan..." />
  if (resource.error || !resource.value) return <ErrorState message={resource.error || 'Perbandingan belum tersedia.'} retry={resource.reload} />
  const { current, previous } = resource.value

  return (
    <section className="examination-comparison" aria-label="Perbandingan pemeriksaan">
      <header className="comparison-heading">
        <h2>Perbandingan Pemeriksaan</h2>
        <p className="muted">Bandingkan foto asli, visualisasi AI, dan hasil setiap pemeriksaan. Sudut foto, pencahayaan, dan area foto dapat berbeda.</p>
      </header>
      {previous ? (
        <div className="comparison-grid">
          <ComparisonPanel detail={previous} label="Pemeriksaan sebelumnya" />
          <ComparisonPanel detail={current} label="Pemeriksaan dipilih" />
        </div>
      ) : <p className="card comparison-empty">Belum ada pemeriksaan sebelumnya untuk dibandingkan.</p>}
    </section>
  )
}
