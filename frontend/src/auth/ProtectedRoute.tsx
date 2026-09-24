import type { ReactNode } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { LoadingState } from '../components/Feedback'
import { ErrorState } from '../components/Feedback'
import { useAuth } from './useAuth'

export function ProtectedRoute({ role, children }: { role: 'patient' | 'provider'; children: ReactNode }) {
  const { user, loading, sessionError, retrySession, signOut } = useAuth()
  const location = useLocation()
  if (loading) return <div className="auth-loading"><LoadingState label="Memeriksa sesi Anda..." /></div>
  if (sessionError) return <div className="auth-loading"><ErrorState message={sessionError} retry={() => void retrySession()} /></div>
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  if (user.role !== role) {
    if (user.role === 'patient' || user.role === 'provider') return <Navigate to={`/${user.role}/dashboard`} replace />
    return <div className="auth-loading"><p>Belum ada ruang kerja untuk peran admin.</p><Link to="/login" onClick={signOut}>Keluar</Link></div>
  }
  return <>{children}</>
}
