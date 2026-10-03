import { useEffect, useState } from 'react'
import { loadProtectedImage } from '../api/client'

const isProtectedImage = (src?: string | null) => !!src && (src.startsWith('/api/uploads/') || src.startsWith('/api/profile/photo?'))

export function useImageResource(src?: string | null) {
  const [loaded, setLoaded] = useState<{ source: string; url?: string; failed?: boolean } | null>(null)
  useEffect(() => {
    if (!src || !isProtectedImage(src)) return
    const controller = new AbortController()
    let objectURL: string | undefined
    loadProtectedImage(src, controller.signal).then(blob => {
      if (controller.signal.aborted) return
      objectURL = URL.createObjectURL(blob)
      setLoaded({ source: src, url: objectURL })
    }).catch(() => {
      if (!controller.signal.aborted) setLoaded({ source: src, failed: true })
    })
    return () => { controller.abort(); if (objectURL) URL.revokeObjectURL(objectURL) }
  }, [src])
  if (!src) return { url: undefined, status: 'empty' as const }
  if (!isProtectedImage(src)) return { url: src, status: 'ready' as const }
  if (loaded?.source !== src) return { url: undefined, status: 'loading' as const }
  return { url: loaded.url, status: loaded.failed ? 'error' as const : 'ready' as const }
}

export function useImageSource(src?: string | null) {
  return useImageResource(src).url
}
