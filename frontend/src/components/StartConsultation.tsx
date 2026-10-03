import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createConversation } from '../api/consultations'
import { errorText } from '../api/client'

export function StartConsultation({ patientId, examinationId }: { patientId: number; examinationId?: number }) {
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function start() {
    setBusy(true); setError('')
    try { const conversation = await createConversation({ patient_id: patientId, examination_id: examinationId }); navigate(`/provider/consultation?conversation=${conversation.id}`) }
    catch (err) { setError(errorText(err)) } finally { setBusy(false) }
  }
  return <div className="consultation-actions"><button className="button button-secondary" disabled={busy} onClick={() => void start()}>{busy ? 'Membuka...' : 'Buka konsultasi pasien'}</button>{error && <p className="form-error" role="alert">{error}</p>}</div>
}
