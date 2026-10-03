import { useCallback, useEffect, useRef, useState } from 'react'
import { getRealtimeTicket, realtimeURL, type RealtimeEvent } from '../api/consultations'

export function useRealtime(userId: number) {
  const socket = useRef<WebSocket | null>(null)
  const subscribers = useRef(new Set<(event: RealtimeEvent) => void>())
  const [connected, setConnected] = useState(false)
  const [version, setVersion] = useState(0)
  useEffect(() => {
    let alive = true
    let retry: ReturnType<typeof setTimeout>
    let ping: ReturnType<typeof setInterval>
    let cursor: number | undefined
    let failures = 0
    async function connect() {
      try {
        const ticket = await getRealtimeTicket()
        if (!alive) return
        cursor = cursor ?? ticket.cursor
        const ws = new WebSocket(realtimeURL())
        socket.current = ws
        ws.onopen = () => ws.send(JSON.stringify({ ticket: ticket.ticket, cursor: cursor ?? ticket.cursor }))
        ws.onmessage = message => {
          try {
            const event = JSON.parse(message.data) as RealtimeEvent
            if (event.kind === 'ready') {
              failures = 0; setConnected(true); setVersion(v => v + 1)
              ping = setInterval(() => { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ kind: 'ping' })) }, 20000)
              return
            }
            if (event.id) cursor = event.id
            setVersion(v => v + 1)
            subscribers.current.forEach(listener => listener(event))
          } catch { /* Ignore malformed transport frames; never render their content. */ }
        }
        ws.onclose = () => {
          clearInterval(ping)
          if (!alive) return
          setConnected(false)
          retry = setTimeout(connect, Math.min(30000, 1000 * 2 ** Math.min(failures++, 5)))
        }
        ws.onerror = () => ws.close()
      } catch {
        if (alive) retry = setTimeout(connect, 5000)
      }
    }
    void connect()
    return () => { alive = false; clearTimeout(retry); clearInterval(ping); socket.current?.close(); socket.current = null }
  }, [userId])
  const subscribe = useCallback((listener: (event: RealtimeEvent) => void) => {
    subscribers.current.add(listener)
    return () => { subscribers.current.delete(listener) }
  }, [])
  const send = useCallback((kind: string, callId: number, data?: unknown) => {
    if (socket.current?.readyState !== WebSocket.OPEN) throw new Error('Realtime unavailable')
    socket.current.send(JSON.stringify({ kind, call_id: callId, data }))
  }, [])
  return { connected, version, subscribe, send }
}
