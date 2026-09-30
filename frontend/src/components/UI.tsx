import type { ReactNode } from 'react'
import { Activity, ArrowRight, Footprints, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { RiskCategory, ReviewStatus } from '../api/types'
import { reviewLabel, riskLabel } from '../utils/format'
import { useImageSource } from '../hooks/useImageSource'

export function Logo({ compact = false }: { compact?: boolean }) { return <Link to="/" className="logo" aria-label="FootGuard beranda"><span className="logo-mark"><Footprints size={25} strokeWidth={2.3} /></span><span className="logo-text"><strong>FootGuard</strong>{!compact && <small>See Today, Healthier Tomorrow</small>}</span></Link> }
export function ButtonLink({ to, children, secondary = false, className = '' }: { to: string; children: ReactNode; secondary?: boolean; className?: string }) { return <Link to={to} className={`button ${secondary ? 'button-secondary' : ''} ${className}`}>{children}<ArrowRight size={16} /></Link> }
export function RiskBadge({ value }: { value?: RiskCategory | null }) {
  if (!value) return <span className="badge risk-none"><span className="badge-dot" />Belum dinilai</span>
  return <span className={`badge risk-${riskLabel[value].toLowerCase()}`}><span className="badge-dot" />{riskLabel[value]}</span>
}
export function ReviewBadge({ value }: { value?: ReviewStatus | null }) {
  if (!value) return <span className="badge review-pending"><span className="badge-dot" />Belum ditinjau</span>
  return <span className={`badge review-${value === 'approved' ? 'done' : value === 'pending' ? 'pending' : 'follow'}`}>{reviewLabel[value]}</span>
}
export function PageHeader({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: ReactNode }) { return <div className="page-header"><div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h1>{title}</h1>{description && <p className="muted">{description}</p>}</div>{action && <div className="page-action">{action}</div>}</div> }
export function StatCard({ icon, label, value, detail }: { icon: ReactNode; label: string; value: string | number; detail: string }) { return <div className="stat-card"><div className="stat-icon">{icon}</div><span>{label}</span><strong>{value}</strong><small>{detail}</small></div> }
export function Stepper({ current }: { current: 1 | 2 | 3 }) { return <div className="stepper" aria-label="Tahapan pemeriksaan">{['Data Klinis', 'Foto Kaki', 'Hasil'].map((step, i) => <div className={`step ${current === i + 1 ? 'active' : ''} ${current > i + 1 ? 'completed' : ''}`} key={step}><span>{i + 1}</span>{step}</div>)}</div> }
export function ProtectedImage({ src, alt, className }: { src?: string | null; alt: string; className?: string }) { const resolved = useImageSource(src); return resolved ? <img src={resolved} alt={alt} className={className} /> : <span className="small muted">{src ? 'Memuat gambar...' : 'Belum ada gambar'}</span> }
export function FootImageCard({ small = false, src }: { small?: boolean; src?: string }) { const resolved = useImageSource(src); return <div className={`foot-image ${small ? 'foot-image-small' : ''}`} >{resolved ? <img src={resolved} alt="Foto kaki" /> : <Footprints size={small ? 28 : 65} strokeWidth={1} aria-hidden="true" />}<span>Foto Kaki</span></div> }
export function EmptyState({ text }: { text: string }) { return <div className="empty-state"><Activity size={25} /><p>{text}</p></div> }
export function SafetyNote() { return <div className="safety-note"><ShieldCheck size={18} /><span>FootGuard merupakan alat bantu skrining dan monitoring. Hasil tidak menggantikan pemeriksaan tenaga kesehatan.</span></div> }
export function AIStatusBadge({ ready = true, label = 'AI System Ready', sublabel = 'Monitoring aktif' }: { ready?: boolean; label?: string; sublabel?: string }) { return <div className="fg-ai-status-indicator"><div className="status-icon">{ready ? <ShieldCheck size={18} /> : <Footprints size={18} />}</div><div><strong>{label}</strong>{sublabel && <small>{sublabel}</small>}</div></div> }
