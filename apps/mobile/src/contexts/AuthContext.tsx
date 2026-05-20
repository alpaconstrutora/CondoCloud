import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { api } from '../lib/api';

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

  async function fetchProfile() {
    setProfileLoading(true);
    try {
      const res = await api.get<{ data: Profile }>('/auth/me');
      setProfile(res.data);
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
