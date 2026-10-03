"""Capture the current app without changing its source or using real accounts."""
import json
import re
import sys
from copy import deepcopy
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'frontend/node_modules/.uiux-tools'))
from playwright.sync_api import sync_playwright

OUT = Path(__file__).parent
SHOTS = OUT / 'screenshots'
SHOTS.mkdir(exist_ok=True)
BASE = 'http://127.0.0.1:5173'
STAMP = '2026-10-01T08:00:00+07:00'
patient = dict(id=1, user_id=1, birth_date='1975-06-12', gender='female', diabetes_type='type2', diagnosis_year=2018, phone='-', address='Data ilustrasi untuk dokumentasi UI', created_at=STAMP, updated_at=STAMP)
assessment = dict(id=1, patient_id=1, assessment_date=STAMP, has_lops=True, has_pad=False, foot_deformity=False, previous_ulcer=False, previous_amputation=False, kidney_failure=False, notes='Data contoh, bukan rekam medis.', created_at=STAMP)
details = {}
for i, risk, status in [(1, 'moderate', 'reviewed'), (2, 'high', 'completed'), (3, 'low', 'completed')]:
    exam = dict(id=i, patient_id=i, assessment_id=1, status=status, examined_at=STAMP, created_at=STAMP, completed_at=STAMP)
    photo = dict(id=i, examination_id=i, image_url='/__uiux/foot.png', foot_side='foot', image_type='photo', quality_status='good', created_at=STAMP)
    ai = dict(id=i, foot_image_id=i, model_version='demo', finding_type='visual', confidence=0.92, mask_url='/__uiux/foot.png', bbox_data=None, created_at=STAMP, ulcer_detected=False, ulcer_area_percent=0.0, threshold=0.5)
    risk_result = dict(id=i, examination_id=i, risk_category=risk, explanation='Contoh kategori untuk memperlihatkan tampilan UI. Penilaian klinis dilakukan tenaga kesehatan.', created_at=STAMP)
    review = dict(id=1, examination_id=i, reviewer_id=10, notes='Contoh catatan peninjauan untuk dokumentasi antarmuka.', review_status='approved', reviewed_at=STAMP, created_at=STAMP) if i == 1 else None
    details[i] = dict(examination=exam, patient={**patient, 'id':i}, assessment=assessment, foot_images=[photo], ai_results=[ai], risk_result=risk_result, medical_review=review)
pending = deepcopy(details[1])
pending['examination'].update(id=4, status='pending', completed_at=None)
pending.update(foot_images=[], ai_results=[], risk_result=None, medical_review=None)
details[4] = pending
provider_patients = [dict(patient={**patient, 'id':i}, name=name, email=f'pasien{i}@example.com', latest_examination=details[i]['examination'], latest_risk_result=details[i]['risk_result'], latest_review=details[i]['medical_review']) for i, name in [(1,'Pasien Contoh A'),(2,'Pasien Contoh B'),(3,'Pasien Contoh C')]]

manifest = []
errors = []

def mock_api(context, role):
    def handler(route):
        url = route.request.url
        path = '/' + url.split('/api/', 1)[1].split('?',1)[0]
        user = dict(id=10 if role=='provider' else 1, name='dr. Contoh' if role=='provider' else 'Pasien Contoh A', email=f'{role}@example.com', role=role, is_active=True, created_at=STAMP)
        values = {'/profile':user, '/patients/me':patient, '/assessments/latest':assessment, '/examinations':[details[i]['examination'] for i in [1,3]], '/provider/patients':provider_patients}
        value = values.get(path)
        match = re.fullmatch(r'/(?:provider/)?examinations/(\d+)', path)
        if match:
            value = details.get(int(match[1]))
        if value is None:
            errors.append('Unmocked API: ' + path)
            route.fulfill(status=404, json={'success':False,'message':'Data contoh tidak tersedia.'})
        else:
            route.fulfill(json={'success':True,'data':value})
    context.route(re.compile(r'https?://[^/]+/api/'), handler)
    context.route('**/__uiux/foot.png', lambda route: route.fulfill(path=str(SHOTS / 'foot-illustration.png'), content_type='image/png'))
    context.add_init_script("localStorage.setItem('footguard_token','uiux-local-demo');")

