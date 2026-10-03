import { ShieldCheck, UserRound } from 'lucide-react'
import { useAuth } from '../auth/useAuth'
import { ProfileIdentity } from '../components/ProfileIdentity'
import { PageHeader } from '../components/UI'
import { dateLabel } from '../utils/format'

export function ProviderProfilePage() {
  const { user } = useAuth()
  return <div className="profile-page">
    <PageHeader eyebrow="AKUN TENAGA KESEHATAN" title="Profil Saya" description="Kelola foto profil dan lihat informasi akun klinis Anda." />
    <div className="profile-redesign-grid">
      <ProfileIdentity />
      <section className="card profile-form provider-account-details">
        <span className="eyebrow">IDENTITAS AKUN KLINIS</span>
        <h2>Informasi Anda</h2>
        <p className="muted">Informasi akun tenaga kesehatan yang terdaftar di DIA SCAN.</p>
        <div className="profile-section-heading"><UserRound size={18} /><h3>Informasi akun</h3></div>
        <dl className="profile-account-details">
          <div><dt>Nama lengkap</dt><dd>{user?.name}</dd></div>
          <div><dt>Alamat email</dt><dd>{user?.email}</dd></div>
          <div><dt>Peran</dt><dd>Tenaga kesehatan</dd></div>
          <div><dt>Status akun</dt><dd>{user?.is_active ? 'Aktif' : 'Tidak aktif'}</dd></div>
          <div><dt>Terdaftar sejak</dt><dd>{user?.created_at ? dateLabel(user.created_at) : '—'}</dd></div>
        </dl>
        <div className="profile-form-footer"><p><ShieldCheck size={16} />Untuk perubahan identitas akun klinis, hubungi administrator institusi Anda.</p></div>
      </section>
    </div>
  </div>
}
