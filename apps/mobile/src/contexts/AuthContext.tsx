import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { api } from '../lib/api';
import { registerForPushNotifications } from '../lib/push-notifications';

interface Profile {
  id: string;
  name?: string;
  role?: string;
  condominium_id?: string;
  condominiums?: { onboarding_completed: boolean; name?: string };
}

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  profileLoading: boolean;
  onboardingCompleted: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);

  async function fetchProfile(registerPush = false) {
    setProfileLoading(true);
    try {
      const res = await api.get<{ data: Profile }>('/auth/me');
      setProfile(res.data);

      // Registra push token após login bem-sucedido
      if (registerPush) {
        registerForPushNotifications().catch(() => {});
      }
    } catch {
      setProfile(null);
    } finally {
      setProfileLoading(false);
    }
  }

  useEffect(() => {
    supabase.auth.getSession()
      .then(({ data }) => {
        setSession(data.session);
        if (data.session) fetchProfile(true);
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (s) {
        // Registra push apenas no evento de login (não em refreshes de token)
        const isLogin = event === 'SIGNED_IN';
        fetchProfile(isLogin);
      } else {
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    setProfile(null);
  }

  const onboardingCompleted = profile?.condominiums?.onboarding_completed ?? false;

  return (
    <AuthContext.Provider value={{
      session,
      user: session?.user ?? null,
      profile,
      loading,
      profileLoading,
      onboardingCompleted,
      refreshProfile: fetchProfile,
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
