import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Footprints,
  Info,
  ShieldCheck,
  Stethoscope
} from 'lucide-react'
import type { AIResult, ExaminationDetail } from '../api/types'
import { ProtectedImage } from './UI'
import { dateLabel } from '../utils/format'

interface VisualAnalysisProps {
  detail: ExaminationDetail
  results: AIResult[]
}

export function VisualAnalysis({ detail, results }: VisualAnalysisProps) {
  if (!results.length) {
    return (
      <div style={{ textAlign: 'center', padding: '36px 20px', color: 'var(--fg-text-muted)' }}>
        <Footprints size={40} strokeWidth={1.2} />
        <p style={{ marginTop: '12px', fontSize: '13px' }}>
          Belum ada foto yang dianalisis. Unggah foto kaki untuk melihat hasil analisis visual berbantuan AI.
        </p>
      </div>
    )
  }

  return (
    <div className="fg-visual-analysis-container">
      {results.map(item => {
        const photo = detail.foot_images.find(image => image.id === item.foot_image_id)

        const detected = item.ulcer_detected === true
        const clear = item.ulcer_detected === false

        const confidenceLabel = Number.isFinite(item.confidence) ? `${(item.confidence * 100).toFixed(1)}%` : 'Belum tersedia'
        const ulcerAreaPercent =
          item.ulcer_area_percent !== null && item.ulcer_area_percent !== undefined
            ? `${item.ulcer_area_percent.toFixed(2)}%`
            : 'Belum tersedia'

        const conclusionTitle = detected
          ? 'Area Memerlukan Pemeriksaan Lebih Lanjut'
          : clear
          ? 'Tidak Ditemukan Area Lesi pada Foto'
          : 'Temuan Visual Tersedia'

        const explanation = detected
          ? 'Pada foto kaki, model analisis visual AI mendeteksi pola yang menyerupai lesi atau ulkus awal pada area plantar/telapak. Temuan ini menunjukkan adanya area yang patut mendapat perhatian klinis, namun bukan merupakan penetapan diagnosis definitif.'
          : clear
          ? 'Pada foto kaki, model analisis visual AI tidak menemukan area yang melampaui ambang batas deteksi. Meskipun demikian, kualitas pencahayaan, sudut pengambilan gambar, dan keluhan subyektif tetap memerlukan konfirmasi tenaga medis.'
          : 'Hasil analisis ini menyajikan pola visual awal dari model kecerdasan buatan. Tenaga kesehatan berwenang tetap perlu menilai foto dan kondisi fisik kaki secara langsung.'

        const nextStep = detected
          ? 'Jadwalkan konsultasi dengan tenaga medis untuk evaluasi fisik langsung dan tindak lanjut perawatan yang tepat.'
          : 'Lanjutkan perawatan dan inspeksi harian. Bila terdapat rasa kebas, panas, atau nyeri, segera konsultasikan ke fasilitas kesehatan.'

        return (
          <section className="fg-visual-result-card" key={item.id} aria-label="Analisis kaki">
            {/* Header */}
            <div className="fg-visual-card-head">
              <div>
                <span className="eyebrow">
                  AI ASSISTED ANALYSIS · KAKI
                </span>
                <h3>Pemeriksaan Kaki</h3>
                <small style={{ color: 'var(--fg-text-muted)', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                  <CalendarDays size={13} /> {dateLabel(item.created_at)}
                </small>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="fg-model-tag">
                  <ShieldCheck size={14} /> {item.model_version ? `Model AI ${item.model_version}` : 'Versi model belum tersedia'}
                </span>
                <span className={`badge ${detected ? 'risk-sedang' : clear ? 'risk-rendah' : 'risk-none'}`}>
                  {detected ? 'Temuan Visual Terdeteksi' : clear ? 'Tidak Ada Temuan Visual' : 'Hasil Belum Lengkap'}
                </span>
              </div>
            </div>

            {/* Dual Pane Comparison (Foto Asli vs Visualisasi AI) */}
            <div className="fg-visual-comparison-grid">
              {/* Original Photo */}
              <div className="fg-visual-pane">
                <div className="fg-visual-pane-img">
                  <ProtectedImage
                    src={photo?.image_url}
                    alt="Foto asli kaki"
                  />
                </div>
                <div className="fg-visual-pane-caption">
                  <span>Foto Asli Kaki</span>
                  <small>Dokumentasi Pasien</small>
                </div>
              </div>

              {/* AI Detection Overlay */}
              <div className="fg-visual-pane">
                <div className="fg-visual-pane-img">
                  {item.mask_url ? (
                    <ProtectedImage
                      src={item.mask_url}
                      alt="Visualisasi AI kaki"
                    />
                  ) : (
                    <div className="fg-visual-unavailable" role="status">
                      <Info size={24} aria-hidden="true" />
                      <strong>Visualisasi belum tersedia</strong>
                      <span>Area yang ditandai akan tampil jika tersedia dari hasil analisis.</span>
                    </div>
                  )}
                </div>
                <div className="fg-visual-pane-caption">
                  <span>{item.mask_url ? 'Area yang Ditandai' : 'Foto Asli · Visualisasi Belum Tersedia'}</span>
                  <small style={{ color: detected ? '#B45309' : '#047857', fontWeight: 600 }}>
                    {item.mask_url ? 'Visualisasi hasil analisis' : 'Area hanya ditampilkan jika tersedia dari analisis'}
                  </small>
                </div>
              </div>
            </div>

            {/* Metrics Bar */}
            <div className="fg-metrics-row">
              <div className="fg-metric-box">
                <span className="fg-metric-box-title">Keyakinan AI</span>
                <span className="fg-metric-box-value">{confidenceLabel}</span>
                <span className="fg-metric-box-desc">
                  Tingkat keyakinan model terhadap temuan visual.
                </span>
              </div>

              <div className="fg-metric-box">
                <span className="fg-metric-box-title">Area yang Ditandai</span>
                <span className="fg-metric-box-value">{ulcerAreaPercent}</span>
                <span className="fg-metric-box-desc">
                  Persentase bidang visual yang terdeteksi AI.
                </span>
              </div>

              <div className="fg-metric-box">
                <span className="fg-metric-box-title">Klasifikasi Visual</span>
                <span className="fg-metric-box-value" style={{ fontSize: '1.25rem', color: detected ? '#B45309' : '#047857' }}>
                  {detected ? 'Perlu Perhatian' : clear ? 'Tidak Ada Temuan Visual' : 'Belum Tersedia'}
                </span>
                <span className="fg-metric-box-desc">
                  Kategori visual berbantuan AI.
                </span>
              </div>
            </div>

            {/* Interpretation & Next Steps */}
            <div className="fg-interpretation-box">
              <div className="fg-interpretation-icon">
                {detected ? (
                  <AlertTriangle size={22} color="#D97706" />
                ) : (
                  <CheckCircle2 size={22} color="var(--fg-secondary)" />
                )}
              </div>
              <div className="fg-interpretation-content">
                <span className="eyebrow" style={{ color: 'var(--fg-primary)' }}>
                  INTERPRETASI ANALISIS VISUAL
                </span>
                <h4>{conclusionTitle}</h4>
                <p>{explanation}</p>

                <div className="fg-next-step-strip">
                  <Stethoscope size={16} />
                  <span>
                    <strong>Langkah selanjutnya:</strong> {nextStep}
                  </span>
                </div>
              </div>
            </div>

            {/* Non-Diagnostic Disclaimer */}
            <div className="fg-clinical-disclaimer" role="note">
              <Info size={17} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong>AI assisted analysis — Bukan diagnosis medis:</strong> Analisis visual DIA SCAN berfungsi sebagai alat skrining awal dan pemantauan mandiri. Seluruh hasil temuan harus dikonfirmasi melalui evaluasi klinis langsung oleh dokter atau tenaga kesehatan profesional.
              </div>
            </div>
          </section>
        )
      })}
    </div>
  )
}

export default VisualAnalysis
