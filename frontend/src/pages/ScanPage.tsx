import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowRight, Camera, Check, ImagePlus, Info, LoaderCircle, RotateCcw, X } from 'lucide-react'
import { analyzeFootImage, getExamination } from '../api/examinations'
import { errorText } from '../api/client'
import type { ExaminationDetail } from '../api/types'
import { ErrorState, LoadingState } from '../components/Feedback'
import { PageHeader, ProtectedImage } from '../components/UI'
import { StepIndicator } from '../components/ExaminationUI'
import { latestPhoto } from '../utils/examination'
import { useResource } from '../hooks/useResource'
import { examStatusLabel } from '../utils/format'

type FootSide = 'left' | 'right'
type BySide<T> = Partial<Record<FootSide, T>>

const allowedImageTypes = ['image/jpeg', 'image/png', 'image/webp']
const maxImageSize = 10 * 1024 * 1024

function imageFor(detail: ExaminationDetail, side: FootSide) {
  return [...detail.foot_images].reverse().find(image => image.foot_side === side && image.image_type === 'photo')?.image_url
}

export function ScanPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const examId = Number(params.get('examination'))
  const validId = Number.isSafeInteger(examId) && examId > 0
  const resource = useResource(() => getExamination(examId), validId ? examId : 'invalid')
  const [side, setSide] = useState<FootSide>('left')
  const [files, setFiles] = useState<BySide<File>>({})
  const [previews, setPreviews] = useState<BySide<string>>({})
  const [analysisErrors, setAnalysisErrors] = useState<BySide<string>>({})
  const [analyzingSide, setAnalyzingSide] = useState<FootSide | null>(null)
  const [cameraOpen, setCameraOpen] = useState(false)
  const [cameraReady, setCameraReady] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const cameraStreamRef = useRef<MediaStream | null>(null)
  const pickerInputRef = useRef<HTMLInputElement>(null)
  const previewURLs = useRef<BySide<string>>({})

  useEffect(() => () => {
    Object.values(previewURLs.current).forEach(url => { if (url) URL.revokeObjectURL(url) })
    cameraStreamRef.current?.getTracks().forEach(track => track.stop())
  }, [])

  useEffect(() => {
    if (!cameraOpen || !videoRef.current || !cameraStreamRef.current) return
    videoRef.current.srcObject = cameraStreamRef.current
    void videoRef.current.play().catch(() => setAnalysisErrors(previous => ({ ...previous, [side]: 'Kamera tidak dapat menampilkan pratinjau.' })))
  }, [cameraOpen, side])

  function setSelectedFile(file: File) {
    if (!allowedImageTypes.includes(file.type)) {
      setAnalysisErrors(previous => ({ ...previous, [side]: 'Pilih gambar JPEG, PNG, atau WebP.' }))
      return
    }
    if (file.size > maxImageSize) {
      setAnalysisErrors(previous => ({ ...previous, [side]: 'Ukuran gambar maksimal 10 MB.' }))
      return
    }
    if (previewURLs.current[side]) URL.revokeObjectURL(previewURLs.current[side])
    const previewURL = URL.createObjectURL(file)
    previewURLs.current[side] = previewURL
    setFiles(previous => ({ ...previous, [side]: file }))
    setPreviews(previous => ({ ...previous, [side]: previewURL }))
    setAnalysisErrors(previous => ({ ...previous, [side]: undefined }))
  }

  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || analyzingSide) return
    setSelectedFile(file)
  }

  function closeCamera() {
    cameraStreamRef.current?.getTracks().forEach(track => track.stop())
    cameraStreamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setCameraOpen(false)
    setCameraReady(false)
  }

  async function openCamera() {
    if (analyzingSide) return
    if (!navigator.mediaDevices?.getUserMedia) {
      setAnalysisErrors(previous => ({ ...previous, [side]: 'Kamera tidak tersedia pada browser ini. Gunakan tombol Pilih Foto.' }))
      return
    }
    setAnalysisErrors(previous => ({ ...previous, [side]: undefined }))
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1600 }, height: { ideal: 1200 } } })
      cameraStreamRef.current = stream
      setCameraOpen(true)
    } catch (error) {
      const name = error instanceof DOMException ? error.name : ''
      const message = name === 'NotAllowedError' ? 'Izin kamera ditolak. Izinkan akses kamera pada browser, lalu coba kembali.' : name === 'NotFoundError' ? 'Kamera tidak ditemukan pada perangkat ini. Gunakan tombol Pilih Foto.' : 'Kamera tidak dapat dibuka. Periksa izin browser atau gunakan tombol Pilih Foto.'
      setAnalysisErrors(previous => ({ ...previous, [side]: message }))
    }
  }

  async function capturePhoto() {
    const video = videoRef.current
    if (!video || !video.videoWidth || !video.videoHeight) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const context = canvas.getContext('2d')
    if (!context) return
    context.drawImage(video, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', .92))
    if (!blob) {
      setAnalysisErrors(previous => ({ ...previous, [side]: 'Foto gagal dibuat. Silakan coba kembali.' }))
      return
    }
    setSelectedFile(new File([blob], `kaki-${side === 'left' ? 'kiri' : 'kanan'}-${Date.now()}.jpg`, { type: 'image/jpeg' }))
    closeCamera()
  }

  async function analyze() {
    const selectedSide = side
    const file = files[selectedSide]
    if (!file) {
      setAnalysisErrors(previous => ({ ...previous, [selectedSide]: 'Pilih gambar terlebih dahulu.' }))
      return
    }
    if (analyzingSide) return
    setAnalyzingSide(selectedSide)
    setAnalysisErrors(previous => ({ ...previous, [selectedSide]: undefined }))
    try {
      const result = await analyzeFootImage(examId, selectedSide, file)
      navigate(`/patient/result/${result.examination.id}`)
    } catch (error) {
      setAnalysisErrors(previous => ({ ...previous, [selectedSide]: errorText(error) }))
    } finally {
      setAnalyzingSide(null)
    }
  }

  if (!validId) return <ErrorState message="Pemeriksaan belum dibuat. Mulai dari data klinis." />
  if (resource.loading) return <LoadingState label="Memuat pemeriksaan..." />
  if (resource.error || !resource.value) return <ErrorState message={resource.error || 'Pemeriksaan tidak tersedia.'} retry={resource.reload} />

  const exam = resource.value
  const saved = (footSide: FootSide) => !!latestPhoto(exam, footSide)
  const sideStatus = (footSide: FootSide) => {
    const photo = latestPhoto(exam, footSide)
    return !photo ? 'Belum diperiksa' : exam.ai_results.some(result => result.foot_image_id === photo.id) ? 'Sudah dianalisis' : 'Foto tersedia'
  }
  const currentError = analysisErrors[side]

  return <>
    <PageHeader eyebrow={`PEMERIKSAAN #${examId} · ${examStatusLabel[exam.examination.status]}`} title="Pemeriksaan Kaki Diabetik" description="Gunakan foto kaki dan informasi kesehatan untuk membantu pemantauan kondisi kaki Anda." />
    <div className="flow-card">
      <StepIndicator current={analyzingSide ? 3 : cameraOpen || files[side] ? 2 : 1} />
      <div className="scan-layout">
        <div>
          <div className="scan-section-title"><span className="eyebrow">PILIH SISI KAKI</span><h2>Foto kaki yang ingin diperiksa</h2><p>Anda dapat menambahkan kaki kiri dan kanan pada pemeriksaan yang sama.</p></div>
          <div className="tab-list" role="tablist" aria-label="Pilih sisi kaki">
            <button type="button" className={side === 'left' ? 'active' : ''} onClick={() => setSide('left')} role="tab" aria-selected={side === 'left'}>Kaki Kiri <small>{sideStatus('left')}</small></button>
            <button type="button" className={side === 'right' ? 'active' : ''} onClick={() => setSide('right')} role="tab" aria-selected={side === 'right'}>Kaki Kanan <small>{sideStatus('right')}</small></button>
          </div>
          <div className="camera-frame">
            {previews[side] || imageFor(exam, side) ? <ProtectedImage src={previews[side] || imageFor(exam, side)} alt={`Pratinjau kaki ${side === 'left' ? 'kiri' : 'kanan'}`} /> : <>
              <div className="foot-outline"><span className="toe toe-1" /><span className="toe toe-2" /><span className="toe toe-3" /><span className="toe toe-4" /><span className="toe toe-5" /></div>
              <div className="camera-caption"><Camera size={19} /><strong>Posisikan kaki sesuai panduan</strong><small>Pastikan seluruh kaki terlihat di dalam bingkai.</small></div>
            </>}
          </div>
          <div className="scan-buttons">
            <input ref={pickerInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={chooseFile} aria-label="Pilih foto kaki" hidden />
            <button className="button" type="button" onClick={openCamera} disabled={!!analyzingSide || exam.examination.status === 'reviewed'}><Camera size={17} /> Buka Kamera</button>
            <button className="button button-secondary" type="button" onClick={() => pickerInputRef.current?.click()} disabled={!!analyzingSide || exam.examination.status === 'reviewed'}><ImagePlus size={17} /> {files[side] ? 'Ganti Foto' : 'Pilih Foto'}</button>
          </div>
          <p className="small muted preview-note">{files[side] ? `Dipilih: ${files[side].name}` : saved(side) ? 'Foto tersimpan. Pilih foto baru untuk menganalisis ulang.' : 'Pilih gambar kaki untuk analisis visual.'}</p>
          <button className="button analyze-button" type="button" onClick={analyze} disabled={!!analyzingSide || exam.examination.status === 'reviewed'}>
            {analyzingSide === side ? <><LoaderCircle className="spin" size={16} /> Menganalisis foto kaki...</> : 'Analisis dengan AI'}
          </button>
          {analyzingSide === side && <p className="analysis-progress" role="status">FootGuard sedang mencari area visual yang perlu diperhatikan.</p>}
          {currentError && <p className="form-error" role="alert">{currentError}</p>}
        </div>
        <aside className="scan-guide">
          <p className="eyebrow">PANDUAN FOTO</p>
          <h3>Foto yang jelas membantu pemantauan.</h3>
          {['Cahaya cukup', 'Foto tidak buram', 'Seluruh area kaki terlihat', 'Latar belakang sederhana'].map(item => <div className="guide-item" key={item}><Check size={16} />{item}</div>)}
          <div className="guide-note"><Info size={16} />AI menilai tampilan foto. Risiko klinis dan review tenaga kesehatan dicatat terpisah.</div>
        </aside>
      </div>
      <div className="flow-actions"><Link to="/patient/assessment" className="button button-secondary">Sebelumnya</Link><button className="button" type="button" onClick={() => navigate(`/patient/result/${examId}`)}>Lihat Pemeriksaan <ArrowRight size={16} /></button></div>
    </div>
    {cameraOpen && <div className="camera-dialog-backdrop" role="presentation"><section className="camera-dialog" role="dialog" aria-modal="true" aria-labelledby="camera-dialog-title"><header><div><span className="eyebrow">KAMERA PERANGKAT</span><h2 id="camera-dialog-title">Foto kaki {side === 'left' ? 'kiri' : 'kanan'}</h2></div><button type="button" className="camera-close" onClick={closeCamera} aria-label="Tutup kamera"><X size={21} /></button></header><div className="camera-live"><video ref={videoRef} autoPlay muted playsInline onLoadedMetadata={() => setCameraReady(true)} /><div className="camera-live-guide" aria-hidden="true"><span /><span /><span /><span /></div><p>Pastikan seluruh kaki terlihat dan gambar tidak buram.</p></div><footer><button type="button" className="button button-secondary" onClick={closeCamera}><X size={16} /> Batal</button><button type="button" className="button camera-shutter" onClick={capturePhoto} disabled={!cameraReady}><Camera size={17} /> {cameraReady ? 'Ambil Foto' : 'Menyiapkan kamera...'}</button></footer><button type="button" className="camera-retry" onClick={() => { closeCamera(); void openCamera() }}><RotateCcw size={14} /> Muat ulang kamera</button></section></div>}
  </>
}
