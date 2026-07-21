import { Routes, Route } from 'react-router'

// Auth
import Login from './pages/Login'

// Core workflow
import JobEntry from './pages/JobEntry'
import SetupSheet from './pages/SetupSheet'
import SetupAnnotationEditor from './pages/SetupAnnotationEditor'
import SetupLibrary from './pages/SetupLibrary'
import InspectionForm from './pages/InspectionForm'
import JobCompletion from './pages/JobCompletion'

// NCR & Feedback
import NCRForm from './pages/NCRForm'

// Programs
import CNCProgram from './pages/CNCProgram'

// Upload
import SetupImageUpload from './pages/SetupImageUpload'
import UploadPortal from './pages/UploadPortal'

// Visual History
import VisualHistoryPage from './pages/VisualHistoryPage'

// Dashboard
import Dashboard from './pages/Dashboard'

// Foundry AI Vision
import FoundryDashboardPage from './pages/FoundryDashboardPage'
import FoundryNCRPage from './pages/FoundryNCRPage'
import FoundryNCRHistory from './pages/FoundryNCRHistory'

export default function App() {
  return (
    <Routes>
      {/* Auth */}
      <Route path="/" element={<Login />} />

      {/* Core Workflow */}
      <Route path="/job-entry" element={<JobEntry />} />
      <Route path="/setup-sheet/:jobId" element={<SetupSheet />} />
      <Route path="/setup-annotate/:jobId" element={<SetupAnnotationEditor />} />
      <Route path="/setup-library" element={<SetupLibrary />} />
      <Route path="/inspection/:jobId" element={<InspectionForm />} />
      <Route path="/completion/:jobId" element={<JobCompletion />} />

      {/* NCR & Feedback */}
      <Route path="/ncr" element={<NCRForm />} />

      {/* Programs */}
      <Route path="/cnc-program" element={<CNCProgram />} />

      {/* Upload */}
      <Route path="/upload-setup" element={<SetupImageUpload />} />
      <Route path="/upload" element={<UploadPortal />} />

      {/* Visual History */}
      <Route path="/visual-history" element={<VisualHistoryPage />} />

      {/* Dashboard */}
      <Route path="/dashboard" element={<Dashboard />} />

      {/* Foundry AI Vision */}
      <Route path="/foundry-dashboard" element={<FoundryDashboardPage />} />
      <Route path="/foundry-ncr" element={<FoundryNCRPage />} />
      <Route path="/foundry-ncr-history" element={<FoundryNCRHistory />} />
    </Routes>
  )
}
