# Audit dan penyelesaian profil FootGuard / DIA SCAN

Pekerjaan dilanjutkan dari working tree saat ini. Perubahan lama pada konsultasi, monitoring, AI, autentikasi, dan branding dipertahankan. Tidak ada push, deployment, atau perubahan database produksi.

## Koreksi runtime lokal setelah laporan awal

Keluhan `PUT http://localhost:8080/api/profile/photo` menghasilkan `403` ditelusuri ke proses `backend/tmp/footguard-local.exe` yang mulai berjalan sebelum fitur foto dibuat. Binary tersebut belum memuat route `/profile/photo`; backend uji di port `8098` sudah memuatnya. Endpoint yang belum tersedia pada executable lama dapat jatuh ke grup route dengan penjagaan peran dan menghasilkan `403`.

Backend lokal di port `8080` sudah dibangun ulang sebagai `backend/tmp/footguard-profile.exe` dan dimulai ulang dari direktori backend dengan konfigurasi `.env` yang sama. Health endpoint kembali `200`; permintaan terautentikasi dari browser pengguna juga kembali `200`, sehingga sesi yang ada tetap diterima. Tes handler/route dan `go vet` lulus setelah koreksi runtime. Tidak ada perubahan data akun, aturan peran, JWT secret, migrasi, atau deployment produksi. Pengguna dapat mengulangi tombol Simpan foto pada halaman yang sudah dibuka.

## Kondisi sebelum dilanjutkan

Sudah tersedia: desain profil pasien, pratinjau foto, API unggah/hapus, penyimpanan foto di direktori upload, fallback inisial, sinkronisasi melalui AuthContext, avatar sidebar/header, dan tes handler foto.

Belum selesai: halaman profil tenaga kesehatan belum tersedia; avatar header tenaga kesehatan masih mengarah ke daftar pasien; avatar dashboard tenaga kesehatan masih berupa inisial; verifikasi browser dan laporan belum selesai. Cache Go bawaan juga tidak dapat ditulis dalam sandbox.

## Penyelesaian

- Menambahkan `/provider/profile` dan menu Profil Saya untuk tenaga kesehatan, memakai komponen identitas dan editor foto yang sama dengan pasien.
- Mengarahkan avatar header kedua peran ke profil masing-masing dan memakai foto tersimpan pada dashboard tenaga kesehatan.
- Mempertahankan formulir data pasien. Data kesehatan yang belum tersimpan ditampilkan sebagai pilihan kosong, bukan nilai asumsi.
- Merapikan tata letak maroon, formulir, kontak akun, status kelengkapan, dan layout ponsel.
- Melengkapi cleanup object URL pratinjau, fallback avatar, status proses, dan pesan kesalahan.
- Memverifikasi batas unggahan, gambar rusak, penggantian foto tanpa meninggalkan file lama, penghapusan idempotent, CORS DELETE, dan pembatasan akses berdasarkan identitas JWT.
- Menghapus import yang tidak digunakan dan mempertahankan helper inisial yang masih dipakai tabel pasien.
- Menjalankan tes menggunakan cache Go di workspace dan database PostgreSQL lokal terisolasi yang sudah ada.

Identitas akun tenaga kesehatan ditampilkan sebagai informasi akun; pengaturan nama/email klinis tetap dikelola administrator. Tidak ada perubahan izin peran atau alur login.

## File dalam lingkup fitur ini

Backend:

- `backend/handlers/auth.go`
- `backend/handlers/profile_photo.go` (baru)
- `backend/handlers/profile_photo_test.go` (baru)
- `backend/models/models.go`
- `backend/routes/routes.go`
- `backend/routes/routes_test.go`
- `backend/README.md`

Frontend:

- `frontend/README.md`
- `frontend/src/App.tsx`
- `frontend/src/api/auth.ts`
- `frontend/src/api/types.ts`
- `frontend/src/auth/AuthContext.tsx`
- `frontend/src/auth/context.ts`
- `frontend/src/hooks/useImageSource.ts`
- `frontend/src/layouts/AppLayout.tsx`
- `frontend/src/pages/PatientPages.tsx`
- `frontend/src/pages/ProviderPages.tsx`
- `frontend/src/pages/ProviderProfilePage.tsx` (baru)
- `frontend/src/components/ProfileIdentity.tsx` (baru)
- `frontend/src/components/ProfilePhotoEditor.tsx` (baru)
- `frontend/src/components/UserAvatar.tsx` (baru)
- `frontend/src/styles/profile.css` (baru)

Verifikasi dan dokumentasi:

