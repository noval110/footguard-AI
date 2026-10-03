# DIA SCAN — dokumentasi UI/UX

File utama: [DIA-SCAN-UI-UX.pdf](DIA-SCAN-UI-UX.pdf).

Dokumen dibuat pada 1 Oktober 2026 dari implementasi frontend di workspace ini. Mencakup halaman publik, autentikasi, area pasien, area tenaga kesehatan, alur pengguna, bahasa visual, serta contoh mobile.

Tangkapan layar desktop memakai viewport 1440 × 900; mobile 390 × 844. Bagian landing tertentu ditangkap sebagai satu section. Seluruh halaman akun memakai respons API contoh yang hanya berlaku di browser dokumentasi. Nama, alamat email, angka analisis, risiko, dan review merupakan ilustrasi. Gambar kaki pada halaman akun menggunakan ilustrasi yang sudah tersedia pada landing, bukan foto pasien atau keluaran analisis nyata.

Sumber website, autentikasi sebenarnya, database, dan API tidak diubah. `manifest.json` mencatat screenshot dan hasil pemeriksaan kesalahan JavaScript/API serta overflow horizontal.

## Membuat ulang

Jalankan frontend dengan `npm.cmd run dev -- --host 127.0.0.1` dari direktori `frontend`. Alat Python lokal ditempatkan di `frontend/node_modules/.uiux-tools`; browser di `frontend/node_modules/.uiux-browsers`.

Dari direktori workspace:

```powershell
python artifacts/uiux/capture_ui.py
python artifacts/uiux/build_pdf.py
```

Jika lingkungan Windows membatasi akses alat yang diunduh, jalankan menggunakan izin pengguna yang menginstal alat tersebut. File screenshot terdapat di folder `screenshots`.
