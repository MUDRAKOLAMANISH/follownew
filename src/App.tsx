import { ReactNode } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Onboarding from './pages/Onboarding';
import Dashboard from './pages/Dashboard';
import Leads from './pages/Leads';
import Customers from './pages/Customers';
import FollowUps from './pages/FollowUps';
import BusinessProfile from './pages/BusinessProfile';
import AIAssistant from './pages/AIAssistant';
import AdminKnowledgeBase from './pages/AdminKnowledgeBase';
import Settings from './pages/Settings';
import GmailHub from './pages/GmailHub';
import FirebaseDiagnostics from './pages/FirebaseDiagnostics';
import About from './pages/About';
import Contact from './pages/Contact';
import Pricing from './pages/Pricing';
import { AuthProvider, useAuth } from './context/AuthContext';
import DemoModals from './components/DemoModals';

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen font-sans">
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/about" element={<About />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route 
              path="/onboarding" 
              element={
                <ProtectedRoute>
                  <Onboarding />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/dashboard" 
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/leads" 
              element={
                <ProtectedRoute>
                  <Leads />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/customers" 
              element={
                <ProtectedRoute>
                  <Customers />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/followups" 
              element={
                <ProtectedRoute>
                  <FollowUps />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/gmail" 
              element={
                <ProtectedRoute>
                  <GmailHub />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/business-profile" 
              element={
                <ProtectedRoute>
                  <BusinessProfile />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/ai-assistant" 
              element={
                <ProtectedRoute>
                  <AIAssistant />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/knowledge-base" 
              element={
                <ProtectedRoute>
                  <AdminKnowledgeBase />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/knowledge-base" 
              element={
                <ProtectedRoute>
                  <AdminKnowledgeBase />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/settings" 
              element={
                <ProtectedRoute>
                  <Settings />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/diagnostics" 
              element={
                <ProtectedRoute>
                  <FirebaseDiagnostics />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/firebase-diagnostics" 
              element={
                <ProtectedRoute>
                  <FirebaseDiagnostics />
                </ProtectedRoute>
              } 
            />
          </Routes>
          <DemoModals />
        </div>
      </Router>
    </AuthProvider>
  );
}
