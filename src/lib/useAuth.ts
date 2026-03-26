// =============================================================================
// Render IA na Prática — Hook de Autenticação Supabase
// Gerencia sessão, login, logout e estado do usuário.
// =============================================================================

import { useCallback, useEffect, useState } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { updateLastLogin } from '../services/dbService';

export interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  mustChangePassword: boolean;
  profileName: string | null;
  clearMustChangePassword: () => void;
}

async function fetchProfileFlags(userId: string) {
  const { data } = await supabase
    .from('profiles')
    .select('must_change_password, name')
    .eq('id', userId)
    .single();
  return {
    mustChangePassword: data?.must_change_password ?? false,
    profileName: data?.name ?? null,
  };
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [profileName, setProfileName] = useState<string | null>(null);

  useEffect(() => {
    // Sessão inicial
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setLoading(false);

      if (data.session?.user) {
        updateLastLogin().catch(() => {});
        const flags = await fetchProfileFlags(data.session.user.id);
        setMustChangePassword(flags.mustChangePassword);
        setProfileName(flags.profileName);
      }
    });

    // Escuta mudanças de sessão
    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      setLoading(false);

      if (newSession?.user) {
        const flags = await fetchProfileFlags(newSession.user.id);
        setMustChangePassword(flags.mustChangePassword);
        setProfileName(flags.profileName);
      } else {
        setMustChangePassword(false);
        setProfileName(null);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const clearMustChangePassword = useCallback(() => {
    setMustChangePassword(false);
  }, []);

  return { user, session, loading, mustChangePassword, profileName, clearMustChangePassword };
}

// =============================================================================
// FUNÇÕES DE AUTH
// =============================================================================

export async function signInWithEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signUpWithEmail(email: string, password: string, name?: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name: name ?? email.split('@')[0] } },
  });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function resetPassword(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });
  if (error) throw error;
}

export async function signInWithGoogle() {
  // Use skipBrowserRedirect to get the URL first and catch provider errors before navigating
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
      skipBrowserRedirect: true,
    },
  });
  if (error) throw error;
  if (!data?.url) throw new Error('Google OAuth não configurado');
  window.location.href = data.url;
}

export async function updatePassword(newPassword: string) {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}
