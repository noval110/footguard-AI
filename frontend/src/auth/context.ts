import { createContext } from 'react'
import type { User } from '../api/types'

export interface AuthState { user: User | null; loading: boolean; sessionError: string; retrySession: () => Promise<void>; signIn: (email: string, password: string) => Promise<User>; signOut: () => void }
export const AuthContext = createContext<AuthState | null>(null)
