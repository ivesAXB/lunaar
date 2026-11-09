/// <reference types="node" />
import { createClient } from '@supabase/supabase-js';

/**
 * POST /api/create-user — cria o login de um membro da equipe.
 *
 * Roda no servidor da Vercel porque precisa da chave de serviço do Supabase
 * (SUPABASE_SERVICE_ROLE_KEY), que nunca pode ir para o navegador.
 * Só a coordenação (perfil ativo) pode chamar.
 */
const ROLES = ['coordenacao', 'equipe', 'veterinaria'];

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' });

  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return res.status(500).json({ error: 'Servidor sem configuração do Supabase.' });

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  // 1) Quem está chamando?
  const token = String(req.headers.authorization ?? '').replace(/^Bearer\s+/i, '');
  const { data: caller, error: callerError } = await admin.auth.getUser(token);
  if (callerError || !caller.user) return res.status(401).json({ error: 'Sessão expirada. Entre novamente.' });
  const { data: callerProfile } = await admin.from('profiles').select('role, active').eq('id', caller.user.id).maybeSingle();
  if (!callerProfile?.active || callerProfile.role !== 'coordenacao') {
    return res.status(403).json({ error: 'Só a coordenação pode adicionar pessoas à equipe.' });
  }

  // 2) Validação
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body ?? {};
  const name = String(body.name ?? '').trim();
  const email = String(body.email ?? '').trim().toLowerCase();
  const role = ROLES.includes(body.role) ? body.role : 'equipe';
  const password = String(body.password ?? '');
  if (name.split(/\s+/).length < 2) return res.status(400).json({ error: 'Informe nome e sobrenome.' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'E-mail inválido.' });
  if (password.length < 8) return res.status(400).json({ error: 'A senha provisória precisa de pelo menos 8 caracteres.' });

  // 3) Cria o login (o trigger handle_new_user cria o perfil com nome e função)
  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name, role },
  });
  if (error || !created.user) {
    const msg = /already.*registered|exists/i.test(error?.message ?? '') ? 'Já existe um usuário com este e-mail.' : error?.message ?? 'Erro ao criar usuário.';
    return res.status(400).json({ error: msg });
  }

  const { data: profile } = await admin.from('profiles').select('id, name, email, role, active').eq('id', created.user.id).single();
  return res.status(201).json({ profile });
}