- `scripts/profile-browser-check.cjs` (baru)
- `docs/profile-photos.md` (laporan ini)
- `artifacts/profile-browser/verification.json`
- `artifacts/profile-browser/patient-profile-390.png`
- `artifacts/profile-browser/patient-profile-1440.png`
- `artifacts/profile-browser/provider-profile-390.png`
- `artifacts/profile-browser/provider-profile-1440.png`

Daftar tersebut mencakup pekerjaan profil sebelum dan setelah dilanjutkan. Working tree juga berisi perubahan lain yang sudah ada; daftar ini tidak mengklaim perubahan tersebut sebagai bagian fitur profil.

## API, penyimpanan, dan otorisasi

| Endpoint | Perilaku |
| --- | --- |
| `GET /api/profile` | User saat ini, termasuk `avatar_url` bila foto tersedia |
| `PUT /api/profile/photo` | Multipart field `photo`; mengembalikan user yang diperbarui |
| `GET /api/profile/photo` | Gambar milik user yang terautentikasi |
| `DELETE /api/profile/photo` | Menghapus foto sendiri; mengembalikan user yang diperbarui |
| `GET /api/patients/me` / `PUT /api/patients/me` | Alur data profil pasien yang sudah ada |

Semua endpoint foto membutuhkan JWT. ID pemilik berasal dari sesi yang diverifikasi middleware, bukan filename, query `user`, atau ID yang dikirim frontend. Pasien dan tenaga kesehatan dapat mengelola foto sendiri. Mengirim URL foto pasien dengan token tenaga kesehatan tidak memberikan akses ke file pasien.

Jenis yang didukung: JPEG dan PNG. WebP, SVG, gambar rusak, dan tipe lainnya ditolak. Batas input 5 MiB (ditulis 5 MB di UI); batas backend 4096 × 4096 piksel. Frontend menyiapkan orientasi kamera dan mengecilkan sisi terpanjang menjadi maksimal 1024 piksel sebelum upload. Backend memvalidasi isi gambar, menghapus metadata dengan encoding ulang, dan menghasilkan JPEG.

File disimpan sebagai `UPLOAD_DIR/avatars/<ID user>.jpg`. Nama unggahan tidak menjadi path penyimpanan. File sementara ditulis lengkap, lalu menggantikan foto sebelumnya; cleanup sementara dijalankan bila terjadi kegagalan. Penghapusan hanya menyasar path foto user tersebut. Respons gambar menggunakan `Cache-Control: private, no-store` dan `X-Content-Type-Options: nosniff`. Frontend mengambil gambar dengan JWT seperti gambar upload terlindungi lainnya.

**Tidak ada migrasi baru untuk foto profil, repository database baru, dependency baru, atau environment variable baru.** Migrasi `004` yang sudah berubah dan file `005_monitoring_consultations.sql` yang sudah ada merupakan pekerjaan sebelumnya; tidak diubah atau diterapkan untuk fitur ini. Foto memakai volume upload persisten yang sudah dikonfigurasi. Direktori `avatars` harus ikut backup upload dan tersedia bagi instance backend yang melayani akun tersebut.

## Hasil verifikasi

| Pemeriksaan | Hasil |
| --- | --- |
| `go test ./...` | Lulus; memakai database lokal `footguard_consultation_test` di `127.0.0.1:55439` |
| `go vet ./...` | Lulus |
| `npm.cmd run build` | Lulus |
| `npm.cmd run lint` | Lulus, tanpa warning |
| `git diff --check` | Lulus; Git hanya memberi pemberitahuan konversi LF/CRLF |
| Browser Edge melalui Playwright | 18 pemeriksaan lulus, tanpa JavaScript page error |

Suite backend mencakup tes foto baru serta tes yang sudah ada untuk login password/Google, validasi AI, konsultasi, jadwal, dan signaling/realtime. Tes Google memakai mekanisme pengujian yang sudah tersedia; ini bukan login OAuth Google langsung dari browser.

Uji browser dijalankan sungguhan terhadap frontend Vite, Go API, dan PostgreSQL lokal. Cakupannya: user tanpa foto; JPEG/PNG; invalid/WebP/oversized; pratinjau dan batal; simpan; loading dengan tombol nonaktif; kegagalan upload dan retry; foto profil/sidebar/header langsung diperbarui; mengganti foto; editing data pasien; refresh; logout/login; avatar dashboard tenaga kesehatan; hapus dan fallback; token tidak valid/tanpa JWT; dan isolasi foto antar akun. Layout diperiksa pada 360, 390, 768, 1024, dan 1440 piksel tanpa horizontal overflow.

