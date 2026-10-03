import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../auth/useAuth'
import { useCare } from '../care/useCare'

const labels = { idle: '', calling: 'Memanggil...', incoming: 'Panggilan konsultasi masuk', connecting: 'Menghubungkan...', connected: 'Panggilan tersambung', ended: 'Panggilan berakhir', failed: 'Panggilan gagal' }
export function CallPanel() {
  const { voice } = useCare()
  const { user } = useAuth()
  const panel = useRef<HTMLDivElement>(null)
  const audio = useRef<HTMLAudioElement>(null)
  const [audioError, setAudioError] = useState('')
  useEffect(() => {
    const element = audio.current
    if (element) { element.srcObject = voice.remoteStream; if (voice.remoteStream) void element.play().catch(() => setAudioError('Tekan Putar audio untuk mendengarkan panggilan.')) }
  }, [voice.remoteStream])
  const visible = voice.state !== 'idle'
  useEffect(() => {
    if (!visible) return
    const previous = document.activeElement as HTMLElement
    const focusPanel = () => panel.current?.querySelector<HTMLButtonElement>('button')?.focus()
    focusPanel()
    const frame = requestAnimationFrame(focusPanel)
    function trap(event: KeyboardEvent) {
      if (event.key !== 'Tab') return
      const buttons = Array.from(panel.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') || [])
      const first = buttons[0]; const last = buttons.at(-1)
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }
    document.addEventListener('keydown', trap)
    const content = document.querySelector<HTMLElement>('.footguard-shell')
    if (content) content.inert = true
    return () => { cancelAnimationFrame(frame); document.removeEventListener('keydown', trap); if (content) content.inert = false; previous?.focus() }
  }, [visible])
  if (!visible) return null
  const name = user?.role === 'patient' ? voice.conversation?.provider_name : voice.conversation?.patient_name
  const minutes = Math.floor(voice.seconds / 60)
  return <div className="call-backdrop"><div className="card call-panel" ref={panel} role="dialog" aria-modal="true" aria-labelledby="call-title">
    <p className="eyebrow">KONSULTASI SUARA</p><h2 id="call-title">{labels[voice.state]}</h2><p>{name || 'Peserta konsultasi'}</p>
    <audio ref={audio} autoPlay />
    {voice.state === 'connected' && <p className="call-duration" aria-label="Durasi panggilan">{String(minutes).padStart(2, '0')}:{String(voice.seconds % 60).padStart(2, '0')}</p>}
    {audioError && <p role="alert">{audioError}</p>}{voice.error && <p className="form-error" role="alert">{voice.error}</p>}
    <div className="consultation-actions">
      {voice.state === 'incoming' && <><button className="button" onClick={() => void voice.accept()}>Terima</button><button className="button button-secondary" onClick={() => void voice.finish(false, true)}>Tolak</button></>}
      {voice.state === 'connected' && <><button className="button button-secondary" aria-pressed={voice.muted} onClick={voice.toggleMute}>{voice.muted ? 'Aktifkan mikrofon' : 'Mute mikrofon'}</button><button className="button button-secondary" onClick={() => { void audio.current?.play().then(() => setAudioError('')).catch(() => setAudioError('Audio belum dapat diputar.')) }}>Putar audio</button></>}
      {['calling', 'connecting', 'connected'].includes(voice.state) && <button className="button" onClick={() => void voice.finish()}>Akhiri panggilan</button>}
      {['ended', 'failed'].includes(voice.state) && <button className="button" onClick={voice.dismiss}>Tutup</button>}
    </div><p className="muted small">Fitur konsultasi DIA SCAN digunakan untuk tindak lanjut pemeriksaan. Untuk kondisi darurat, segera hubungi layanan kesehatan terdekat.</p>
  </div></div>
}
