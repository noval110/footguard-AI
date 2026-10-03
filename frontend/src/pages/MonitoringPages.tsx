import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getProgress, listReviewQueue } from '../api/consultations'
import { useAuth } from '../auth/useAuth'
import { useResource } from '../hooks/useResource'
import { ErrorState, LoadingState } from '../components/Feedback'
import { EmptyState, PageHeader, ReviewBadge, RiskBadge } from '../components/UI'
import { ExaminationComparison } from '../components/ExaminationComparison'
import { dateLabel } from '../utils/format'

export function ProgressPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const provider = user?.role === 'provider'
  const resource = useResource(() => getProgress(provider ? Number(id) : undefined), id || 'patient')
  const [selected, setSelected] = useState<number | null>(null)
  if (resource.loading) return <LoadingState label="Memuat perkembangan kondisi..." />
  if (resource.error || !resource.value) return <ErrorState message={resource.error || 'Perkembangan belum tersedia.'} retry={resource.reload} />
  const entries = [...resource.value].reverse()
  const comparable = entries.filter(entry => entry.ai_results.length || entry.risk_category)
  const changed = comparable.length > 1 && (comparable.at(-1)?.risk_category !== comparable.at(-2)?.risk_category ||
    JSON.stringify(comparable.at(-1)?.ai_results.map(a => [a.finding_type, a.ulcer_area_percent])) !== JSON.stringify(comparable.at(-2)?.ai_results.map(a => [a.finding_type, a.ulcer_area_percent])))
  return <div className="monitoring-page"><PageHeader title="Perkembangan Kondisi Kaki" description="Pemantauan dari nilai pemeriksaan yang tersimpan, tanpa kesimpulan medis otomatis." />
    <p className="safety-note">DIA SCAN membantu skrining dan pemantauan kaki diabetik. Hasil AI tidak menggantikan pemeriksaan tenaga kesehatan.</p>
    {!entries.length ? <EmptyState text="Belum cukup pemeriksaan untuk menampilkan perkembangan kondisi." /> : <>
      <section className="card"><h2>{entries.length} pemeriksaan dalam riwayat terbaru</h2><p className="muted">Menampilkan maksimal 100 pemeriksaan terakhir.</p>
        {entries.length === 1 && <p role="status">Perlu minimal dua pemeriksaan untuk melihat perubahan dari waktu ke waktu.</p>}
        {changed && <p role="status">Nilai hasil pemeriksaan berbeda dibanding pemeriksaan sebelumnya. Pertimbangkan untuk meminta review tenaga kesehatan.</p>}
      </section>
      <ol className="condition-timeline" aria-label="Riwayat risiko dan hasil AI">{entries.map(entry => <li key={entry.examination.id} className="card">
        <div className="consultation-row"><strong>{dateLabel(entry.examination.examined_at)}</strong><span>#{entry.examination.id}</span></div>
        <div className="consultation-row"><span>Risiko <RiskBadge value={entry.risk_category} /></span><ReviewBadge value={entry.review_status} /></div>
        {entry.ai_results.map(result => <dl className="monitoring-metrics" key={result.id}><div><dt>Klasifikasi AI</dt><dd>{result.finding_type}</dd></div><div><dt>Keyakinan AI</dt><dd>{(result.confidence * 100).toFixed(1)}%</dd></div><div><dt>Area yang ditandai</dt><dd>{result.ulcer_area_percent == null ? 'Belum tersedia' : `${result.ulcer_area_percent.toFixed(2)}%`}</dd></div></dl>)}
        {!entry.ai_results.length && <p className="muted">Hasil AI belum tersedia.</p>}
        <div className="consultation-actions"><Link to={provider ? `/provider/examinations/${entry.examination.id}` : `/patient/result/${entry.examination.id}`}>Lihat pemeriksaan</Link><button className="button button-secondary" onClick={() => setSelected(entry.examination.id)}>Bandingkan dengan sebelumnya</button></div>
      </li>)}</ol>
      {selected && <ExaminationComparison key={selected} id={selected} />}
    </>}
  </div>
}

export function ReviewQueuePage({ embedded = false }: { embedded?: boolean }) {
  const [offset, setOffset] = useState(0)
  const resource = useResource(() => listReviewQueue(offset), offset)
  if (resource.loading) return <LoadingState label="Memuat antrean review..." />
  if (resource.error || !resource.value) return <ErrorState message={resource.error || 'Antrean belum tersedia.'} retry={resource.reload} />
  const rows = embedded ? resource.value.filter(item => item.review_status !== 'approved').slice(0, 3) : resource.value
  if (embedded) return <section className="review-queue-preview" aria-label="Ringkasan antrean review">
    <div className="review-queue-preview-header"><div><h2>Antrean Review</h2><p className="muted">Tinjau pemeriksaan yang menunggu review dan tindak lanjut.</p></div><Link className="review-queue-link" to="/provider/review-queue">Lihat antrean lengkap <span aria-hidden="true">→</span></Link></div>
    {rows.length ? <details className="review-queue-disclosure"><summary>Lihat {rows.length} pemeriksaan berikutnya</summary><div className="review-queue-preview-list">{rows.map(row => <article className="review-queue-preview-row" key={row.examination_id}><div className="review-queue-patient"><strong>{row.patient_name}</strong><p>#{row.examination_id} · {dateLabel(row.examined_at)}</p></div><div className="review-queue-badges"><RiskBadge value={row.risk_category} /><ReviewBadge value={row.review_status} /></div><Link className="review-queue-link" to={`/provider/examinations/${row.examination_id}`} aria-label={`Tinjau pemeriksaan #${row.examination_id} untuk ${row.patient_name}`}>Tinjau <span aria-hidden="true">→</span></Link></article>)}</div></details> : <p className="muted review-queue-clear">Tidak ada pemeriksaan yang menunggu review.</p>}
  </section>
  return <section className="review-queue">{!embedded && <PageHeader title="Antrean Review" description="Urutan kerja: belum ditinjau menurut kategori risiko tersimpan, tindak lanjut, lalu ditinjau. Tanggal paling lama didahulukan dalam setiap kelompok." />}
    <p className="muted">Urutan ini membantu alur review dan tidak menghasilkan penilaian medis baru.</p>
    {rows.length ? <div className="queue-list">{rows.map(row => <article className="card consultation-row" key={row.examination_id}><div><strong>{row.patient_name}</strong><p>#{row.examination_id} · {dateLabel(row.examined_at)}</p><RiskBadge value={row.risk_category} /> <ReviewBadge value={row.review_status} /></div><Link className="button button-secondary" to={`/provider/examinations/${row.examination_id}`}>Tinjau pemeriksaan</Link></article>)}</div> : <EmptyState text="Tidak ada pemeriksaan yang menunggu review." />}
    {!embedded && <div className="consultation-actions"><button className="button button-secondary" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 100))}>Sebelumnya</button><button className="button button-secondary" disabled={resource.value.length < 100} onClick={() => setOffset(offset + 100)}>Berikutnya</button></div>}
  </section>
}
