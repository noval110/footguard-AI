import { ArrowUpRight, CalendarDays, Check, ChevronRight, ClipboardList, Footprints, History, LayoutDashboard, ScanLine, ShieldCheck, Stethoscope, Users } from 'lucide-react'
import { RiskBadge } from './UI'

// Public, illustrative data only. These previews never request patient records.
const exampleHistory = [
  { date: '24 Sep 2026', side: 'Foto kaki', risk: 'moderate' as const },
  { date: '10 Sep 2026', side: 'Foto kaki', risk: 'low' as const },
  { date: '27 Agu 2026', side: 'Foto kaki', risk: 'low' as const },
]

export function PreviewBrand() {
  return <span className="lp-preview-brand"><Footprints size={17} aria-hidden="true" />FootGuard</span>
}

export function FootIllustration({ marked = true }: { marked?: boolean }) {
  return <div className="lp-foot-illustration">
    <svg viewBox="0 0 180 240" role="img" aria-label={marked ? 'Ilustrasi telapak kaki dengan contoh area yang ditandai, bukan hasil pemeriksaan' : 'Ilustrasi telapak kaki, bukan foto pemeriksaan'}>
      <g className="lp-foot-outline">
        <path d="M57 79C67 66 92 64 111 72C130 80 138 94 136 110C135 129 122 139 118 156C114 172 123 184 116 203C110 223 87 229 72 220C55 211 54 194 59 174C66 151 60 139 53 123C45 106 45 91 57 79Z" />
        <ellipse cx="58" cy="40" rx="16" ry="24" transform="rotate(-8 58 40)" />
        <ellipse cx="91" cy="43" rx="11" ry="18" transform="rotate(7 91 43)" />
        <ellipse cx="115" cy="51" rx="9" ry="15" transform="rotate(15 115 51)" />
        <ellipse cx="134" cy="65" rx="8" ry="12" transform="rotate(24 134 65)" />
        <ellipse cx="147" cy="84" rx="7" ry="10" transform="rotate(30 147 84)" />
      </g>
      <g className="lp-foot-detail"><path d="M63 92C79 82 105 86 122 99M72 192C81 182 98 182 107 189M51 45L64 44" /><path d="M77 132C86 150 80 165 76 173" /></g>
      {marked && <><path className="lp-foot-marker" d="M82 95C92 86 112 92 114 106C118 119 103 129 91 123C80 119 76 104 82 95Z" /><circle cx="98" cy="107" r="3" fill="#b45309" /><path d="M114 106H148" stroke="#b45309" strokeWidth="1.5" /><circle cx="150" cy="106" r="3" fill="#b45309" /></>}
    </svg>
    <span className="lp-illustration-caption">Ilustrasi visual</span>
  </div>
}

export function ResultPreview({ phone = false }: { phone?: boolean }) {
  return <div className={phone ? 'lp-phone' : 'lp-result-preview'}>
    {phone && <><span className="lp-phone-speaker" aria-hidden="true" /><div className="lp-phone-status" aria-hidden="true"><span>09.41</span><span>••• ▰</span></div><PreviewBrand /></>}
    <div className="lp-result-heading"><strong>Hasil Pemeriksaan</strong><span>24 September 2026 · Foto kaki</span></div>
    <FootIllustration />
    <div className="lp-result-notice"><ScanLine size={16} aria-hidden="true" /><span>Area yang perlu<br />diperhatikan</span></div>
    <div className="lp-result-risk"><span>Risiko kaki diabetik</span><RiskBadge value="moderate" /></div>
    <div className="lp-review-note"><Stethoscope size={14} aria-hidden="true" />Menunggu review tenaga kesehatan</div>
    {phone && <span className="lp-demo-label">Contoh tampilan · data ilustrasi</span>}
  </div>
}

export function HistoryPreview({ expanded = false }: { expanded?: boolean }) {
  return <div className="lp-history-preview">
    {expanded && <div className="lp-preview-heading"><div><strong>Riwayat Pemeriksaan</strong><p>Catatan kondisi kaki dari waktu ke waktu.</p></div><History size={20} aria-hidden="true" /></div>}
    {exampleHistory.map(item => <div className="lp-history-row" key={item.date}>
      <span className="lp-history-thumbnail"><Footprints size={22} strokeWidth={1.4} aria-hidden="true" /></span>
      <div><strong>{item.date}</strong><span>{item.side}</span></div>
      <RiskBadge value={item.risk} />
      <ChevronRight size={14} aria-hidden="true" />
    </div>)}
    <div className="lp-preview-footnote"><CalendarDays size={13} aria-hidden="true" />Tersimpan untuk pemantauan berkala</div>
  </div>
}

