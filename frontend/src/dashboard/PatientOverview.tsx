import { ArrowRight, BookOpen, CalendarDays, Check, ClipboardCheck, Footprints, ScanLine, ShieldCheck, Stethoscope } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { ExaminationDetail, User } from '../api/types'
import { ButtonLink, ProtectedImage, ReviewBadge, RiskBadge, SafetyNote } from '../components/UI'
import { NoExaminations } from '../components/Feedback'
import { StatusBadge } from '../components/ExaminationUI'
import { dateLabel } from '../utils/format'
import { latestPhoto, visualSummary } from '../utils/examination'
import { education } from '../data/education'
import photo from '../assets/editorial-feet.png'

type Props = { user: User; examinationCount: number; examinations: ExaminationDetail[] }

function LatestExamination({ detail }: { detail: ExaminationDetail }) {
  const image = latestPhoto(detail)
  const result = detail.ai_results[0]
  return <div className="fresh-latest-body">
    <div className="fresh-exam-image">{image ? <ProtectedImage src={image.image_url} alt="Foto kaki pada pemeriksaan terakhir" /> : <><Footprints size={45} strokeWidth={1.2} /><span>Belum ada foto</span></>}</div>
    <div className="fresh-exam-details"><div className="fresh-exam-meta"><span><CalendarDays size={14} />{dateLabel(detail.examination.examined_at)}</span><StatusBadge status={detail.examination.status} /></div><h3>{visualSummary(detail.ai_results)}</h3><p>{detail.risk_result?.explanation || 'Risiko klinis akan ditampilkan setelah dinilai oleh tenaga kesehatan.'}</p><dl><div><dt>Risiko kaki diabetik</dt><dd><RiskBadge value={detail.risk_result?.risk_category} /></dd></div><div><dt>Keyakinan Klasifikasi</dt><dd>{result && Number.isFinite(result.confidence) ? `${(result.confidence * 100).toFixed(2)}%` : 'Belum tersedia'}</dd></div></dl><Link className="inline-link" to={`/patient/result/${detail.examination.id}`}>Lihat hasil pemeriksaan <ArrowRight size={15} /></Link></div>
  </div>
}

