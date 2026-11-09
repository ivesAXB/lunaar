import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/**
 * Cliente Supabase. Sem as variáveis de ambiente o app roda em
 * modo demonstração (dados no navegador), útil para desenvolvimento.
 */
export const supabase: SupabaseClient | null = url && anonKey ? createClient(url, anonKey, { auth: { persistSession: true, autoRefreshToken: true } }) : null;

export const isRemote = supabase !== null;
