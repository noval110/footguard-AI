import type { RiskCategory, ReviewStatus } from '../api/types'

export const dateLabel = (value: string) => new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(value))
export const riskLabel: Record<RiskCategory, string> = { low: 'Rendah', moderate: 'Sedang', high: 'Tinggi' }
export const reviewLabel: Record<ReviewStatus, string> = { pending: 'Menunggu', approved: 'Disetujui', needs_followup: 'Perlu tindak lanjut' }
export const examStatusLabel: Record<string, string> = { pending: 'Dalam proses', completed: 'Selesai', reviewed: 'Ditinjau' }
