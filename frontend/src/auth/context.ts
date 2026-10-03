import { createContext } from 'react'
import type { User } from '../api/types'

export interface AuthState { user: User | null; loading: boolean; sessionError: string; retrySession: () => Promise<void>; signIn: (email: string, password: string) => Promise<User>; signInWithGoogle: (credential: string) => Promise<User>; signOut: () => void; updateUser: (user: User) => void }
export const AuthContext = createContext<AuthState | null>(null)
