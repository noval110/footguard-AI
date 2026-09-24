import { AlertCircle, LoaderCircle, RotateCw } from 'lucide-react'
import { ButtonLink } from './UI'

export function LoadingState({ label = 'Memuat data...' }: { label?: string }) { return <div className="feedback-state" role="status"><LoaderCircle className="spin" size={25} /><p>{label}</p></div> }
export function ErrorState({ message, retry }: { message: string; retry?: () => void }) { return <div className="feedback-state error-feedback" role="alert"><AlertCircle size={25} /><p>{message}</p>{retry && <button type="button" className="button button-secondary" onClick={retry}><RotateCw size={15} /> Coba lagi</button>}</div> }
export function NoExaminations() { return <div className="feedback-state"><p>Belum ada pemeriksaan.</p><ButtonLink to="/patient/assessment">Mulai Pemeriksaan</ButtonLink></div> }
