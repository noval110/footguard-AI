export interface EducationArticle { id: string; title: string; category: 'foot_care' | 'other'; summary: string; readMinutes: number }
export const education: EducationArticle[] = [
  { id: 'ed1', title: 'Mengenali Risiko Ulkus Kaki Diabetik', category: 'foot_care', summary: 'Kenali tanda perubahan pada kulit, sensasi, dan bentuk kaki sejak dini.', readMinutes: 6 },
  { id: 'ed2', title: 'Tips Memilih Alas Kaki yang Aman', category: 'foot_care', summary: 'Panduan sederhana memilih alas kaki yang nyaman dan melindungi.', readMinutes: 4 },
  { id: 'ed3', title: 'Pola Perawatan Kaki Harian', category: 'foot_care', summary: 'Rutinitas kecil yang membantu menjaga kebersihan dan kesehatan kaki.', readMinutes: 5 },
  { id: 'ed4', title: 'Kapan Harus Menghubungi Tenaga Kesehatan', category: 'other', summary: 'Perubahan yang sebaiknya segera dibicarakan dengan tenaga kesehatan.', readMinutes: 3 },
  { id: 'ed5', title: 'Pentingnya Pemeriksaan Berkala', category: 'foot_care', summary: 'Mengapa catatan pemeriksaan dari waktu ke waktu bermanfaat.', readMinutes: 4 },
  { id: 'ed6', title: 'Panduan Foto Kaki yang Jelas', category: 'other', summary: 'Gunakan cahaya cukup, fokus yang jelas, dan tampilkan seluruh kaki pada foto.', readMinutes: 3 },
]
