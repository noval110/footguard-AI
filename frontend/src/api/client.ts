type Success<T> = { success: true; data: T }
type Failure = { success: false; message: string }
const TOKEN_KEY = 'footguard_token'
const baseUrl = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) { super(message); this.name = 'ApiError'; this.status = status }
}

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
}

type APIResponse = { response: Response; payload: unknown }

const userMessage = (status: number, backendMessage?: string) => {
  if (status === 400) return backendMessage || 'Data belum sesuai. Periksa kembali isian Anda.'
  if (status === 401) return 'Sesi Anda berakhir. Silakan masuk kembali.'
  if (status === 403) return 'Anda tidak memiliki akses ke halaman ini.'
  if (status === 404) return 'Data yang dicari tidak ditemukan.'
  if (status === 409) return backendMessage || 'Data sudah ada atau langkah sebelumnya belum selesai.'
  if (status === 429) return 'Terlalu banyak permintaan. Tunggu sebentar dan coba lagi.'
  if (status === 502) return 'Layanan analisis AI tidak dapat dihubungi atau gagal memproses foto. Coba lagi nanti.'
  if (status === 503) return 'Layanan belum siap. Coba lagi setelah beberapa saat.'
  if (status >= 500) return 'Layanan sedang mengalami gangguan. Coba lagi nanti.'
  return backendMessage || 'Permintaan tidak dapat diproses.'
}

async function fetchAPI(path: string, options: RequestInit = {}, authenticated = true): Promise<APIResponse> {
  const token = tokenStore.get()
  if (authenticated && !token) throw new ApiError(401, userMessage(401))
  const headers = new Headers(options.headers)
  headers.set('Accept', 'application/json')
  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  if (authenticated && token) headers.set('Authorization', `Bearer ${token}`)
  let response: Response
  try { response = await fetch(`${baseUrl}${path}`, { ...options, headers }) }
  catch { throw new ApiError(0, 'Tidak dapat terhubung ke server. Periksa koneksi dan coba lagi.') }
  let payload: unknown = null
  try { payload = await response.json() }
  catch { throw new ApiError(response.status, userMessage(response.status)) }
  if (response.status === 401 && authenticated) { tokenStore.clear(); window.dispatchEvent(new Event('footguard:unauthorized')) }
  return { response, payload }
}

function failureMessage(payload: unknown): string | undefined {
  if (!payload || typeof payload !== 'object') return undefined
  const value = payload as Record<string, unknown>
  return typeof value.message === 'string' ? value.message : typeof value.error === 'string' ? value.error : typeof value.detail === 'string' ? value.detail : undefined
}

export async function request<T>(path: string, options: RequestInit = {}, authenticated = true): Promise<T> {
  const { response, payload } = await fetchAPI(path, options, authenticated)
  const value = payload as Success<T> | Failure | null
  if (!response.ok || !value?.success) throw new ApiError(response.status, userMessage(response.status, failureMessage(payload)))
  return value.data
}

export async function requestUnwrapped<T>(path: string, options: RequestInit = {}): Promise<T> {
  const { response, payload } = await fetchAPI(path, options)
  if (!response.ok) {
    const message = failureMessage(payload)
    throw new ApiError(response.status, message && [400, 413, 503].includes(response.status) ? message : userMessage(response.status, message))
  }
  if (!payload || typeof payload !== 'object') throw new ApiError(response.status, 'Respons server tidak valid.')
  return payload as T
}

export const isNotFound = (error: unknown) => error instanceof ApiError && error.status === 404
export const errorText = (error: unknown) => error instanceof ApiError ? error.message : 'Terjadi kesalahan. Coba lagi.'

export async function loadProtectedImage(path: string, signal?: AbortSignal): Promise<Blob> {
  const token = tokenStore.get()
  if (!token) throw new ApiError(401, userMessage(401))
  const response = await fetch(`${baseUrl}${path}`, { headers: { Authorization: `Bearer ${token}` }, signal })
  if (response.status === 401) { tokenStore.clear(); window.dispatchEvent(new Event('footguard:unauthorized')) }
  if (!response.ok) throw new ApiError(response.status, userMessage(response.status))
  return response.blob()
}
