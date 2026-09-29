import { AlertCircle, Footprints, LoaderCircle, RotateCw } from 'lucide-react'
import { ButtonLink } from './UI'

export function LoadingState({ label = 'Memuat data...', variant = 'default' }: { label?: string; variant?: 'default' | 'dashboard' }) {
  if (variant === 'dashboard') return <div className="loading-dashboard" role="status" aria-live="polite" aria-busy="true">
    <div className="loading-dashboard-intro"><span className="loading-brand-mark"><Footprints size={22} strokeWidth={1.8} /></span><div><strong>Menyiapkan dashboard Anda</strong><p>{label}</p></div><span className="loading-dots" aria-hidden="true"><i /><i /><i /></span></div>
    <div className="loading-hero" aria-hidden="true"><div className="loading-hero-copy"><span className="loading-shape loading-line loading-line-short" /><span className="loading-shape loading-line loading-line-title" /><span className="loading-shape loading-line loading-line-medium" /><span className="loading-shape loading-line loading-line-small" /><span className="loading-shape loading-button" /></div><div className="loading-hero-art"><Footprints size={62} strokeWidth={1.2} /></div></div>
    <div className="loading-stat-grid" aria-hidden="true">{Array.from({ length: 4 }, (_, index) => <div className="loading-stat" key={index}><span className="loading-shape loading-stat-icon" /><span className="loading-shape loading-line loading-line-medium" /><span className="loading-shape loading-line loading-line-value" /><span className="loading-shape loading-line loading-line-small" /></div>)}</div>
    <div className="loading-panel-grid" aria-hidden="true"><div className="loading-panel"><span className="loading-shape loading-line loading-line-short" /><span className="loading-shape loading-line loading-line-title" /><div className="loading-panel-body"><span className="loading-shape loading-panel-image" /><div><span className="loading-shape loading-line loading-line-medium" /><span className="loading-shape loading-line loading-line-title" /><span className="loading-shape loading-line loading-line-small" /></div></div></div><div className="loading-panel"><span className="loading-shape loading-line loading-line-short" /><span className="loading-shape loading-line loading-line-title" /><span className="loading-shape loading-line loading-line-medium" /><span className="loading-shape loading-line loading-line-small" /><span className="loading-shape loading-line loading-line-medium" /></div></div>
  </div>
  return <div className="feedback-state loading-state" role="status" aria-live="polite" aria-busy="true"><span className="loading-state-icon"><LoaderCircle size={25} strokeWidth={1.8} /></span><div><strong>Menyiapkan halaman</strong><p>{label}</p></div><span className="loading-dots" aria-hidden="true"><i /><i /><i /></span></div>
}
export function ErrorState({ message, retry }: { message: string; retry?: () => void }) { return <div className="feedback-state error-feedback" role="alert"><AlertCircle size={25} /><p>{message}</p>{retry && <button type="button" className="button button-secondary" onClick={retry}><RotateCw size={15} /> Coba lagi</button>}</div> }
export function NoExaminations() {
  return <div className="feedback-state no-examinations">
    <span className="no-examinations-icon" aria-hidden="true"><Footprints size={26} strokeWidth={1.7} /></span>
    <h3>Belum ada pemeriksaan</h3>
    <p>Mulai pemeriksaan pertama untuk mendokumentasikan kondisi kaki. Hasilnya akan tampil di sini.</p>
    <ButtonLink to="/patient/assessment">Mulai Pemeriksaan</ButtonLink>
  </div>
}
