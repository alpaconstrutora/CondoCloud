import { Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import AppLayout from './components/layout/AppLayout';
import Landing from './pages/Landing';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import ForgotPassword from './pages/auth/ForgotPassword';
import ResetPassword from './pages/auth/ResetPassword';
import Dashboard from './pages/Dashboard';
import Onboarding from './pages/Onboarding';
import Tickets from './pages/Tickets';
import TicketDetail from './pages/TicketDetail';
import Financial from './pages/Financial';
import Charges from './pages/Charges';
import Assemblies from './pages/Assemblies';
import AssemblyDetail from './pages/AssemblyDetail';
import Reservations from './pages/Reservations';
import Documents from './pages/Documents';
import Messages from './pages/Messages';
import Residents from './pages/Residents';
import Vendors from './pages/Vendors';
import InviteAccept from './pages/InviteAccept';
import CondoSettings from './pages/CondoSettings';
import Profile from './pages/Profile';
import MultiCondoDashboard from './pages/MultiCondoDashboard';
import Reports from './pages/Reports';

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Públicas */}
        <Route path="/" element={<Landing />} />
        <Route path="/convite/:token" element={<InviteAccept />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* Onboarding — protegida mas sem sidebar */}
        <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />

        {/* Protegidas — com sidebar */}
        <Route
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/overview" element={<MultiCondoDashboard />} />
          <Route path="/tickets" element={<Tickets />} />
          <Route path="/tickets/:id" element={<TicketDetail />} />
          <Route path="/financial" element={<Financial />} />
          <Route path="/charges" element={<Charges />} />
          <Route path="/assemblies" element={<Assemblies />} />
          <Route path="/assemblies/:id" element={<AssemblyDetail />} />
          <Route path="/reservations" element={<Reservations />} />
          <Route path="/documents" element={<Documents />} />
          <Route path="/messages" element={<Messages />} />
          <Route path="/residents" element={<Residents />} />
          <Route path="/vendors" element={<Vendors />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/settings" element={<CondoSettings />} />
          <Route path="/profile" element={<Profile />} />
        </Route>
      </Routes>
    </AuthProvider>
  );
}
