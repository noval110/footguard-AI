export type Role = 'patient' | 'provider' | 'admin'
export type RiskCategory = 'low' | 'moderate' | 'high'
export type ReviewStatus = 'pending' | 'approved' | 'needs_followup'

export interface User { id: number; name: string; email: string; role: Role; is_active: boolean; created_at: string }
export interface Patient { id: number; user_id: number; birth_date: string | null; gender: 'male' | 'female' | 'other' | null; diabetes_type: 'type1' | 'type2' | 'other' | null; diagnosis_year: number | null; phone: string | null; address: string | null; created_at: string; updated_at: string }
export interface Assessment { id: number; patient_id: number; assessment_date: string; has_lops: boolean; has_pad: boolean; foot_deformity: boolean; previous_ulcer: boolean; previous_amputation: boolean; kidney_failure: boolean; notes: string | null; created_at: string }
export interface Examination { id: number; patient_id: number; assessment_id: number | null; status: 'pending' | 'completed' | 'reviewed'; examined_at: string; created_at: string; completed_at: string | null }
export interface FootImage { id: number; examination_id: number; image_url: string; foot_side: 'left' | 'right'; image_type: 'photo' | 'processed' | 'mask'; quality_status: 'pending' | 'good' | 'blurry' | 'incomplete'; created_at: string }
export interface AIResult { id: number; foot_image_id: number; model_version: string; finding_type: string; confidence: number; mask_url: string | null; bbox_data: unknown | null; created_at: string; ulcer_detected: boolean | null; ulcer_area_percent: number | null; threshold: number | null }
export interface AIAnalysisResult { ulcer_detected: boolean; ulcer_area_percent: number; confidence: number; threshold: number; overlay_image: string }
export interface AIAnalysisResponse { status: 'success'; result: AIAnalysisResult }
export interface PersistedAnalysis { examination: Examination; image: FootImage; ai_result: AIResult }
export interface RiskResult { id: number; examination_id: number; risk_category: RiskCategory; explanation: string; created_at: string }
export interface MedicalReview { id: number; examination_id: number; reviewer_id: number; notes: string; review_status: ReviewStatus; reviewed_at: string; created_at: string }
export interface ExaminationDetail { examination: Examination; patient: Patient; assessment: Assessment | null; foot_images: FootImage[]; ai_results: AIResult[]; risk_result: RiskResult | null; medical_review: MedicalReview | null }
export interface ProviderPatient { patient: Patient; name: string; email: string; latest_examination: Examination | null; latest_risk_result: RiskResult | null; latest_review: MedicalReview | null }
export interface PatientUpdate { birth_date: string; gender: NonNullable<Patient['gender']>; diabetes_type: NonNullable<Patient['diabetes_type']>; diagnosis_year: number; phone: string; address: string }
export type AssessmentInput = Pick<Assessment, 'has_lops' | 'has_pad' | 'foot_deformity' | 'previous_ulcer' | 'previous_amputation' | 'kidney_failure'> & { notes?: string }
export interface FootImageInput { image_url: string; foot_side: 'left' | 'right'; image_type?: 'photo'; quality_status?: 'pending' }
export interface RiskInput { risk_category: RiskCategory; explanation: string }
export interface ReviewInput { notes: string; review_status: ReviewStatus }
