import { request } from './client'
import type { Patient, PatientUpdate } from './types'

export const getPatient = () => request<Patient>('/api/patients/me')
export const updatePatient = (data: PatientUpdate) => request<Patient>('/api/patients/me', { method: 'PUT', body: JSON.stringify(data) })
