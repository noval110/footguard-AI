"""Build a visual UI/UX document from screenshots of the current DIA SCAN app."""
import json
import sys
from pathlib import Path
from xml.sax.saxutils import escape

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'frontend/node_modules/.uiux-tools'))
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor, white
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph
from reportlab.lib.styles import ParagraphStyle
from PIL import Image

OUT = Path(__file__).parent
data = json.loads((OUT/'manifest.json').read_text(encoding='utf-8'))
desktop = [s for s in data['screens'] if not s['mobile']]
mobile = [s for s in data['screens'] if s['mobile']]
pdfmetrics.registerFont(TTFont('Arial', 'C:/Windows/Fonts/arial.ttf'))
pdfmetrics.registerFont(TTFont('ArialBold', 'C:/Windows/Fonts/arialbd.ttf'))
W,H = 841.89,595.28
INK = HexColor('#17263d')
MUTED = HexColor('#65758a')
WINE = HexColor('#87384f')
PALE = HexColor('#f7eaee')
LINE = HexColor('#ece3e5')
BG = HexColor('#fbf7f8')
dest = OUT/'DIA-SCAN-UI-UX.pdf'
c = canvas.Canvas(str(dest),pagesize=(W,H),pageCompression=1)
c.setTitle('DIA SCAN | Dokumentasi UI/UX Website')
c.setAuthor('DIA SCAN')
c.setSubject('Tampilan website saat ini: desktop, mobile, navigasi, dan alur pengguna. 1 Oktober 2026.')
page_no = 0

def para(text,x,y,width,size=10,color=INK,bold=False,leading=None):
    style = ParagraphStyle('body',fontName='ArialBold' if bold else 'Arial',fontSize=size,leading=leading or size*1.45,textColor=color)
    p = Paragraph(text,style)
    _,height = p.wrap(width,H)
    p.drawOn(c,x,y-height)
    return height

def frame(title,kicker='DOKUMENTASI UI/UX',subtitle=None):
    global page_no
    page_no += 1
    c.setFillColor(white);c.rect(0,0,W,H,fill=1,stroke=0)
    c.setFillColor(WINE);c.rect(0,H-6,W,6,fill=1,stroke=0)
    para(kicker,38,H-25,650,8,WINE,True)
    para(title,38,H-45,760,23,INK,True)
    if subtitle: para(subtitle,38,H-82,760,9,MUTED)
    c.setStrokeColor(LINE);c.line(38,34,W-38,34)
    para('DIA SCAN  /  Tampilan website saat ini',38,25,400,8,MUTED)
    c.setFont('Arial',8);c.setFillColor(MUTED);c.drawRightString(W-38,14,f'1 Oktober 2026  |  {page_no:02d}')

def image(file,x,y,w,h):
    iw,ih = Image.open(file).size
    scale = min(w/iw,h/ih)
    dw,dh = iw*scale,ih*scale
    dx,dy=x+(w-dw)/2,y+(h-dh)/2
    c.drawImage(str(file),dx,dy,width=dw,height=dh,mask='auto')
    c.setStrokeColor(LINE);c.rect(dx,dy,dw,dh,fill=0,stroke=1)
    return dx,dy,dw,dh

def end(): c.showPage()

frame('DIA SCAN', 'WEBSITE  /  UI & UX')
para('Dokumentasi<br/>tampilan dan<br/>alur pengguna',38,465,310,31,INK,True,39)
para('Desktop & mobile',38,307,280,14,WINE,True)
para('Dokumen visual dari implementasi website saat ini. Nama DIA SCAN, palet marun, dan urutan navigasi mengikuti versi terbaru.',38,272,280,11,MUTED)
image(OUT/desktop[0]['file'],350,150,454,295)
para('Cakupan',38,155,280,10,WINE,True)
para('Halaman publik · Akun pasien · Akun tenaga kesehatan · Tampilan responsif',38,132,680,11,INK)
para('Halaman akun menggunakan data contoh dan ilustrasi kaki untuk memperlihatkan UI. Tidak menggunakan rekam medis atau hasil analisis pasien nyata.',38,87,750,9,MUTED)
end()