def load(page, route):
    page.goto(BASE+route, wait_until='networkidle')
    page.evaluate('document.fonts.ready')
    page.wait_for_timeout(350)

def snap(page, name, title, route, note, selector=None, scroll=None, demo=False, mobile=False):
    if scroll is not None:
        page.evaluate('(y) => window.scrollTo({top:y,behavior:"instant"})', scroll)
        page.wait_for_timeout(150)
    file = SHOTS / (name+'.png')
    if selector:
        page.locator(selector).screenshot(path=str(file), animations='disabled')
    else:
        page.screenshot(path=str(file), animations='disabled')
    overflow = page.evaluate('document.documentElement.scrollWidth > window.innerWidth')
    manifest.append(dict(file=str(file.relative_to(OUT)),title=title,route=route,note=note,demo=demo,mobile=mobile,overflow=overflow))
    print('Captured:',name, flush=True)

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=str(ROOT/'frontend/node_modules/.uiux-browsers/chromium-1243/chrome-win64/chrome.exe'))
    public = browser.new_context(viewport={'width':1440,'height':900}, device_scale_factor=1.5, locale='id-ID', timezone_id='Asia/Jakarta')
    page = public.new_page()
    page.on('pageerror', lambda e: errors.append(str(e)))
    load(page,'/')
    page.locator('.lp-feature .lp-foot-illustration').first.screenshot(path=str(SHOTS/'foot-illustration.png'))
    snap(page,'01-beranda','Beranda dan navigasi','/','Navigasi mengikuti urutan Beranda, Fitur, Cara Kerja, Untuk Tenaga Kesehatan, dan Tentang.',scroll=0)
    for name,title,selector,note in [
        ('02-fitur','Fitur utama','#fitur','Empat kartu fitur memperlihatkan hasil, riwayat, area yang ditandai, dan dashboard tenaga kesehatan.'),
        ('03-cara-kerja','Cara kerja','#cara-kerja','Empat langkah menjelaskan dokumentasi foto, analisis sistem, penilaian risiko, dan review.'),
        ('04-cuplikan','Cuplikan aplikasi','#cuplikan','Tab memperlihatkan pratinjau dashboard pasien, hasil, riwayat, dan tenaga kesehatan.'),
        ('05-tenaga-kesehatan','Untuk tenaga kesehatan','#tenaga-kesehatan','Ajakan masuk ke akun klinis dan informasi akses melalui administrator institusi.'),
        ('06-tentang','Tentang DIA SCAN','#tentang','Nilai layanan ditampilkan melalui kemudahan penggunaan, monitoring, dukungan klinis, dan visualisasi.')]:
        snap(page,name,title,'/',note,selector=selector)
    load(page,'/login')
    snap(page,'07-login','Masuk ke akun','/login','Pemilihan peran pasien atau tenaga kesehatan, email, kata sandi, dan tombol tampilkan kata sandi.')
    page.get_by_role('button',name='Tenaga Kesehatan').click()
    snap(page,'08-login-provider','Masuk sebagai tenaga kesehatan','/login','Pemilihan peran mengubah konteks login tanpa memindahkan formulir.')
    load(page,'/register')
    snap(page,'09-register','Pendaftaran pasien','/register','Nama, email, dan kata sandi menjadi isian utama. Akun klinis dikelola administrator.')
    load(page,'/education')
    snap(page,'10-edukasi','Edukasi perawatan kaki','/education','Kategori artikel dan panduan perawatan menjadi akses edukasi bagi pengguna.')

    for role, screens in [
        ('patient',[
            ('11-dashboard-pasien','Dashboard pasien','/patient/dashboard','Ringkasan pemeriksaan, status, riwayat singkat, dan pintasan pemeriksaan baru.'),
            ('12-penilaian','Informasi kesehatan','/patient/assessment','Enam pertanyaan Ya/Tidak menjadi konteks klinis sebelum dokumentasi foto.'),
            ('13-scan','Pemeriksaan dan foto kaki','/patient/scan?examination=4','Panduan foto, Buka Kamera, Pilih Foto, dan Analisis dengan AI.'),
            ('14-hasil','Hasil pemeriksaan','/patient/result/1','Hasil visual ditampilkan terpisah dari kategori risiko klinis dan status review.'),
            ('15-riwayat','Riwayat pemeriksaan','/patient/history','Daftar pemeriksaan yang dapat dibuka kembali untuk melihat hasil dan tindak lanjut.'),
            ('16-profil','Profil pasien','/patient/profile','Data identitas dan informasi diabetes dapat diperbarui dari area profil.')]),
        ('provider',[
            ('17-dashboard-klinis','Dashboard tenaga kesehatan','/provider/dashboard','Ringkasan klinis, antrean review menurut prioritas, dan direktori pasien.'),
            ('18-daftar-pasien','Daftar pasien','/provider/patients','Pencarian nama, filter risiko, filter status review, dan akses ke profil pasien.'),
            ('19-profil-pasien','Detail pasien','/provider/patients/1','Informasi pasien dan pemeriksaan terakhir ditampilkan sebagai konteks peninjauan.'),
            ('20-review','Review pemeriksaan','/provider/examinations/2','Foto dan analisis visual, faktor klinis, kategori risiko, dan formulir review.')])]:
        context = browser.new_context(viewport={'width':1440,'height':900}, device_scale_factor=1.5, locale='id-ID', timezone_id='Asia/Jakarta')
        mock_api(context,role)
        screen = context.new_page()
        screen.on('pageerror',lambda e: errors.append(str(e)))
        for name,title,route,note in screens:
            load(screen,route)
            snap(screen,name,title,route,note,demo=True)
            if name in ['14-hasil','17-dashboard-klinis','20-review']:
                snap(screen,name+'-lanjutan',title+' / lanjutan',route,'Bagian bawah halaman memperlihatkan informasi dan tindakan lanjutan.',scroll=850,demo=True)
            if name in ['14-hasil','20-review']:
                bottom = screen.evaluate('document.documentElement.scrollHeight - window.innerHeight')
                snap(screen,name+'-tindak-lanjut',title+' / tindak lanjut',route,'Penilaian klinis, status review, dan tindakan pada akhir halaman.',scroll=bottom,demo=True)
        context.close()

    mobile = browser.new_context(viewport={'width':390,'height':844},device_scale_factor=2,locale='id-ID',timezone_id='Asia/Jakarta',is_mobile=True,has_touch=True)
    m = mobile.new_page()
    load(m,'/')
    snap(m,'21-mobile-beranda','Mobile / beranda','/','Konten disusun satu kolom dengan menu yang dapat dibuka.',mobile=True)
    m.get_by_role('button',name='Buka menu',exact=True).click()
    snap(m,'22-mobile-menu','Mobile / navigasi','/','Menu mobile menampilkan tautan bagian halaman dan akses akun.',mobile=True)
    load(m,'/login')
    snap(m,'23-mobile-login','Mobile / login','/login','Formulir login pada layar 390 x 844 piksel.',mobile=True)
    mock_api(mobile,'patient')
    load(m,'/patient/dashboard')
    snap(m,'24-mobile-dashboard','Mobile / dashboard','/patient/dashboard','Dashboard pasien menggunakan susunan kartu satu kolom.',demo=True,mobile=True)
    m.get_by_role('button',name='Buka menu navigasi',exact=True).click()
    snap(m,'25-mobile-sidebar','Mobile / menu pasien','/patient/dashboard','Menu samping dibuka sebagai drawer untuk akses fitur pasien.',demo=True,mobile=True)
    load(m,'/patient/scan?examination=4')
    snap(m,'26-mobile-scan','Mobile / foto kaki','/patient/scan?examination=4','Alur dokumentasi foto menyesuaikan lebar layar mobile.',demo=True,mobile=True)
    browser.close()

(OUT/'manifest.json').write_text(json.dumps({'screens':manifest,'errors':errors},ensure_ascii=False,indent=2),encoding='utf-8')
print('Screens:',len(manifest),'Errors:',errors,flush=True)
