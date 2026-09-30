import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowRight, Camera, Check, ImagePlus, Info, LoaderCircle, RotateCcw, X } from 'lucide-react'
import { analyzeFootImage, getExamination } from '../api/examinations'
import { errorText } from '../api/client'
import { ErrorState, LoadingState } from '../components/Feedback'
import { PageHeader, ProtectedImage } from '../components/UI'
import { StepIndicator } from '../components/ExaminationUI'
import { latestPhoto } from '../utils/examination'
import { useResource } from '../hooks/useResource'
import { examStatusLabel } from '../utils/format'

const allowedImageTypes = ['image/jpeg', 'image/png', 'image/webp']
const maxImageSize = 10 * 1024 * 1024

export function ScanPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const examId = Number(params.get('examination'))
  const validId = Number.isSafeInteger(examId) && examId > 0
  const resource = useResource(() => getExamination(examId), validId ? examId : 'invalid')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [analysisError, setAnalysisError] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [cameraOpen, setCameraOpen] = useState(false)
  const [cameraReady, setCameraReady] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const cameraStreamRef = useRef<MediaStream | null>(null)
  const pickerInputRef = useRef<HTMLInputElement>(null)
  const previewURL = useRef<string | null>(null)

  useEffect(() => () => {
    if (previewURL.current) URL.revokeObjectURL(previewURL.current)
    cameraStreamRef.current?.getTracks().forEach(track => track.stop())
  }, [])

  useEffect(() => {
    if (!cameraOpen || !videoRef.current || !cameraStreamRef.current) return
    videoRef.current.srcObject = cameraStreamRef.current
    void videoRef.current.play().catch(() => setAnalysisError('Kamera tidak dapat menampilkan pratinjau.'))
  }, [cameraOpen])

  function setSelectedFile(file: File) {
    if (!allowedImageTypes.includes(file.type)) {
      setAnalysisError('Pilih gambar JPEG, PNG, atau WebP.')
      return
    }
    if (file.size > maxImageSize) {
      setAnalysisError('Ukuran gambar maksimal 10 MB.')
      return
    }
    if (previewURL.current) URL.revokeObjectURL(previewURL.current)
    const url = URL.createObjectURL(file)
    previewURL.current = url
    setFile(file)
    setPreview(url)
    setAnalysisError('')
  }

  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || analyzing) return
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
    if (analyzing) return
    if (!navigator.mediaDevices?.getUserMedia) {
      setAnalysisError('Kamera tidak tersedia pada browser ini. Gunakan tombol Pilih Foto.')
      return
    }
    setAnalysisError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1600 }, height: { ideal: 1200 } } })
      cameraStreamRef.current = stream
      setCameraOpen(true)
    } catch (error) {
      const name = error instanceof DOMException ? error.name : ''
      const message = name === 'NotAllowedError' ? 'Izin kamera ditolak. Izinkan akses kamera pada browser, lalu coba kembali.' : name === 'NotFoundError' ? 'Kamera tidak ditemukan pada perangkat ini. Gunakan tombol Pilih Foto.' : 'Kamera tidak dapat dibuka. Periksa izin browser atau gunakan tombol Pilih Foto.'
      setAnalysisError(message)
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
      setAnalysisError('Foto gagal dibuat. Silakan coba kembali.')
      return
    }
    setSelectedFile(new File([blob], `kaki-${Date.now()}.jpg`, { type: 'image/jpeg' }))
    closeCamera()
  }

  async function analyze() {
    if (!file) {
      setAnalysisError('Pilih gambar terlebih dahulu.')
      return
    }
    if (analyzing) return
    setAnalyzing(true)
    setAnalysisError('')
    try {
      const result = await analyzeFootImage(examId, file)
      navigate(`/patient/result/${result.examination.id}`)
    } catch (error) {
      setAnalysisError(errorText(error))
    } finally {
      setAnalyzing(false)
    }
  }

  if (!validId) return <ErrorState message="Pemeriksaan belum dibuat. Mulai dari data klinis." />
  if (resource.loading) return <LoadingState label="Memuat pemeriksaan..." />
  if (resource.error || !resource.value) return <ErrorState message={resource.error || 'Pemeriksaan tidak tersedia.'} retry={resource.reload} />

  const exam = resource.value
  const savedPhoto = latestPhoto(exam)
  const alreadyAnalyzed = exam.ai_results.length > 0
  const scanLocked = alreadyAnalyzed || exam.examination.status === 'reviewed'

  return <div className="scan-page">
    <PageHeader eyebrow={`PEMERIKSAAN #${examId} · ${examStatusLabel[exam.examination.status]}`} title="Pemeriksaan Kaki Diabetik" description="Gunakan foto kaki dan informasi kesehatan untuk membantu pemantauan kondisi kaki Anda." />
    <div className="flow-card">
      <StepIndicator current={alreadyAnalyzed ? 5 : analyzing ? 3 : cameraOpen || file ? 2 : 1} />
      <div className="scan-layout">
        <div>
          <div className="scan-section-title"><span className="eyebrow">FOTO KAKI</span><h2>Foto kaki yang ingin diperiksa</h2><p>Ambil atau pilih satu foto kaki untuk dianalisis.</p></div>
          <div className="camera-frame">
            {preview || savedPhoto ? <ProtectedImage src={preview || savedPhoto?.image_url} alt="Pratinjau foto kaki" /> : <>
              <div className="foot-outline"><span className="toe toe-1" /><span className="toe toe-2" /><span className="toe toe-3" /><span className="toe toe-4" /><span className="toe toe-5" /></div>
              <div className="camera-caption"><Camera size={19} /><strong>Posisikan kaki sesuai panduan</strong><small>Pastikan seluruh kaki terlihat di dalam bingkai.</small></div>
            </>}
          </div>
          <div className="scan-buttons">
            <input ref={pickerInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={chooseFile} aria-label="Pilih foto kaki" hidden />
            <button className="button" type="button" onClick={openCamera} disabled={analyzing || scanLocked}><Camera size={17} /> Buka Kamera</button>
            <button className="button button-secondary" type="button" onClick={() => pickerInputRef.current?.click()} disabled={analyzing || scanLocked}><ImagePlus size={17} /> {file ? 'Ganti Foto' : 'Pilih Foto'}</button>
          </div>
          <p className="small muted preview-note">{alreadyAnalyzed ? 'Foto kaki sudah dianalisis. Mulai pemeriksaan baru untuk foto lainnya.' : file ? `Dipilih: ${file.name}` : savedPhoto ? 'Foto tersimpan. Pilih foto baru untuk dianalisis.' : 'Pilih gambar kaki untuk analisis visual.'}</p>
          <button className="button analyze-button" type="button" onClick={analyze} disabled={analyzing || scanLocked}>
            {analyzing ? <><LoaderCircle className="spin" size={16} /> Menganalisis foto kaki...</> : 'Analisis dengan AI'}
          </button>
          {analyzing && <p className="analysis-progress" role="status">FootGuard sedang mencari area visual yang perlu diperhatikan.</p>}
          {analysisError && <p className="form-error" role="alert">{analysisError}</p>}
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
    {cameraOpen && <div className="camera-dialog-backdrop" role="presentation"><section className="camera-dialog" role="dialog" aria-modal="true" aria-labelledby="camera-dialog-title"><header><div><span className="eyebrow">KAMERA PERANGKAT</span><h2 id="camera-dialog-title">Foto kaki</h2></div><button type="button" className="camera-close" onClick={closeCamera} aria-label="Tutup kamera"><X size={21} /></button></header><div className="camera-live"><video ref={videoRef} autoPlay muted playsInline onLoadedMetadata={() => setCameraReady(true)} /><div className="camera-live-guide" aria-hidden="true"><span /><span /><span /><span /></div><p>Pastikan seluruh kaki terlihat dan gambar tidak buram.</p></div><footer><button type="button" className="button button-secondary" onClick={closeCamera}><X size={16} /> Batal</button><button type="button" className="button camera-shutter" onClick={capturePhoto} disabled={!cameraReady}><Camera size={17} /> {cameraReady ? 'Ambil Foto' : 'Menyiapkan kamera...'}</button></footer><button type="button" className="camera-retry" onClick={() => { closeCamera(); void openCamera() }}><RotateCcw size={14} /> Muat ulang kamera</button></section></div>}
  </div>
}
