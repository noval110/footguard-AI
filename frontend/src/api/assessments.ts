import { request } from './client'
import type { Assessment, AssessmentInput } from './types'

export const createAssessment = (data: AssessmentInput) => request<Assessment>('/api/assessments', { method: 'POST', body: JSON.stringify(data) })
export const getLatestAssessment = () => request<Assessment>('/api/assessments/latest')
