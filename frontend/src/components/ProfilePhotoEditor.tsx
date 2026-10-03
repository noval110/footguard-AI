import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { Camera, Check, ImagePlus, Trash2, X } from 'lucide-react'
import { deleteProfilePhoto, uploadProfilePhoto } from '../api/auth'
import { errorText } from '../api/client'
import { useAuth } from '../auth/useAuth'
import { UserAvatar } from './UserAvatar'

export function ProfilePhotoEditor() {
  const { user, updateUser } = useAuth()
  const input = useRef<HTMLInputElement>(null)
  const active = useRef(true)
  const [candidate, setCandidate] = useState<{ blob: Blob; url: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => () => { if (candidate) URL.revokeObjectURL(candidate.url) }, [candidate])
  useEffect(() => { active.current = true; return () => { active.current = false } }, [])

  async function choose(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || busy) return
    setError(''); setMessage('')
    if (!['image/jpeg', 'image/png'].includes(file.type)) { setError('Gunakan foto JPG atau PNG.'); return }
    if (file.size > 5 * 1024 * 1024) { setError('Ukuran foto maksimal 5 MB.'); return }
    setBusy(true)
    let bitmap: ImageBitmap | undefined
    try {
      // Browser decoding applies phone-camera orientation before saving pixels.
      bitmap = await createImageBitmap(file)
      const scale = Math.min(1, 1024 / Math.max(bitmap.width, bitmap.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(bitmap.width * scale))
      canvas.height = Math.max(1, Math.round(bitmap.height * scale))
      const context = canvas.getContext('2d')
      if (!context) throw new Error('Canvas unavailable')
      context.fillStyle = '#fff'
      context.fillRect(0, 0, canvas.width, canvas.height)
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('Invalid image')), 'image/jpeg', .9))
      if (active.current) setCandidate({ blob, url: URL.createObjectURL(blob) })
    } catch { setError('Foto tidak dapat dibaca. Coba pilih foto JPG atau PNG lainnya.') }
    finally { bitmap?.close(); setBusy(false) }
  }

  async function save() {
    if (!candidate || busy) return
    setBusy(true); setError(''); setMessage('')
    try {
      updateUser(await uploadProfilePhoto(candidate.blob))
      setCandidate(null)
      setMessage('Foto profil berhasil disimpan.')
    } catch (err) { setError(errorText(err)) }
    finally { setBusy(false) }
  }

  async function remove() {
    if (busy) return
    setBusy(true); setError(''); setMessage('')
    try {
      updateUser(await deleteProfilePhoto())
      setCandidate(null)
      setMessage('Foto profil dihapus.')
    } catch (err) { setError(errorText(err)) }
    finally { setBusy(false) }
  }

  return <div className="profile-photo-editor" aria-busy={busy}>
    <div className="profile-photo-wrap">
      <UserAvatar user={user} className="profile-photo-avatar" preview={candidate?.url} />
      <button className="profile-camera-button" type="button" onClick={() => input.current?.click()} disabled={busy} aria-label="Pilih foto profil"><Camera size={17} /></button>
    </div>
    <input ref={input} className="profile-file-input" type="file" accept="image/jpeg,image/png" onChange={choose} aria-label="Unggah foto profil" disabled={busy} />
    <div className="profile-photo-actions">
      {candidate ? <>
        <button className="button" type="button" onClick={save} disabled={busy}><Check size={15} />{busy ? 'Memproses...' : 'Simpan foto'}</button>
        <button className="profile-text-button" type="button" disabled={busy} onClick={() => { setCandidate(null); setError(''); setMessage('') }}><X size={14} />Batal</button>
      </> : <>
        <button className="button button-secondary" type="button" disabled={busy} onClick={() => input.current?.click()}><ImagePlus size={15} />{busy ? 'Memproses...' : user?.avatar_url ? 'Ganti foto' : 'Unggah foto'}</button>
        {user?.avatar_url && <button className="profile-text-button" type="button" onClick={remove} disabled={busy}><Trash2 size={14} />Hapus foto</button>}
      </>}
    </div>
    <p className="profile-photo-hint">{candidate ? 'Pratinjau foto baru. Simpan untuk memasangnya.' : 'JPG atau PNG, maksimal 5 MB.'}</p>
    {error && <p className="form-error" role="alert">{error}</p>}
    {message && <p className="success-message" role="status">{message}</p>}
  </div>
}
