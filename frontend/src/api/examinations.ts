import { ApiError, isNotFound, request } from './client'
import type { AIResult, Examination, ExaminationDetail, FootImage, FootImageInput, PersistedAnalysis, RiskResult } from './types'

export const createExamination = (assessmentId: number) => request<Examination>('/api/examinations', { method: 'POST', body: JSON.stringify({ assessment_id: assessmentId }) })
export const listExaminations = () => request<Examination[]>('/api/examinations')
export const getExamination = (id: number) => request<ExaminationDetail>(`/api/examinations/${id}`)
export const addFootImage = (id: number, data: FootImageInput) => request<FootImage>(`/api/examinations/${id}/images`, { method: 'POST', body: JSON.stringify(data) })
export const analyzeFootImage = async (id: number, file: File): Promise<PersistedAnalysis> => {
  const body = new FormData()
  body.append('file', file)
  body.append('foot_side', 'foot')
  const response = await request<PersistedAnalysis>(`/api/examinations/${id}/analyze`, { method: 'POST', body })
  if (!response.examination?.id || !response.image?.image_url || !response.ai_result?.id) throw new ApiError(502, 'Hasil analisis tidak dapat ditampilkan. Coba lagi nanti.')
  return response
}
export const getAIResults = (id: number) => request<AIResult[]>(`/api/examinations/${id}/ai-results`)
export const getRiskResult = async (id: number): Promise<RiskResult | null> => { try { return await request<RiskResult>(`/api/examinations/${id}/risk-result`) } catch (error) { if (isNotFound(error)) return null; throw error } }
