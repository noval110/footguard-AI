import type { AIResult, ExaminationDetail } from '../api/types'

export function latestPhoto(detail: ExaminationDetail, side: 'left' | 'right') {
  return [...detail.foot_images].reverse().find(image => image.foot_side === side && image.image_type === 'photo')
}

export function visualSummary(results: AIResult[]) {
  if (!results.length) return 'Belum dianalisis'
  if (results.some(item => item.ulcer_detected === true)) return 'Area yang perlu diperhatikan terdeteksi'
  if (results.every(item => item.ulcer_detected === false)) return 'Tidak ditemukan area yang perlu diperhatikan pada foto'
  return 'Hasil analisis tersedia'
}
