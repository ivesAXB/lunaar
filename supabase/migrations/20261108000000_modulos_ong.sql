-- ═══════════════════════════════════════════════════════════════
-- LUNAAR · Módulos trazidos do ONG-Lunar-Site
--
-- • Separação ONG × Recanto (coluna base em animais e canis)
-- • Agenda de doses: horários no tratamento + registro de cada dose
-- • Tarefas da equipe
-- • Histórico de peso
-- • Documentos do animal (bucket privado "documents")
--
-- Só ADICIONA colunas e tabelas: nenhum dado existente é apagado.
-- Aplicar com: npx supabase db push
-- ═══════════════════════════════════════════════════════════════

-- ─── Separação ONG × Recanto ───────────────────────────────────
alter table public.animals add column if not exists base text not null default 'ong' check (base in ('ong', 'recanto'));
alter table public.kennels add column if not exists base text not null default 'ong' check (base in ('ong', 'recanto'));
create index if not exists animals_base_idx on public.animals (base);

-- ─── Agenda de doses ───────────────────────────────────────────
-- Horários diários do medicamento, ex.: {'08:00','20:00'}. Vazio = sem agenda de doses.
alter table public.animal_treatments add column if not exists times text[] not null default '{}';

create table if not exists public.medication_doses (
  id             text primary key default gen_random_uuid()::text,
  treatment_id   text not null references public.animal_treatments(id) on delete cascade,
  animal_id      text not null references public.animals(id) on delete cascade,
  scheduled_on   date not null,
  scheduled_time text not null check (scheduled_time ~ '^[0-2][0-9]:[0-5][0-9]$'),
  given_at       timestamptz not null default now(),
  user_id        uuid references public.profiles(id) on delete set null,
  notes          text,
  unique (treatment_id, scheduled_on, scheduled_time)
);
create index if not exists medication_doses_day_idx on public.medication_doses (scheduled_on);

-- ─── Tarefas ───────────────────────────────────────────────────
create table if not exists public.tasks (
  id           text primary key default gen_random_uuid()::text,
  title        text not null,
  animal_id    text references public.animals(id) on delete cascade,
  base         text not null default 'ong' check (base in ('ong', 'recanto')),
  assignee_id  uuid references public.profiles(id) on delete set null,
  priority     text not null default 'normal' check (priority in ('baixa', 'normal', 'alta', 'critica')),
  category     text not null default 'geral' check (category in ('geral', 'medicacao', 'exame', 'higiene', 'monitoramento', 'alta')),
  due_at       timestamptz not null,
  status       text not null default 'pendente' check (status in ('pendente', 'em_andamento', 'concluida')),
  notes        text,
  created_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  done_at      timestamptz
);
create index if not exists tasks_status_idx on public.tasks (status, due_at);

-- ─── Histórico de peso ─────────────────────────────────────────
create table if not exists public.animal_weights (
  id           text primary key default gen_random_uuid()::text,
  animal_id    text not null references public.animals(id) on delete cascade,
  measured_on  date not null,
  weight_kg    numeric(5,2) not null check (weight_kg > 0),
  notes        text,
  user_id      uuid references public.profiles(id) on delete set null
);
create index if not exists animal_weights_animal_idx on public.animal_weights (animal_id, measured_on);

-- Pesos já cadastrados viram o primeiro ponto do histórico.
insert into public.animal_weights (animal_id, measured_on, weight_kg, notes)
select a.id, coalesce(a.last_vet_visit, a.intake_date), a.weight_kg, 'Peso do cadastro'
from public.animals a
where a.weight_kg is not null
  and not exists (select 1 from public.animal_weights w where w.animal_id = a.id);

-- ─── Documentos ────────────────────────────────────────────────
create table if not exists public.animal_documents (
  id           text primary key default gen_random_uuid()::text,
  animal_id    text not null references public.animals(id) on delete cascade,
  name         text not null,
  kind         text not null default 'documento' check (kind in ('exame', 'receituario', 'laudo', 'termo', 'foto', 'documento')),
  path         text not null,            -- caminho no bucket "documents"
  mime         text,
  size_kb      integer,
  uploaded_at  timestamptz not null default now(),
  user_id      uuid references public.profiles(id) on delete set null
);
create index if not exists animal_documents_animal_idx on public.animal_documents (animal_id);

-- ─── Segurança (RLS) ───────────────────────────────────────────
alter table public.medication_doses enable row level security;
alter table public.tasks            enable row level security;
alter table public.animal_weights   enable row level security;
alter table public.animal_documents enable row level security;

do $$
declare t text;
begin
  foreach t in array array['medication_doses', 'tasks', 'animal_weights', 'animal_documents']
  loop
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = t || '_staff') then
      execute format('create policy %I on public.%I for all using (public.is_staff()) with check (public.is_staff())', t || '_staff', t);
    end if;
  end loop;
end $$;

-- Bucket PRIVADO: documentos (exames, termos com CPF etc.) só abrem com link temporário.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documents', 'documents', false, 10485760,
        array['application/pdf', 'image/jpeg', 'image/png', 'image/webp',
              'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict (id) do nothing;

create policy documents_read   on storage.objects for select using (bucket_id = 'documents' and public.is_staff());
create policy documents_insert on storage.objects for insert with check (bucket_id = 'documents' and public.is_staff());
create policy documents_delete on storage.objects for delete using (bucket_id = 'documents' and public.is_staff());