entries = [('Alur pengguna',3),('Bahasa visual & interaksi',4)]
entries.extend((s['title'],5+i) for i,s in enumerate(desktop))
mobile_start = 5+len(desktop)
entries.extend((f"Mobile / {mobile[i]['title'].split(' / ',1)[1]} & {mobile[i+1]['title'].split(' / ',1)[1]}",mobile_start+i//2) for i in range(0,len(mobile),2))
frame('Isi dokumen',subtitle='Tangkapan layar disusun mengikuti halaman publik, pasien, tenaga kesehatan, lalu mobile.')
rows = (len(entries)+1)//2
for i,(title,num) in enumerate(entries):
    col,row=divmod(i,rows)
    x=38+col*392;y=H-127-row*24
    para(escape(title),x,y,324,10,INK)
    c.setFont('ArialBold',10);c.setFillColor(WINE);c.drawRightString(x+360,y-11,f'{num:02d}')
    c.setStrokeColor(LINE);c.line(x,y-17,x+360,y-17)
    c.linkRect('',f'page-{num}',(x,y-16,x+360,y+2),relative=0,thickness=0)
end()

frame('Alur pengguna',subtitle='Peta alur berdasarkan rute dan tindakan yang tersedia pada website saat ini.')
c.bookmarkPage('page-3')
para('01 / PENGUNJUNG',38,464,700,10,WINE,True)
para('Beranda → Fitur → Cara Kerja → Untuk Tenaga Kesehatan → Tentang',38,441,760,13,INK,True)
para('Akses lanjutan: cuplikan aplikasi, edukasi perawatan, masuk, dan daftar pasien.',38,414,760,10,MUTED)

def flow(label,nodes,y):
    para(label,38,y+32,760,10,WINE,True)
    gap=15;bw=(W-76-gap*(len(nodes)-1))/len(nodes)
    for i,(heading,body) in enumerate(nodes):
        x=38+i*(bw+gap)
        c.setFillColor(PALE);c.setStrokeColor(LINE);c.roundRect(x,y-94,bw,98,8,fill=1,stroke=1)
        para(heading,x+13,y-10,bw-26,11,INK,True)
        para(body,x+13,y-36,bw-26,9,MUTED)
        if i<len(nodes)-1:
            c.setStrokeColor(WINE);c.line(x+bw+3,y-44,x+bw+12,y-44)
            c.line(x+bw+9,y-41,x+bw+12,y-44);c.line(x+bw+9,y-47,x+bw+12,y-44)
flow('02 / PASIEN',[
    ('Masuk / daftar','Akun dan akses dashboard pasien.'),
    ('Informasi kesehatan','Enam pertanyaan sebagai konteks klinis.'),
    ('Foto kaki','Ambil atau unggah foto, lalu analisis AI.'),
    ('Hasil & riwayat','Lihat analisis visual, risiko klinis, dan review.')],351)
flow('03 / TENAGA KESEHATAN',[
    ('Masuk akun klinis','Akun diperoleh dari administrator institusi.'),
    ('Dashboard & pasien','Antrean prioritas dan pencarian pasien.'),
    ('Tinjau pemeriksaan','Foto, hasil AI, dan informasi kesehatan.'),
    ('Risiko & review','Tetapkan kategori klinis dan catatan tindak lanjut.')],186)
end()

frame('Bahasa visual & interaksi',subtitle='Elemen yang dipakai pada website saat ini; tidak merupakan rancangan ulang.')
c.bookmarkPage('page-4')
swatches=[('#87384F','Warna utama'),('#742C43','Hover utama'),('#63283D','Warna aktif'),('#F7EAEE','Permukaan aksen'),('#17263D','Teks utama'),('#FFFFFF','Kartu / formulir')]
for i,(color,label) in enumerate(swatches):
    x=38+i*130
    c.setFillColor(HexColor(color));c.setStrokeColor(LINE);c.roundRect(x,381,112,68,8,fill=1,stroke=1)
    para(label,x,368,120,9,INK,True);para(color,x,350,120,9,MUTED)
para('Tipografi',38,303,340,13,WINE,True)
para('DM Sans digunakan pada halaman utama, autentikasi, dan tampilan aplikasi yang diperbarui. Judul memakai bobot tebal; label, bantuan, dan metadata memakai ukuran lebih kecil.',38,278,350,11,INK)
para('Komponen',435,303,365,13,WINE,True)
para('Tombol utama dan sekunder, kartu ringkasan, badge risiko dan review, tab pratinjau, formulir berlabel, daftar riwayat, serta tabel pasien.',435,278,365,11,INK)
para('Navigasi & umpan balik',38,184,350,13,WINE,True)
para('Menu aktif, indikator langkah, kondisi memuat, pesan kesalahan, validasi isian, serta status pemeriksaan membantu pengguna memahami posisi dan tindakan berikutnya.',38,159,350,11,INK)
para('Tampilan mobile',435,184,365,13,WINE,True)
para('Konten memakai susunan satu kolom. Menu utama menjadi menu buka/tutup, sementara area pasien memakai drawer navigasi. Contoh ditangkap pada 390 × 844 piksel.',435,159,365,11,INK)
end()

for s in desktop:
    note = s['note']
    frame(s['title'],'DESKTOP  /  1440 × 900',escape(s['route'])+('  ·  DATA CONTOH' if s['demo'] else '  ·  HALAMAN PUBLIK'))
    c.bookmarkPage(f'page-{page_no}')
    c.addOutlineEntry(s['title'],f'page-{page_no}',level=0,closed=False)
    image(OUT/s['file'],38,91,W-76,387)
    para(escape(note),38,78,W-76,9,MUTED)
    end()

for i in range(0,len(mobile),2):
    pair = mobile[i:i+2]
    frame('Tampilan mobile','MOBILE  /  390 × 844',f"{pair[0]['title']}  ·  {pair[1]['title']}")
    c.bookmarkPage(f'page-{page_no}')
    c.addOutlineEntry('Mobile: '+pair[0]['title'],f'page-{page_no}',level=0,closed=False)
    for j,s in enumerate(pair):
        x=38+j*392
        image(OUT/s['file'],x,81,192,399)
        para(escape(s['title']),x+210,443,157,13,WINE,True)
        para(escape(s['route']),x+210,398,157,8,MUTED)
        para(escape(s['note']),x+210,352,157,10,INK)
        if s['demo']:
            para('Data contoh untuk dokumentasi UI.',x+210,240,157,9,MUTED)
    end()

c.save()
print('PDF:',dest,'Pages:',page_no,flush=True)
