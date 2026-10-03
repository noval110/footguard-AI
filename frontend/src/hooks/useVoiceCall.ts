import { useCallback, useEffect, useRef, useState } from 'react'
import { createCall, getCall, getConversation, getICEConfig, updateCall, type CallSession, type Conversation, type RealtimeEvent } from '../api/consultations'

export type VoiceState = 'idle' | 'calling' | 'incoming' | 'connecting' | 'connected' | 'ended' | 'failed'
type Transport = { connected: boolean; send: (kind: string, id: number, data?: unknown) => void; subscribe: (handler: (event: RealtimeEvent) => void) => () => void }

export function useVoiceCall(userId: number, transport: Transport) {
  const { connected, send, subscribe } = transport
  const [state, setState] = useState<VoiceState>('idle')
  const [session, setSession] = useState<CallSession | null>(null)
  const [conversation, setConversation] = useState<Conversation | null>(null)
  const [error, setError] = useState('')
  const [muted, setMuted] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const active = useRef<CallSession | null>(null)
  const peer = useRef<RTCPeerConnection | null>(null)
  const local = useRef<MediaStream | null>(null)
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null)
  const offer = useRef<RTCSessionDescriptionInit | null>(null)
  const candidates = useRef(new Map<number, RTCIceCandidateInit[]>())
  const generation = useRef(0)
  const pendingStart = useRef(false)
  const accepting = useRef(false)
  const started = useRef(0)
  const events = useRef(Promise.resolve())
  const sendRef = useRef(send)
  useEffect(() => { sendRef.current = send }, [send])

  const release = useCallback(() => {
    generation.current++
    const connection = peer.current; peer.current = null
    if (connection) { connection.onconnectionstatechange = null; connection.onicecandidate = null; connection.close() }
    local.current?.getTracks().forEach(track => track.stop()); local.current = null
    setRemoteStream(null)
    candidates.current.clear(); offer.current = null; setMuted(false)
    accepting.current = false
  }, [])
  const finish = useCallback(async (failed = false, reject = false) => {
    const call = active.current
    active.current = null; pendingStart.current = false; release()
    setState(failed ? 'failed' : 'ended')
    if (failed) setError('Panggilan tidak dapat tersambung. Periksa koneksi dan coba lagi.')
    if (call) { try { await updateCall(call.id, reject ? 'rejected' : failed ? 'failed' : 'ended') } catch { /* Peer may have ended the call first; server expires abandoned sessions. */ } }
  }, [release])

  const openPeer = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia || !window.RTCPeerConnection) throw new Error('unsupported')
    const attempt = generation.current
    const config = await getICEConfig()
    if (attempt !== generation.current) throw new Error('cancelled')
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
    if (attempt !== generation.current) { stream.getTracks().forEach(track => track.stop()); throw new Error('cancelled') }
    local.current = stream
    const connection = new RTCPeerConnection({ iceServers: config.ice_servers })
    peer.current = connection
    stream.getTracks().forEach(track => connection.addTrack(track, stream))
    connection.onicecandidate = event => {
      if (event.candidate && active.current) { try { sendRef.current('ice_candidate', active.current.id, event.candidate.toJSON()) } catch { void finish(true) } }
    }
    connection.ontrack = event => {
      setRemoteStream(event.streams[0] || new MediaStream([event.track]))
    }
    connection.onconnectionstatechange = () => {
      if (peer.current !== connection) return
      if (connection.connectionState === 'connected') {
        started.current = Date.now(); setState('connected'); setError('')
        if (active.current) void updateCall(active.current.id, 'connected').catch(async () => {
          if (active.current && (await getCall(active.current.id)).status !== 'connected') await finish(true)
        }).catch(() => finish(true))
      } else if (connection.connectionState === 'failed') void finish(true)
      else if (connection.connectionState === 'disconnected') setTimeout(() => { if (peer.current === connection && connection.connectionState === 'disconnected') void finish(true) }, 10000)
    }
    return connection
  }, [finish])
  const microphoneError = (err: unknown) => err instanceof DOMException && err.name === 'NotAllowedError'
    ? 'Izin mikrofon diperlukan untuk panggilan suara.' : err instanceof DOMException && err.name === 'NotFoundError'
      ? 'Mikrofon tidak ditemukan.' : 'Panggilan tidak dapat tersambung. Periksa mikrofon, koneksi, dan gunakan HTTPS.'

  const start = useCallback(async (context: Conversation, appointmentId?: number) => {
    if (!connected || active.current || pendingStart.current) return
    release(); pendingStart.current = true; setError(''); setConversation(context); setSeconds(0); setState('calling')
    const attempt = generation.current
    try {
      const connection = await openPeer()
      const call = await createCall(context.id, appointmentId)
      if (!pendingStart.current || peer.current !== connection) { await updateCall(call.id, 'ended'); return }
      active.current = call; setSession(call)
      const description = await connection.createOffer()
      await connection.setLocalDescription(description)
      sendRef.current('call_offer', call.id, connection.localDescription?.toJSON())
      pendingStart.current = false
    } catch (err) { if (generation.current === attempt) { await finish(true); setError(microphoneError(err)) } }
  }, [connected, release, openPeer, finish])

  const accept = useCallback(async () => {
    const call = active.current
    const description = offer.current
    if (!call || !description || peer.current || accepting.current) return
    accepting.current = true
    setState('connecting'); setError('')
    const attempt = generation.current
    let claimed = false
    try {
      const updated = await updateCall(call.id, 'connecting')
      if (generation.current !== attempt || active.current?.id !== call.id) return
      claimed = true
      active.current = updated; setSession(updated)
      const connection = await openPeer()
      if (active.current?.id !== call.id) return
      await connection.setRemoteDescription(description)
      for (const candidate of candidates.current.get(call.id) || []) await connection.addIceCandidate(candidate)
      candidates.current.delete(call.id)
      await connection.setLocalDescription(await connection.createAnswer())
      sendRef.current('call_answer', call.id, connection.localDescription?.toJSON())
    } catch (err) {
      if (generation.current !== attempt) return
      // Another tab may have accepted first. It owns the established call; do not end it.
      try {
        const latest = await getCall(call.id)
        if (!claimed && !peer.current && ['connecting', 'connected'].includes(latest.status)) {
          active.current = null; release(); setState('ended'); setError('Panggilan sudah diterima pada sesi lain.'); return
        }
      } catch { /* The normal failure path handles unavailable sessions. */ }
      await finish(true); setError(microphoneError(err))
    }
  }, [openPeer, finish, release])

  useEffect(() => subscribe(event => {
    events.current = events.current.then(async () => {
      if (event.kind === 'call_error') { if (active.current?.id === event.payload?.call_id) await finish(true); return }
      if (event.kind === 'call_state') {
        const call = event.payload as unknown as CallSession
        if (active.current?.id === call.id && call.caller_id !== userId && call.status === 'connecting' && !accepting.current && !peer.current) {
          active.current = null; release(); setState('ended'); setError('Panggilan sudah diterima pada sesi lain.'); return
        }
        if (active.current?.id === call.id && ['ended', 'failed', 'rejected'].includes(call.status)) {
          active.current = null; release(); setSession(call); setState(call.status === 'failed' ? 'failed' : 'ended')
          if (call.status === 'rejected') setError('Panggilan ditolak.')
        }
        return
      }
      if (!['call_offer', 'call_answer', 'ice_candidate'].includes(event.kind)) return
      const call = event.payload?.call as CallSession
      if (!call) return
      if (event.kind === 'call_offer') {
        if (call.caller_id === userId || Date.now() - new Date(call.created_at).getTime() > 60000) return
        if (active.current || pendingStart.current) { if (active.current?.id !== call.id) { try { await updateCall(call.id, 'rejected') } catch { /* A stale invitation may already be closed. */ } } return }
        const latest = await getCall(call.id)
        if (latest.status !== 'calling') return
        active.current = latest; offer.current = event.payload?.data as RTCSessionDescriptionInit
        setSession(latest); setConversation(await getConversation(call.conversation_id)); setState('incoming'); setError(''); setSeconds(0)
      } else if (event.kind === 'call_answer' && active.current?.id === call.id && peer.current) {
        setState('connecting'); await peer.current.setRemoteDescription(event.payload?.data as RTCSessionDescriptionInit)
        for (const candidate of candidates.current.get(call.id) || []) await peer.current.addIceCandidate(candidate)
        candidates.current.delete(call.id)
      } else if (event.kind === 'ice_candidate') {
        const candidate = event.payload?.data as RTCIceCandidateInit
        if (active.current?.id === call.id && peer.current?.remoteDescription) await peer.current.addIceCandidate(candidate)
        else {
          if (candidates.current.size > 5) candidates.current.clear()
          const list = candidates.current.get(call.id) || []
          if (list.length < 100) candidates.current.set(call.id, [...list, candidate])
        }
      }
    }).catch(() => finish(true))
  }), [subscribe, userId, finish, release])

  useEffect(() => {
    if (state === 'calling' || state === 'incoming' || state === 'connecting') {
      const timeout = setTimeout(() => { void finish(true) }, state === 'connecting' ? 45000 : 60000)
      return () => clearTimeout(timeout)
    }
  }, [state, finish])
  useEffect(() => {
    if (!connected && active.current) void finish(true)
  }, [connected, finish])
  useEffect(() => {
    const timer = setInterval(() => {
      if (state === 'connected') setSeconds(Math.floor((Date.now() - started.current) / 1000))
    }, 1000)
    const heartbeat = setInterval(() => {
      if (active.current && ['connecting', 'connected'].includes(state)) { try { sendRef.current('call_heartbeat', active.current.id) } catch { void finish(true) } }
    }, 20000)
    return () => { clearInterval(timer); clearInterval(heartbeat) }
  }, [state, finish])
  useEffect(() => () => { const call = active.current; active.current = null; release(); if (call) void updateCall(call.id, 'ended').catch(() => {}) }, [release])
  const toggleMute = () => { const next = !muted; local.current?.getAudioTracks().forEach(track => { track.enabled = !next }); setMuted(next) }
  const dismiss = () => { setState('idle'); setSession(null); setConversation(null); setError('') }
  return { state, session, conversation, error, muted, seconds, start, accept, finish, dismiss, toggleMute, remoteStream }
}