Kegagalan upload 503 sengaja disimulasikan sekali untuk setiap peran guna menguji pesan error dan retry; operasi upload lainnya menggunakan backend asli. Akun fixture dan foto uji dibersihkan. Detail pemeriksaan tersedia di [verification.json](../artifacts/profile-browser/verification.json).

Pengujian ini **otomatis melalui browser headless**, bukan pengujian manual manusia. Screenshot desktop dan ponsel juga diperiksa secara visual.

## Verifikasi manual yang masih relevan

- Login Google asli dengan konfigurasi OAuth lokal yang sesuai.
- Foto kamera ponsel nyata, termasuk orientasi EXIF, pada browser/perangkat yang akan dipakai pengguna.
- Safari/iOS dan pemilihan foto dari galeri perangkat nyata.
- Alur AI dengan model hidup dan panggilan audio dua perangkat tidak dijalankan ulang dalam pekerjaan profil; suite backend yang terkait tetap lulus.

## Langkah pengujian lokal

Saat laporan dibuat, frontend uji di `http://127.0.0.1:5187` dan backend/database uji sudah berjalan. Gunakan langsung untuk pemeriksaan manual. Perintah startup berikut digunakan bila layanan sudah berhenti; jangan menjalankannya lagi pada port yang masih aktif.

Gunakan PostgreSQL uji yang sudah ada berikut, bukan koneksi Neon. Bila database lokal berhenti, jalankan dari PowerShell:

```powershell
& 'C:\Program Files\PostgreSQL\18\bin\pg_ctl.exe' -D 'C:\footguard\artifacts\consultation-test-db' -l 'C:\footguard\artifacts\consultation-test-db\profile-test.log' -o '-p 55439 -h 127.0.0.1' -w start
```

Terminal backend:

```powershell
cd C:\footguard\backend
$env:GOCACHE = 'C:\footguard\frontend\node_modules\.cache\go-build'
$env:DATABASE_URL = 'postgres://footguard_test@127.0.0.1:55439/footguard_consultation_test?sslmode=disable'
$env:FOOTGUARD_TEST_DATABASE_URL = $env:DATABASE_URL
$env:JWT_SECRET = 'profile-local-test-secret-at-least-32-characters'
$env:PORT = '8098'
$env:FRONTEND_ORIGIN = 'http://127.0.0.1:5187'
$env:AI_SERVICE_URL = 'http://127.0.0.1:8000'
$env:UPLOAD_DIR = 'C:\footguard\frontend\node_modules\.cache\profile-uploads'
go test ./...
go vet ./...
go run ./cmd
```

Terminal frontend:

```powershell
cd C:\footguard\frontend
$env:VITE_API_URL = 'http://127.0.0.1:8098'
npm.cmd run build
npm.cmd run lint
npm.cmd run dev -- --host 127.0.0.1 --port 5187 --strictPort
```

1. Buka `http://127.0.0.1:5187/register` untuk membuat akun pasien lokal, lalu login.
2. Buka Profil Saya. Pilih JPG/PNG lewat Unggah foto, periksa pratinjau, lalu Simpan foto. Periksa avatar sidebar/header tanpa refresh.
3. Ganti foto, coba Batal, lalu simpan foto pengganti. Coba file invalid dan lebih dari 5 MiB.
4. Isi dan simpan data pasien. Refresh dan logout/login; foto dan data harus tetap tersedia.
5. Hapus foto; semua avatar kembali ke inisial. Ulangi pada lebar layar ponsel.
6. Untuk akun tenaga kesehatan, gunakan akun provider lokal yang sudah tersedia atau provision satu akun pada database uji dengan CLI backend. Buka `/provider/profile` dan ulangi pengujian foto.

Contoh provision provider, dari terminal backend tambahan dengan `DATABASE_URL` dan `GOCACHE` yang sama:

```powershell
$env:PROVIDER_PASSWORD = 'LocalProviderManual123!'
go run ./cmd/create-provider --name 'Dr. Maya Lokal' --email 'maya.local@example.com'
```

Untuk mengulang 18 pemeriksaan otomatis dengan layanan di port tersebut:

```powershell
cd C:\footguard
node scripts/profile-browser-check.cjs
```

Script memakai Playwright yang tersedia di instalasi lokal; `PLAYWRIGHT_MODULE` dapat diatur ke path modul Playwright lain. Script hanya menyasar layanan/database uji lokal di atas dan membersihkan akun yang dibuatnya sendiri.
