import { useCallback, useEffect, useRef, useState } from 'react'
import { errorText } from '../api/client'

export function useResource<T>(load: () => Promise<T>, key: string | number = 'default') {
  const loader = useRef(load)
  useEffect(() => { loader.current = load })
  const [value, setValue] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [version, setVersion] = useState(0)
  useEffect(() => {
    let active = true
    loader.current().then(data => { if (active) { setValue(data); setError('') } }).catch(err => { if (active) setError(errorText(err)) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [key, version])
  const reload = useCallback(() => { setLoading(true); setVersion(v => v + 1) }, [])
  return { value, loading, error, reload }
}
