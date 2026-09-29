import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import { ProtectedRoute } from './auth/ProtectedRoute'
import { AppLayout } from './layouts/AppLayout'
import { Landing, AuthPage } from './pages/PublicPages'
import { PatientDashboard, AssessmentPage, ResultPage, HistoryPage, EducationPage, ProfilePage } from './pages/PatientPages'
import { ScanPage } from './pages/ScanPage'
import { ProviderDashboard, PatientListPage, ProviderPatientPage, ExaminationPage } from './pages/ProviderPages'
import './App.css'
import './styles/integration.css'
import './styles/dashboard.css'
import './styles/app-refresh.css'
import './styles/provider-details.css'
import './styles/education.css'
import './styles/loading.css'
import './styles/scan.css'

export default function App() {
  return <BrowserRouter><AuthProvider><Routes>
    <Route path="/" element={<Landing />} />
    <Route path="/login" element={<AuthPage mode="login" />} />
    <Route path="/register" element={<AuthPage mode="register" />} />
    <Route path="/education" element={<EducationPage />} />
    <Route path="/patient" element={<ProtectedRoute role="patient"><AppLayout role="patient" /></ProtectedRoute>}>
      <Route index element={<Navigate to="dashboard" replace />} />
      <Route path="dashboard" element={<PatientDashboard />} />
      <Route path="assessment" element={<AssessmentPage />} />
      <Route path="scan" element={<ScanPage />} />
      <Route path="result/:id" element={<ResultPage />} />
      <Route path="history" element={<HistoryPage />} />
      <Route path="education" element={<EducationPage />} />
      <Route path="profile" element={<ProfilePage />} />
    </Route>
    <Route path="/provider" element={<ProtectedRoute role="provider"><AppLayout role="provider" /></ProtectedRoute>}>
      <Route index element={<Navigate to="dashboard" replace />} />
      <Route path="dashboard" element={<ProviderDashboard />} />
      <Route path="patients" element={<PatientListPage />} />
      <Route path="patients/:id" element={<ProviderPatientPage />} />
      <Route path="examinations/:id" element={<ExaminationPage />} />
    </Route>
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes></AuthProvider></BrowserRouter>
}
