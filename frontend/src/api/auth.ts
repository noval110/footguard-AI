import { request } from './client'
import type { User } from './types'

interface AuthResponse { user: User; token: string }
export const login = (email: string, password: string) => request<AuthResponse>('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }, false)
export const loginWithGoogle = (credential: string) => request<AuthResponse>('/api/auth/google', { method: 'POST', body: JSON.stringify({ credential }) }, false)
export const register = (name: string, email: string, password: string) => request<AuthResponse>('/api/auth/register', { method: 'POST', body: JSON.stringify({ name, email, password }) }, false)
export const getProfile = () => request<User>('/api/profile')
export const uploadProfilePhoto = (photo: Blob) => {
  const body = new FormData()
  body.append('photo', photo, 'profile.jpg')
  return request<User>('/api/profile/photo', { method: 'PUT', body })
}
export const deleteProfilePhoto = () => request<User>('/api/profile/photo', { method: 'DELETE' })
