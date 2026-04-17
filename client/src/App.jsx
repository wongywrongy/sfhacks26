import { BrowserRouter, Routes, Route } from 'react-router-dom'
import LandingPage from './pages/LandingPage.jsx'
import IntakeForm from './pages/IntakeForm.jsx'
import Dashboard from './pages/Dashboard.jsx'
import ProjectDetail from './pages/ProjectDetail.jsx'
import ApplicantReport from './pages/ApplicantReport.jsx'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/intake/:intakeToken" element={<IntakeForm />} />
        <Route path="/report/:reportToken" element={<ApplicantReport />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/dashboard/project/:projectId" element={<ProjectDetail />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
