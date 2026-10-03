import { createContext } from 'react'
import type { Notification } from '../api/consultations'
import type { useRealtime } from '../hooks/useRealtime'
import type { useVoiceCall } from '../hooks/useVoiceCall'

export type Care = { realtime: ReturnType<typeof useRealtime>; voice: ReturnType<typeof useVoiceCall>; unread: number; notifications: Notification[]; refresh: () => void }
export const CareContext = createContext<Care | null>(null)
