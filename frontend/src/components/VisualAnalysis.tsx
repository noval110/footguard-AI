import type { AIResult, ExaminationDetail } from '../api/types'
import { ProtectedImage } from './UI'
import { dateLabel } from '../utils/format'
import { CircleAlert, CircleCheck, Stethoscope } from 'lucide-react'

export function VisualAnalysis({ detail, results }: { detail: ExaminationDetail; results: AIResult[] }) {
  if (!results.length) return <p className="empty-inline">Belum ada foto yang dianalisis. Tambahkan foto untuk melihat hasil visual.</p>
  return <div className="visual-results">{results.map(item => {
    const photo = detail.foot_images.find(image => image.id === item.foot_image_id)
    const side = photo?.foot_side === 'left' ? 'kiri' : photo?.foot_side === 'right' ? 'kanan' : 'tidak diketahui'
    const detected = item.ulcer_detected === true
    const clear = item.ulcer_detected === false
    const conclusion = detected ? 'Perlu diperiksa lebih lanjut' : clear ? 'Tidak ada area luka yang ditandai AI' : 'Temuan visual tersedia'
    const explanation = detected
      ? `Pada foto kaki ${side}, AI menemukan area dengan tampilan yang menyerupai luka atau ulkus. Hasil ini menunjukkan kemungkinan temuan visual dan belum memastikan diagnosis, penyebab, infeksi, atau tingkat keparahan.`
      : clear
        ? `Pada foto kaki ${side}, tidak ada area yang melewati ambang deteksi model. Hasil ini tidak memastikan kaki sepenuhnya bebas luka atau masalah lain karena kualitas foto dan kondisi yang tidak terlihat jelas dapat memengaruhi analisis.`
        : 'Hasil lama ini berisi temuan visual dari model. Tenaga kesehatan tetap perlu menilai foto dan kondisi kaki secara menyeluruh.'
    const nextStep = detected
      ? 'Minta tenaga kesehatan meninjau hasil ini dan kondisi kaki secara langsung. Jangan menentukan perawatan hanya dari hasil AI.'
      : 'Lanjutkan pemantauan. Jika Anda melihat perubahan atau memiliki keluhan meskipun AI tidak menandai area, konsultasikan dengan tenaga kesehatan.'
    const FindingIcon = detected ? CircleAlert : clear ? CircleCheck : Stethoscope
    return <section className="visual-result" key={item.id}>
      <div className="visual-result-head"><div><span className="eyebrow">FOTO {side.toUpperCase()} / {dateLabel(item.created_at)}</span><h4>Kaki {side}</h4></div><span className="small muted">Model {item.model_version}</span></div>
      <div className={`scan-finding-status ${detected ? 'finding-detected' : 'finding-clear'}`}><span className="scan-status-dot" aria-hidden="true" /><div><span>KESIMPULAN FOTO</span><strong>{conclusion}</strong></div></div>
      <div className={`ai-interpretation ${detected ? 'needs-attention' : 'no-marked-area'}`}><FindingIcon size={24} /><div><span className="eyebrow">APA ARTI HASIL INI?</span><h5>{detected ? 'Ada kemungkinan area kaki yang terdampak' : clear ? 'Tidak ada temuan yang cukup kuat pada foto' : 'Hasil memerlukan peninjauan'}</h5><p>{explanation}</p><div className="ai-next-step"><Stethoscope size={17} /><span><strong>Langkah berikutnya</strong>{nextStep}</span></div></div></div>
      <div className="scan-analysis-metrics"><div className="scan-metric"><span>Keyakinan temuan</span><strong>{detected ? `${(item.confidence * 100).toFixed(1)}%` : 'Tidak berlaku'}</strong><small>{detected ? 'Keyakinan model pada area yang ditandai. Bukan tingkat keparahan penyakit.' : 'Tidak ada area yang melewati ambang deteksi model.'}</small></div><div className="scan-metric"><span>Area yang ditandai</span><strong>{item.ulcer_area_percent === null ? 'Belum tersedia' : `${item.ulcer_area_percent.toFixed(2)}%`}</strong><small>Persentase bagian gambar yang ditandai AI. Nilai ini bukan ukuran luka fisik.</small></div></div>
      <div className="scan-comparison"><figure><figcaption>Foto asli</figcaption><ProtectedImage src={photo?.image_url} alt={`Foto asli kaki ${side}`} /></figure><span className="comparison-versus" aria-hidden="true">vs</span><figure><figcaption>Visualisasi AI</figcaption><ProtectedImage src={item.mask_url} alt={`Visualisasi AI kaki ${side}`} /></figure></div>
      <p className="small muted comparison-caption">Area berwarna menunjukkan bagian foto yang ditandai model. Analisis visual AI tidak menggantikan pemeriksaan langsung oleh tenaga kesehatan.</p>
    </section>
  })}</div>
}
