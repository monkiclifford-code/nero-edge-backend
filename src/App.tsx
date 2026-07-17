import { Routes, Route } from 'react-router'
import Login from './pages/Login'
import JobEntry from './pages/JobEntry'
import SetupSheet from './pages/SetupSheet'
import InspectionForm from './pages/InspectionForm'
import NCRForm from './pages/NCRForm'
import Dashboard from './pages/Dashboard'
import JobCompletion from './pages/JobCompletion'
import SetupImageUpload from './pages/SetupImageUpload'
import SetupAnnotationEditor from './pages/SetupAnnotationEditor'

// Phase 7 — Foundry AI Vision Module
import FoundryDashboardPage from './pages/FoundryDashboardPage'
import FoundryNCRPage from './pages/FoundryNCRPage'
import VisualHistoryPage from './pages/VisualHistoryPage'
import UploadPortal from './pages/UploadPortal'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/job-entry" element={<JobEntry />} />
      <Route path="/setup-sheet/:jobId" element={<SetupSheet />} />
      <Route path="/inspection/:jobId" element={<InspectionForm />} />
      <Route path="/ncr/:jobId/:inspectionId" element={<NCRForm />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/job-completion/:jobId" element={<JobCompletion />} />
      <Route path="/setup-images/:jobId" element={<SetupImageUpload />} />
      <Route path="/setup-annotate/:jobId" element={<SetupAnnotationEditor />} />
      {/* Phase 7 — Foundry AI Vision */}
      <Route path="/foundry-dashboard" element={<FoundryDashboardPage />} />
      <Route path="/foundry-ncr" element={<FoundryNCRPage />} />
      <Route path="/visual-history" element={<VisualHistoryPage />} />
      {/* Phone Upload Portal */}
      <Route path="/upload/:sessionId" element={<UploadPortal />} />
    </Routes>
  )
}