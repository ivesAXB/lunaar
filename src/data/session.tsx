import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { ID } from './types';
import { loadDb } from './store';
import { supabase } from '@/lib/supabase';

/**
 * Autenticação.
 * • Supabase: e-mail e senha no Supabase Auth; o perfil (profiles) define
 *   função e se o acesso está ativo.
 * • Demonstração: confere os usuários guardados no navegador.
 */

const SESSION_KEY = 'lunaar.session';

// Id do usuário logado, lido pelas ações para assinar o histórico.
let currentUserId: ID | undefined;
export const getCurrentUserId = () => currentUserId;

function readLocalSession(): ID | undefined {
  try {
    const raw = localStorage.getItem(SESSION_KEY) ?? sessionStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as { userId: ID }).userId : undefined;
  } catch {
    return undefined;
  }
}

function writeLocalSession(userId: ID | null, remember = true) {
  try {
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_KEY);
    if (userId) (remember ? localStorage : sessionStorage).setItem(SESSION_KEY, JSON.stringify({ userId }));
  } catch {
    /* sem armazenamento: sessão só em memória */
  }
}

interface AuthValue {
  userId: ID | null;
  /** false enquanto o Supabase recupera a sessão salva */
  ready: boolean;
  login: (email: string, password: string, remember: boolean) => Promise<void>;
  logout: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<ID | null>(() => (supabase ? null : readLocalSession() ?? null));
  const [ready, setReady] = useState(!supabase);
  currentUserId = userId ?? undefined;

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setUserId(data.session?.user.id ?? null);
      setReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setUserId(session?.user.id ?? null));
    return () => data.subscription.unsubscribe();
  }, []);

  const login = useCallback(async (email: string, password: string, remember: boolean) => {
    if (supabase) {
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw new Error(/invalid login/i.test(error.message) ? 'E-mail ou senha incorretos.' : error.message);
      const { data: profile } = await supabase.from('profiles').select('active').eq('id', data.user.id).maybeSingle();
      if (!profile?.active) {
        await supabase.auth.signOut();
        throw new Error('Este acesso está desativado. Fale com a coordenação.');
      }
      currentUserId = data.user.id;
      setUserId(data.user.id);
      return;
    }
    await new Promise((r) => setTimeout(r, 650));
    const user = loadDb().users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
    if (!user || user.password !== password) throw new Error('E-mail ou senha incorretos.');
    if (!user.active) throw new Error('Este acesso está desativado. Fale com a coordenação.');
    writeLocalSession(user.id, remember);
    currentUserId = user.id;
    setUserId(user.id);
  }, []);

  const logout = useCallback(async () => {
    if (supabase) await supabase.auth.signOut();
    else writeLocalSession(null);
    currentUserId = undefined;
    setUserId(null);
  }, []);

  const requestPasswordReset = useCallback(async (email: string) => {
    if (supabase) {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/redefinir-senha` });
      if (error && !/rate limit/i.test(error.message)) throw new Error(error.message);
      if (error) throw new Error('Muitas tentativas. Aguarde alguns minutos e tente de novo.');
      return;
    }
    await new Promise((r) => setTimeout(r, 800));
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    if (!supabase) return;
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw new Error(/should be different/i.test(error.message) ? 'A nova senha precisa ser diferente da atual.' : error.message);
  }, []);

  const value = useMemo(() => ({ userId, ready, login, logout, requestPasswordReset, updatePassword }), [userId, ready, login, logout, requestPasswordReset, updatePassword]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth precisa estar dentro de <AuthProvider>');
  return ctx;
}
