import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { api } from '../lib/api';

interface Condominium {
  id: string;
  name: string;
  onboarding_completed: boolean;
  subscription_status?: string;
}

interface Profile {
  id: string;
  name?: string;
  role?: string;
  condominium_id?: string;
  condominiums?: { onboarding_completed: boolean };
}

const MULTI_CONDO_ROLES = ['desenvolvedor', 'sindico_administradora'];

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  profileLoading: boolean;
  onboardingCompleted: boolean;
  // Multi-condo
  myCondominiums: Condominium[];
  activeCondominiumId: string | null;
  switchCondominium: (id: string) => void;
  isMultiCondo: boolean;
  refreshProfile: () => Promise<void>;
  refreshCondominiums: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const ACTIVE_CONDO_KEY = 'condocloud:active_condo';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [myCondominiums, setMyCondominiums] = useState<Condominium[]>([]);
  const [activeCondominiumId, setActiveCondominiumId] = useState<string | null>(
    () => localStorage.getItem(ACTIVE_CONDO_KEY),
  );

  const fetchMyCondominiums = useCallback(async () => {
    try {
      const res = await api.get<{ data: Condominium[] }>('/auth/my-condominiums');
      const condos = res.data ?? [];
      setMyCondominiums(condos);

      // Se não há condo ativo salvo ou o salvo não existe mais, usa o primeiro
      const saved = localStorage.getItem(ACTIVE_CONDO_KEY);
      const valid = condos.find((c) => c.id === saved);
      if (!valid && condos.length > 0) {
        setActiveCondominiumId(condos[0].id);
        localStorage.setItem(ACTIVE_CONDO_KEY, condos[0].id);
      }
    } catch {
      setMyCondominiums([]);
    }
  }, []);

  const fetchProfile = useCallback(async (retries = 3) => {
    setProfileLoading(true);
    try {
      const res = await api.get<{ data: Profile }>('/auth/me');
      const p = res.data;
      setProfile(p);

      if (p?.role && MULTI_CONDO_ROLES.includes(p.role)) {
        await fetchMyCondominiums();
      }
    } catch {
      if (retries > 0) {
        await new Promise(r => setTimeout(r, 2000));
        return fetchProfile(retries - 1);
      }
      setProfile(null);
    } finally {
      setProfileLoading(false);
    }
  }, [fetchMyCondominiums]);

  useEffect(() => {
    supabase.auth.getSession()
      .then(({ data }) => {
        setSession(data.session);
        if (data.session) fetchProfile();
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (s) {
        fetchProfile();
      } else {
        setProfile(null);
        setMyCondominiums([]);
        setActiveCondominiumId(null);
        localStorage.removeItem(ACTIVE_CONDO_KEY);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  function switchCondominium(id: string) {
    setActiveCondominiumId(id);
    localStorage.setItem(ACTIVE_CONDO_KEY, id);
  }

  async function signOut() {
    await supabase.auth.signOut();
    setProfile(null);
    setMyCondominiums([]);
    setActiveCondominiumId(null);
    localStorage.removeItem(ACTIVE_CONDO_KEY);
  }

  const isMultiCondo = !!profile?.role && MULTI_CONDO_ROLES.includes(profile.role);
  const onboardingCompleted = profile?.condominiums?.onboarding_completed ?? false;

  return (
    <AuthContext.Provider value={{
      session,
      user: session?.user ?? null,
      profile,
      loading,
      profileLoading,
      onboardingCompleted,
      myCondominiums,
      activeCondominiumId,
      switchCondominium,
      isMultiCondo,
      refreshProfile: fetchProfile,
      refreshCondominiums: fetchMyCondominiums,
      signOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
