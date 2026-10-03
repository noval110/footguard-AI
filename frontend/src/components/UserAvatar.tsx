import type { User } from '../api/types'
import { useImageResource } from '../hooks/useImageSource'

export function UserAvatar({ user, className = 'fresh-avatar', preview }: { user: User | null; className?: string; preview?: string }) {
  const { url } = useImageResource(user?.avatar_url)
  const source = preview || url
  const initials = (user?.name || 'Pasien').split(' ').filter(Boolean).slice(0, 2).map(word => word[0].toUpperCase()).join('')
  return <span className={`${className} user-avatar`} role="img" aria-label={`Foto profil ${user?.name || 'pasien'}`}>
    {initials}
    {source && <img key={source} src={source} alt="" onError={event => { event.currentTarget.style.display = 'none' }} />}
  </span>
}
