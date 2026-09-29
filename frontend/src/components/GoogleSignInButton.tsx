import { useEffect, useRef, useState } from 'react'

interface GoogleCredentialResponse { credential: string }
interface GoogleIdentityAPI {
  initialize: (options: { client_id: string; callback: (response: GoogleCredentialResponse) => void }) => void
  renderButton: (element: HTMLElement, options: { theme: string; size: string; width: number }) => void
}

declare global {
  interface Window {
    google?: { accounts: { id: GoogleIdentityAPI } }
  }
}

let scriptPromise: Promise<void> | null = null

function loadGoogleScript(): Promise<void> {
  if (window.google?.accounts.id) return Promise.resolve()
  if (scriptPromise) return scriptPromise
  scriptPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Google Identity Services unavailable'))
    document.head.appendChild(script)
  }).catch(error => {
    scriptPromise = null
    throw error
  })
  return scriptPromise
}

export function GoogleSignInButton({ onCredential, disabled }: { onCredential: (credential: string) => void; disabled: boolean }) {
  const clientID = import.meta.env.VITE_GOOGLE_CLIENT_ID
  const button = useRef<HTMLDivElement>(null)
  const callback = useRef(onCredential)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => { callback.current = onCredential }, [onCredential])
  useEffect(() => {
    if (!clientID) return
    let active = true
    loadGoogleScript().then(() => {
      if (!active || !button.current || !window.google?.accounts.id) return
      window.google.accounts.id.initialize({ client_id: clientID, callback: response => {
        if (response.credential) callback.current(response.credential)
      } })
      window.google.accounts.id.renderButton(button.current, {
        theme: 'outline', size: 'large', width: Math.min(340, button.current.clientWidth),
      })
    }).catch(() => { if (active) setLoadError(true) })
    return () => { active = false }
  }, [clientID])

  if (!clientID) return null
  return <div className={`google-signin-button${disabled ? ' is-disabled' : ''}`} aria-busy={disabled}>
    <div ref={button} />
    {loadError && <p className="form-error" role="alert">Tombol Google tidak dapat dimuat. Coba lagi nanti atau gunakan email dan kata sandi.</p>}
  </div>
}
