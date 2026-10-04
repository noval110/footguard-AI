import { request } from './client'
import type { AIResult, Examination, ExaminationDetail, ReviewStatus, RiskCategory } from './types'

export interface Conversation {
  id: number; patient_id: number; patient_user_id: number; provider_id: number; examination_id: number | null
  patient_name: string; provider_name: string; last_message: string | null; unread_count: number; created_at: string; updated_at: string
}
export interface Message { id: number; conversation_id: number; sender_id: number; sender_name: string; message: string; created_at: string; read_at: string | null; edited_at: string | null; deleted_at: string | null }
export type AppointmentStatus = 'requested' | 'confirmed' | 'completed' | 'cancelled'
export interface Appointment {
  id: number; conversation_id: number; scheduled_at: string; status: AppointmentStatus; notes: string
  patient_name: string; provider_name: string; examination_id: number | null
}
export type CallStatus = 'calling' | 'connecting' | 'connected' | 'ended' | 'failed' | 'rejected'
export interface CallSession { id: number; conversation_id: number; appointment_id: number | null; caller_id: number; status: CallStatus; created_at: string; started_at: string | null; ended_at: string | null }
export interface ProgressEntry { examination: Examination; risk_category: RiskCategory | null; review_status: ReviewStatus | null; ai_results: AIResult[] }
export interface ReviewQueueEntry { examination_id: number; patient_id: number; patient_name: string; examined_at: string; risk_category: RiskCategory | null; review_status: ReviewStatus | null }
export interface Notification { id: number; kind: string; conversation_id: number | null; examination_id: number | null; created_at: string; read_at: string | null }
export interface RealtimeEvent { id?: number; kind: string; payload?: Record<string, unknown> }

const post = (body: unknown) => ({ method: 'POST', body: JSON.stringify(body) })
export const listConversations = () => request<Conversation[]>('/api/conversations')
export const getConversation = (id: number) => request<Conversation>(`/api/conversations/${id}`)
export const createConversation = (data: { patient_id?: number; provider_id?: number; examination_id?: number }) => request<Conversation>('/api/conversations', post(data))
export const listConsultationProviders = () => request<{ id: number; name: string }[]>('/api/consultation/providers')
export const listMessages = (id: number, before?: number, since?: number) => request<Message[]>(`/api/conversations/${id}/messages${before ? `?before=${before}` : since ? `?since=${since}` : ''}`)
export const sendMessage = (id: number, message: string) => request<Message>(`/api/conversations/${id}/messages`, post({ message }))
export const updateMessage = (id: number, messageId: number, message: string) => request<Message>(`/api/conversations/${id}/messages/${messageId}`, { method: 'PATCH', body: JSON.stringify({ message }) })
export const deleteMessage = (id: number, messageId: number) => request<Message>(`/api/conversations/${id}/messages/${messageId}`, { method: 'DELETE' })
export const readMessages = (id: number, through_id: number) => request(`/api/conversations/${id}/read`, post({ through_id }))
export const listAppointments = () => request<Appointment[]>('/api/appointments')
export const createAppointment = (conversation_id: number, scheduled_at: string, notes: string) => request<Appointment>('/api/appointments', post({ conversation_id, scheduled_at, notes }))
export const updateAppointment = (id: number, status: AppointmentStatus) => request<Appointment>(`/api/appointments/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) })
export const createCall = (conversation_id: number, appointment_id?: number) => request<CallSession>('/api/calls', post({ conversation_id, appointment_id }))
export const getCall = (id: number) => request<CallSession>(`/api/calls/${id}`)
export const listCalls = (id: number) => request<CallSession[]>(`/api/conversations/${id}/calls`)
export const updateCall = (id: number, status: CallStatus) => request<CallSession>(`/api/calls/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) })
export const getICEConfig = () => request<{ ice_servers: RTCIceServer[]; turn_configured: boolean }>('/api/calls/ice-config')
export const getRealtimeTicket = () => request<{ ticket: string; cursor: number }>('/api/realtime/ticket', post({}))
export const listNotifications = () => request<Notification[]>('/api/notifications')
export const readNotification = (id: number) => request(`/api/notifications/${id}/read`, post({}))
export const getProgress = (patientId?: number) => request<ProgressEntry[]>(patientId ? `/api/provider/patients/${patientId}/progress` : '/api/progress')
export const getComparison = (id: number) => request<{ current: ExaminationDetail; previous: ExaminationDetail | null }>(`/api/examinations/${id}/comparison`)
export const listReviewQueue = (offset = 0) => request<ReviewQueueEntry[]>(`/api/provider/review-queue?offset=${offset}`)

export function realtimeURL() {
  const url = new URL(`${(import.meta.env.VITE_API_URL || '').replace(/\/$/, '')}/api/realtime`, window.location.origin)
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  return url.toString()
}
export const consultationDate = (value: string) => new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' }).format(new Date(value))
export const appointmentLabel: Record<AppointmentStatus, string> = { requested: 'Diminta', confirmed: 'Dikonfirmasi', completed: 'Selesai', cancelled: 'Dibatalkan' }
