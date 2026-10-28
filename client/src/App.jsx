import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Navbar from './components/Navbar';
import Footer from './components/Footer';

// Pages
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import DoctorDashboard from './pages/DoctorDashboard';
import PatientProfile from './pages/PatientProfile';
import DoctorProfile from './pages/DoctorProfile';
import Doctors from './pages/Doctors';
import HealthTracker from './pages/HealthTracker';
import HealthLocker from './pages/HealthLocker';
import SymptomChecker from './pages/SymptomChecker';
import AmbulanceEmergency from './pages/AmbulanceEmergency';
import MyAllergies from './pages/MyAllergies';
import Family from './pages/Family';
import VaccinationSchedule from './pages/VaccinationSchedule';
import HealthPassport from './pages/HealthPassport';
import VerifyPassport from './pages/VerifyPassport';
import SharedLocker from './pages/SharedLocker';
import Review from './pages/Review';
import ConsultationRoom from './pages/ConsultationRoom';
import HealingPlan from './pages/HealingPlan';
import CarePlanForm from './pages/CarePlanForm';
import QueueStatus from './pages/QueueStatus';
import MyAppointments from './pages/MyAppointments';
import DoctorQueue from './pages/DoctorQueue';
import VisitPrep from './pages/VisitPrep';
import DoctorPrepSheet from './pages/DoctorPrepSheet';
import WritePrescription from './pages/WritePrescription';
import PrescriptionDetail from './pages/PrescriptionDetail';
import DoctorPatients from './pages/DoctorPatients';
import DoctorPatientRecords from './pages/DoctorPatientRecords';
import DoctorAnalytics from './pages/DoctorAnalytics';
import AdminDashboard from './pages/AdminDashboard';

function App() {
  return (
    <Router>
      <AuthProvider>
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
          <Navbar />
          
          <main style={{ flex: '1 0 auto' }}>
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<Home />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/shared-locker/:token" element={<SharedLocker />} />
              <Route path="/verify-passport/:token" element={<VerifyPassport />} />

              {/* Patient Protected Routes */}
              <Route 
                path="/dashboard" 
                element={
                  <ProtectedRoute allowedRoles={['patient']}>
                    <Dashboard />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/profile" 
                element={
                  <ProtectedRoute allowedRoles={['patient']}>
                    <PatientProfile />
                  </ProtectedRoute>
                } 
              />
              <Route path="/doctors" element={<Doctors />} />
              <Route 
                path="/health-tracker" 
                element={
                  <ProtectedRoute allowedRoles={['patient']}>
                    <HealthTracker />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/health-locker" 
                element={
                  <ProtectedRoute allowedRoles={['patient']}>
                    <HealthLocker />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/symptom-checker" 
                element={
                  <ProtectedRoute allowedRoles={['patient']}>
                    <SymptomChecker />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/ambulance" 
                element={
                  <ProtectedRoute allowedRoles={['patient']}>
                    <AmbulanceEmergency />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/ambulance-emergency" 
                element={
                  <ProtectedRoute allowedRoles={['patient']}>
                    <AmbulanceEmergency />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/my-allergies" 
                element={
                  <ProtectedRoute allowedRoles={['patient']}>
                    <MyAllergies />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/family" 
                element={
                  <ProtectedRoute allowedRoles={['patient']}>
                    <Family />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/family/:mid/vaccines" 
                element={
                  <ProtectedRoute allowedRoles={['patient']}>
                    <VaccinationSchedule />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/health-passport" 
                element={
                  <ProtectedRoute allowedRoles={['patient']}>
                    <HealthPassport />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/visit-prep/:aid" 
                element={
                  <ProtectedRoute allowedRoles={['patient']}>
                    <VisitPrep />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/review/:aid" 
                element={
                  <ProtectedRoute allowedRoles={['patient']}>
                    <Review />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/queue/status" 
                element={
                  <ProtectedRoute allowedRoles={['patient']}>
                    <QueueStatus />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/queue/status/:aid" 
                element={
                  <ProtectedRoute allowedRoles={['patient']}>
                    <QueueStatus />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/healing-plan" 
                element={
                  <ProtectedRoute allowedRoles={['patient']}>
                    <HealingPlan />
                  </ProtectedRoute>
                } 
              />

              {/* Doctor Protected Routes */}
              <Route 
                path="/doctor/dashboard" 
                element={
                  <ProtectedRoute allowedRoles={['doctor']}>
                    <DoctorDashboard />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/doctor/profile" 
                element={
                  <ProtectedRoute allowedRoles={['doctor']}>
                    <DoctorProfile />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/doctor/queue" 
                element={
                  <ProtectedRoute allowedRoles={['doctor']}>
                    <DoctorQueue />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/doctor/appointments" 
                element={
                  <ProtectedRoute allowedRoles={['doctor']}>
                    <MyAppointments />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/my-appointments" 
                element={
                  <ProtectedRoute allowedRoles={['doctor']}>
                    <MyAppointments />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/doctor/prep-sheet/:aid" 
                element={
                  <ProtectedRoute allowedRoles={['doctor']}>
                    <DoctorPrepSheet />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/doctor/prescription/:aid" 
                element={
                  <ProtectedRoute allowedRoles={['doctor']}>
                    <WritePrescription />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/doctor/care-plan/:aid" 
                element={
                  <ProtectedRoute allowedRoles={['doctor']}>
                    <CarePlanForm />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/doctor/patients" 
                element={
                  <ProtectedRoute allowedRoles={['doctor']}>
                    <DoctorPatients />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/doctor/patient/:pid/records" 
                element={
                  <ProtectedRoute allowedRoles={['doctor']}>
                    <DoctorPatientRecords />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/doctor/analytics" 
                element={
                  <ProtectedRoute allowedRoles={['doctor']}>
                    <DoctorAnalytics />
                  </ProtectedRoute>
                } 
              />

              {/* Doctor/Patient Joint Protected Routes */}
              <Route 
                path="/consultation/chat/:aid" 
                element={
                  <ProtectedRoute allowedRoles={['patient', 'doctor']}>
                    <ConsultationRoom />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/consultation/video/:aid" 
                element={
                  <ProtectedRoute allowedRoles={['patient', 'doctor']}>
                    <ConsultationRoom />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/prescriptions/:rx_id" 
                element={
                  <ProtectedRoute allowedRoles={['patient', 'doctor']}>
                    <PrescriptionDetail />
                  </ProtectedRoute>
                } 
              />

              {/* Admin Protected Routes */}
              <Route 
                path="/admin/dashboard" 
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <AdminDashboard />
                  </ProtectedRoute>
                } 
              />

              {/* Fallback Catch-All Redirect */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>

          <Footer />
        </div>
      </AuthProvider>
    </Router>
  );
}

export default App;
