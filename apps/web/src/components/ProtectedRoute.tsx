import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading, profile, onboardingCompleted } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', height: '100vh', fontFamily: 'var(--sans)' }}>
        <div style={{ color: 'var(--green-dark)', fontWeight: 600 }}>Carregando…</div>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Redireciona para onboarding se perfil carregado e onboarding não completo
  const isOnboardingRoute = location.pathname === '/onboarding';
  if (profile && !onboardingCompleted && !isOnboardingRoute) {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
}