export function AreaPreview() {
  return <div className="lp-area-preview"><FootIllustration /><div className="lp-area-legend"><ScanLine size={16} aria-hidden="true" /><div><strong>Area yang ditandai</strong><span>Membantu peninjauan visual</span></div></div></div>
}

export function ProviderPreview({ expanded = false }: { expanded?: boolean }) {
  return <div className="lp-provider-preview">
    <div className="lp-preview-heading"><div><strong>Ringkasan Pasien</strong>{expanded && <p>Tinjau pemeriksaan dan catat tindak lanjut.</p>}</div><Users size={18} aria-hidden="true" /></div>
    <div className="lp-preview-stats"><div><span>Pasien</span><strong>12</strong></div><div><span>Belum ditinjau</span><strong>3</strong></div><div><span>Sudah ditinjau</span><strong>9</strong></div></div>
    <div className="lp-patient-row"><span className="lp-avatar">A</span><span><strong>Pasien contoh A</strong><small>Pemeriksaan terbaru</small></span><RiskBadge value="moderate" /></div>
    <div className="lp-patient-row"><span className="lp-avatar">B</span><span><strong>Pasien contoh B</strong><small>Sudah ditinjau</small></span><RiskBadge value="low" /></div>
    {expanded && <div className="lp-clinical-note"><Stethoscope size={19} aria-hidden="true" /><div><strong>Review Tenaga Kesehatan</strong><p>Hasil visual, informasi klinis, dan catatan review dalam satu pemeriksaan.</p></div></div>}
  </div>
}

export type PreviewView = 'patient' | 'result' | 'history' | 'provider'

export function ApplicationPreview({ view }: { view: PreviewView }) {
  const provider = view === 'provider'
  return <div className="lp-app-preview">
    <div className="lp-app-bar"><PreviewBrand /><span>Contoh tampilan aplikasi</span><span className="lp-avatar">{provider ? 'TK' : 'A'}</span></div>
    <div className="lp-app-body">
      <div className="lp-app-sidebar" aria-hidden="true">
        <span className={view === 'patient' || provider ? 'is-selected' : ''}><LayoutDashboard size={15} />Dashboard</span>
        <span className={view === 'result' ? 'is-selected' : ''}><ClipboardList size={15} />Pemeriksaan</span>
        <span className={view === 'history' ? 'is-selected' : ''}><History size={15} />Riwayat</span>
        {provider && <span><Users size={15} />Pasien</span>}
      </div>
      <div className="lp-app-content">
        {view === 'patient' && <>
          <div className="lp-preview-heading"><div><span className="lp-preview-overline">DASHBOARD PASIEN</span><strong>Selamat datang, Andi</strong><p>Setiap langkah kecil Anda berarti.</p></div><span className="lp-avatar"><ShieldCheck size={21} /></span></div>
          <div className="lp-patient-summary"><div><CalendarDays size={17} /><span>Pemeriksaan terakhir</span><strong>24 Sep 2026</strong></div><div><ShieldCheck size={17} /><span>Risiko terakhir</span><RiskBadge value="moderate" /></div><div><Check size={17} /><span>Total pemeriksaan</span><strong>3 pemeriksaan</strong></div></div>
          <div className="lp-dashboard-caption"><strong>Riwayat Pemeriksaan</strong><ArrowUpRight size={16} /></div><HistoryPreview />
        </>}
        {view === 'history' && <HistoryPreview expanded />}
        {provider && <ProviderPreview expanded />}
        {view === 'result' && <div className="lp-app-result"><ResultPreview /><div><span className="lp-preview-overline">HASIL PEMERIKSAAN</span><h3>Lebih jelas untuk ditindaklanjuti.</h3><p>Area visual, risiko kaki diabetik, dan review tenaga kesehatan ditampilkan secara terpisah.</p><div className="lp-clinical-note"><Stethoscope size={22} /><span>Hasil AI mendukung peninjauan tenaga kesehatan.</span></div></div></div>}
      </div>
    </div>
    <div className="lp-app-caption">Data ilustrasi, bukan data pasien atau hasil pemeriksaan nyata.</div>
  </div>
}