export function PatientOverview({ user, examinationCount, examinations }: Props) {
  const latest = examinations[0]
  const hour = new Date().getHours()
  const greeting = hour < 11 ? 'Selamat pagi' : hour < 15 ? 'Selamat siang' : hour < 18 ? 'Selamat sore' : 'Selamat malam'
  const steps = [
    { title: 'Informasi kesehatan', text: 'Data klinis sebagai konteks pemeriksaan.', done: !!latest?.assessment },
    { title: 'Dokumentasi foto kaki', text: 'Foto dan hasil analisis visual tersimpan.', done: !!latest?.ai_results.length },
    { title: 'Review tenaga kesehatan', text: 'Catatan peninjauan dan tindak lanjut.', done: !!latest?.medical_review && latest.medical_review.review_status !== 'pending' },
  ]
  return <div className="fresh-dashboard">
    <section className="fresh-welcome"><div><span className="eyebrow">DASHBOARD PASIEN</span><h1>{greeting}, {user.name.split(' ')[0] || 'Pasien'}.</h1><p>Luangkan perhatian untuk setiap langkah.<br />Pantau kondisi kaki dan lanjutkan perawatan Anda.</p><ButtonLink to="/patient/assessment"><ScanLine size={17} />Mulai Pemeriksaan Baru</ButtonLink></div><div className="fresh-welcome-photo"><img src={photo} alt="Kaki melangkah dalam cahaya alami" /><span><ShieldCheck size={16} />Langkah kecil, perhatian berarti.</span></div></section>
    <section className="fresh-summary-grid" aria-label="Ringkasan pemeriksaan">
      <article><span className="fresh-stat-icon"><ClipboardCheck size={20} /></span><span>Total pemeriksaan</span><strong>{examinationCount}<small> pemeriksaan</small></strong><p>Tersimpan dalam riwayat Anda</p></article>
      <article><span className="fresh-stat-icon"><CalendarDays size={20} /></span><span>Pemeriksaan terakhir</span><strong className="fresh-stat-date">{latest ? dateLabel(latest.examination.examined_at) : 'Belum tersedia'}</strong><p>{latest ? `Pemeriksaan #${latest.examination.id}` : 'Mulai pemeriksaan pertama Anda'}</p></article>
      <article><span className="fresh-stat-icon"><ShieldCheck size={20} /></span><span>Risiko terakhir</span><div className="fresh-stat-badge"><RiskBadge value={latest?.risk_result?.risk_category} /></div><p>Berdasarkan penilaian klinis</p></article>
      <article><span className="fresh-stat-icon"><Stethoscope size={20} /></span><span>Review tenaga kesehatan</span><div className="fresh-stat-badge"><ReviewBadge value={latest?.medical_review?.review_status} /></div><p>{latest ? 'Status pemeriksaan terakhir' : 'Tersedia setelah pemeriksaan'}</p></article>
    </section>
    <div className="fresh-dashboard-grid"><section className={`fresh-panel fresh-latest-panel${latest ? '' : ' is-empty'}`}><div className="fresh-panel-heading"><div><span className="eyebrow">PEMANTAUAN ANDA</span><h2>Pemeriksaan Terakhir</h2></div><ScanLine size={21} /></div>{latest ? <LatestExamination detail={latest} /> : <NoExaminations />}</section><section className="fresh-panel fresh-progress"><div className="fresh-panel-heading"><div><span className="eyebrow">SATU ALUR PERAWATAN</span><h2>Langkah Pemeriksaan</h2></div></div><ol>{steps.map(({ title, text, done }, index) => <li key={title}><span className={done ? 'is-done' : ''}>{done ? <Check size={15} /> : index + 1}</span><div><strong>{title}</strong><p>{text}</p><small>{done ? 'Sudah tersedia' : 'Belum tersedia'}</small></div></li>)}</ol><Link to={latest ? `/patient/result/${latest.examination.id}` : '/patient/assessment'} className="inline-link">{latest ? 'Buka pemeriksaan' : 'Mulai langkah pertama'}<ArrowRight size={15} /></Link></section></div>
    <section className="fresh-panel"><div className="fresh-panel-heading"><div><span className="eyebrow">CATATAN DARI WAKTU KE WAKTU</span><h2>Riwayat Pemeriksaan</h2></div><Link to="/patient/history" className="inline-link">Lihat semua <ArrowRight size={15} /></Link></div>{examinations.length ? <div className="fresh-history">{examinations.slice(0, 4).map(detail => <div className="fresh-history-item" key={detail.examination.id}><span className="fresh-history-icon"><Footprints size={22} /></span><div><strong>Pemeriksaan #{detail.examination.id}</strong><small>{dateLabel(detail.examination.examined_at)}</small></div><RiskBadge value={detail.risk_result?.risk_category} /><ReviewBadge value={detail.medical_review?.review_status} /><Link to={`/patient/result/${detail.examination.id}`} aria-label={`Lihat pemeriksaan ${detail.examination.id}`}>Lihat detail<ArrowRight size={15} /></Link></div>)}</div> : <p className="fresh-empty">Belum ada riwayat pemeriksaan. Catatan Anda akan tampil di sini setelah pemeriksaan pertama.</p>}</section>
    <section><div className="fresh-panel-heading"><div><span className="eyebrow">KENALI PERAWATAN KAKI</span><h2>Teman Belajar Anda</h2></div><Link className="inline-link" to="/patient/education">Semua panduan<ArrowRight size={15} /></Link></div><div className="fresh-education-grid">{education.slice(0, 3).map(article => <Link className="fresh-education-card" to="/patient/education" key={article.id}><span className="fresh-education-icon"><BookOpen size={22} strokeWidth={1.6} /></span><span>{article.readMinutes} menit baca</span><h3>{article.title}</h3><p>{article.summary}</p><strong>Baca panduan<ArrowRight size={15} /></strong></Link>)}</div></section>
    <SafetyNote />
  </div>
}
