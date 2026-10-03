import { ArrowRight, BookOpen, FileText, Mail, Phone, UserRound, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { ProfilePhotoEditor } from './ProfilePhotoEditor'

export function ProfileIdentity({ patientId, phone }: { patientId?: number; phone?: string | null }) {
  const { user } = useAuth()
  const provider = user?.role === 'provider'
  return <aside className="card profile-identity">
    <div className="profile-identity-cover"><span><UserRound size={14} />AKUN SAYA</span></div>
    <ProfilePhotoEditor />
    <div className="profile-identity-name"><h2>{user?.name}</h2>
      <p>{provider ? 'Tenaga kesehatan' : 'Pasien DIA SCAN'} <span>· ID {patientId ?? user?.id}</span></p>
    </div>
    <div className="profile-account">
      <h3>Kontak akun</h3>
      <div className="profile-contact"><Mail size={17} /><div><span>Email</span><strong>{user?.email}</strong></div></div>
      {!provider && <div className="profile-contact"><Phone size={17} /><div><span>Telepon</span><strong>{phone || 'Belum diisi'}</strong></div></div>}
    </div>
    <div className="profile-links">
      <Link to={provider ? '/provider/patients' : '/patient/history'}>{provider ? <Users size={18} /> : <FileText size={18} />}{provider ? 'Daftar pasien' : 'Riwayat pemeriksaan'}<ArrowRight size={16} /></Link>
      <Link to={provider ? '/education' : '/patient/education'}><BookOpen size={18} />Ruang edukasi<ArrowRight size={16} /></Link>
    </div>
  </aside>
}
