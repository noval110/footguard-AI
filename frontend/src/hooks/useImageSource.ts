import { useEffect, useState } from 'react'
import { loadProtectedImage } from '../api/client'

export function useImageSource(src?: string | null) {
  const [loaded, setLoaded] = useState<{ source: string; url: string } | null>(null)
  useEffect(() => {
    if (!src?.startsWith('/api/uploads/')) return
    const controller = new AbortController()
    let objectURL: string | undefined
    loadProtectedImage(src, controller.signal).then(blob => {
      if (controller.signal.aborted) return
      objectURL = URL.createObjectURL(blob)
      setLoaded({ source: src, url: objectURL })
    }).catch(() => {})
    return () => { controller.abort(); if (objectURL) URL.revokeObjectURL(objectURL) }
  }, [src])
  if (!src) return undefined
  if (!src.startsWith('/api/uploads/')) return src
  return loaded?.source === src ? loaded.url : undefined
}
