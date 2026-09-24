import { request } from './client'
import type { ExaminationDetail, MedicalReview, ProviderPatient, ReviewInput, RiskInput, RiskResult } from './types'

export const listProviderPatients = () => request<ProviderPatient[]>('/api/provider/patients')
export const getProviderExamination = (id: number) => request<ExaminationDetail>(`/api/provider/examinations/${id}`)
export const createRiskResult = (id: number, data: RiskInput) => request<RiskResult>(`/api/examinations/${id}/risk-result`, { method: 'POST', body: JSON.stringify(data) })
export const saveMedicalReview = (id: number, data: ReviewInput) => request<MedicalReview>(`/api/provider/examinations/${id}/review`, { method: 'POST', body: JSON.stringify(data) })
