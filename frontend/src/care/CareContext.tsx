import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { listConversations, listNotifications, type Notification } from '../api/consultations'
import { useAuth } from '../auth/useAuth'
import { useRealtime } from '../hooks/useRealtime'
import { useVoiceCall } from '../hooks/useVoiceCall'
import { CallPanel } from '../components/CallPanel'

import { CareContext } from './context'
export function CareProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const realtime = useRealtime(user!.id)
  const { subscribe, connected } = realtime
  const voice = useVoiceCall(user!.id, realtime)
  const [unread, setUnread] = useState(0)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [version, setVersion] = useState(0)
  useEffect(() => {
    let active = true
    const refresh = async () => {
      try {
        const [conversations, notices] = await Promise.all([listConversations(), listNotifications()])
        if (active) { setUnread(conversations.reduce((sum, c) => sum + c.unread_count, 0)); setNotifications(notices) }
      } catch { /* Pages provide actionable errors; keep the navigation usable. */ }
    }
    void refresh()
    const interval = setInterval(refresh, 30000)
    const unsubscribe = subscribe(event => { if (!event.kind.startsWith('ice_') && !event.kind.startsWith('call_')) void refresh() })
    return () => { active = false; clearInterval(interval); unsubscribe() }
  }, [subscribe, connected, version])
  const refresh = useCallback(() => setVersion(v => v + 1), [])
  return <CareContext.Provider value={{ realtime, voice, unread, notifications, refresh }}>{children}<CallPanel /></CareContext.Provider>
}
