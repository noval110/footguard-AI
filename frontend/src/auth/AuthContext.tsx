import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { getProfile, login, loginWithGoogle } from '../api/auth'
import { ApiError, errorText, tokenStore } from '../api/client'
import type { User } from '../api/types'
import { AuthContext } from './context'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(!!tokenStore.get())
  const [sessionError, setSessionError] = useState('')
  const signOut = useCallback(() => { tokenStore.clear(); setUser(null); setSessionError(''); setLoading(false) }, [])
  async function retrySession() {
    if (!tokenStore.get()) return
    setLoading(true); setSessionError('')
    try { setUser(await getProfile()) }
    catch (error) { if (error instanceof ApiError && error.status === 401) signOut(); else setSessionError(errorText(error)) }
    finally { setLoading(false) }
  }
  useEffect(() => {
    const onUnauthorized = () => signOut()
    window.addEventListener('footguard:unauthorized', onUnauthorized)
    let active = true
    if (tokenStore.get()) getProfile().then(profile => { if (active) setUser(profile) }).catch(error => { if (active) { if (error instanceof ApiError && error.status === 401) signOut(); else setSessionError(errorText(error)) } }).finally(() => { if (active) setLoading(false) })
    return () => { active = false; window.removeEventListener('footguard:unauthorized', onUnauthorized) }
  }, [signOut])
  async function completeAuth(result: { token: string }) {
    tokenStore.set(result.token)
    try { const profile = await getProfile(); setUser(profile); setSessionError(''); return profile }
    catch (error) { signOut(); throw error }
  }
  const signIn = async (email: string, password: string) => completeAuth(await login(email, password))
  const signInWithGoogle = async (credential: string) => completeAuth(await loginWithGoogle(credential))
  return <AuthContext.Provider value={{ user, loading, sessionError, retrySession, signIn, signInWithGoogle, signOut }}>{children}</AuthContext.Provider>
}
